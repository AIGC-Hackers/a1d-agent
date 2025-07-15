import { api } from '@/convex/_generated/api'
import { MinimaxTextToAudio } from '@/integration/minimax/minimax-text-to-audio'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { ContextX, MastraX } from '@/mastra/factory'
import { MediaFileStorage } from '@/server/vfs/media-file-storage'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const minimaxTextToAudioInputSchema = z.object({
  text: z.string().describe('Narration script from storyboard'),
  // voice: z.string().describe('Voice style'),
  output: fileDescriptorSchema.describe('VFS path for audio file'),
})

export const minimaxTextToAudioOutputSchema = z.object({
  file_path: z.string(),
  duration_seconds: z.number(),
})

export const MINIMAX_TOOL_DESCRIPTION = 'Create narration audio for a shot'

const TOOL_ID = 'minimax-text-to-audio'

export type MinimaxTextToAudioOutput =
  | {
      file_path: string
      duration_seconds: number
    }
  | { error: string }

export const minimaxTextToAudioTool = createTool({
  id: TOOL_ID,
  description: MINIMAX_TOOL_DESCRIPTION,
  inputSchema: minimaxTextToAudioInputSchema,
  execute: async ({
    context: input,
    threadId,
    runId,
    resourceId,
    runtimeContext,
  }): Promise<MinimaxTextToAudioOutput> => {
    invariant(threadId, 'threadId is required')

    MastraX.logger.info('Starting Minimax text-to-audio generation', {
      threadId,
      runId,
      resourceId,
      textLength: input.text.length,
      outputPath: input.output.path,
    })

    const { convex } = ContextX.get(runtimeContext)

    try {
      const client = MinimaxTextToAudio.client

      const voiceId = 'male-qn-qingse'

      MastraX.logger.debug('Starting audio stream with Minimax API', {
        model: 'speech-02-turbo',
        voiceId,
        outputFormat: 'mp3',
      })

      const streamResult = await client.stream({
        model: 'speech-02-turbo', // Use turbo model for faster generation
        text: input.text,
        voice_setting: {
          voice_id: voiceId,
        },
        audio_setting: {
          output_format: 'mp3',
        },
        stream: true,
      })

      const traceId = streamResult.task.trace_id

      MastraX.logger.info('Audio stream started', {
        traceId,
        threadId,
      })

      const convexTaskId = await convex.mutation(api.tasks.createTask, {
        resourceId: resourceId || 'none',
        runId: runId || 'none',
        threadId,
        assetType: 'audio',
        toolId: TOOL_ID,
        internalTaskId: traceId,
        provider: 'minimax',
        input: {
          text: input.text,
          voice: voiceId,
        },
      })

      MastraX.logger.debug('Convex task created', {
        convexTaskId,
        internalTaskId: traceId,
      })

      MastraX.logger.info('Processing audio stream events', {
        traceId,
      })

      // Collect audio chunks and extra info from stream
      let audioChunks: string[] = []
      let durationSeconds: number | undefined
      let totalProgress = 0

      // TODO refactor stream api to return aggregated data

      await new Promise<void>((resolve, reject) => {
        streamResult.events.subscribe({
          next: (event) => {
            MastraX.logger.debug('Stream event received', {
              traceId,
              eventType: event.type,
            })

            if (event.type === 'audio_chunk') {
              audioChunks.push(event.data.audio)
              totalProgress += 10 // Approximate progress increment

              // Update progress in Convex (throttled)
              if (audioChunks.length % 3 === 0) {
                convex
                  .mutation(api.tasks.updateTaskProgress, {
                    taskId: convexTaskId,
                    progress: Math.min(totalProgress, 90),
                    status: 'generating',
                  })
                  .catch((err) => {
                    MastraX.logger.warn('Failed to update task progress', {
                      error: err,
                    })
                  })
              }
            } else if (event.type === 'extra_info') {
              durationSeconds = event.data.extra_info.audio_length
              MastraX.logger.info('Received audio extra info', {
                traceId,
                durationSeconds,
                audioFormat: event.data.extra_info.audio_format,
                audioSize: event.data.extra_info.audio_size,
              })
            } else if (event.type === 'complete') {
              // Handle final audio chunk if present
              if (event.data.final_audio) {
                audioChunks.push(event.data.final_audio)
              }
              MastraX.logger.info('Audio stream completed', {
                traceId,
                totalChunks: audioChunks.length,
              })
              resolve()
            }
          },
          error: (error) => {
            MastraX.logger.error('Stream error', {
              traceId,
              error: error.message,
            })
            reject(error)
          },
          complete: () => {
            MastraX.logger.debug('Stream completed', { traceId })
            resolve()
          },
        })
      })

      // Combine all audio chunks
      const audioHexString = audioChunks.join('')

      invariant(audioHexString, 'audioHexData is required')
      invariant(durationSeconds, 'durationSeconds is required')

      MastraX.logger.debug('Saving audio file to storage', {
        path: input.output.path,
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        durationSeconds,
        audioSize: Math.floor(audioHexString.length / 2),
      })

      const savedFile = await MediaFileStorage.saveFile('audio', {
        convex,
        resourceId,
        threadId,
        path: input.output.path,
        source: {
          type: 'hex',
          data: audioHexString,
          contentType: 'audio/mpeg',
        },
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        contentType: 'audio/mpeg',
        description: input.output.description || 'Generated audio narration',
        metadata: {
          durationSeconds: durationSeconds / 1000, // Convert milliseconds to seconds
        },
      })

      MastraX.logger.info('Audio file saved successfully', {
        path: savedFile.path,
        key: savedFile.key,
        durationSeconds,
      })

      await convex.mutation(api.tasks.updateTaskProgress, {
        taskId: convexTaskId,
        progress: 100,
        status: 'completed',
        output: {
          file_path: savedFile.path,
          duration_seconds: durationSeconds / 1000, // Convert milliseconds to seconds
          key: savedFile.key,
        },
      })

      MastraX.logger.info(
        'Minimax text-to-audio generation completed successfully',
        {
          threadId,
          outputPath: input.output.path,
          durationSeconds: durationSeconds / 1000,
        },
      )

      return {
        file_path: input.output.path,
        duration_seconds: durationSeconds / 1000, // Convert milliseconds to seconds
      }
    } catch (error) {
      MastraX.logger.error('Failed to generate audio with Minimax', {
        threadId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Soft error: return error message to LLM
      return {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

// if (import.meta.main) {
//   const args = {
//     text: '2025年，氢能存储技术迎来历史性突破。三大核心技术同时取得重大进展，为清洁能源革命奠定坚实基础。',
//     output: {
//       path: '/scene-1/audio.mp3',
//       description: '场景1开场引入旁白音频',
//     },
//   }
//   const rt = new RuntimeContext()
//   ContextX.set(rt)

//   const result = await minimaxTextToAudioTool.execute!({
//     context: args,
//     threadId: 'test',
//     runtimeContext: rt,
//   })

//   console.log(result)
// }
