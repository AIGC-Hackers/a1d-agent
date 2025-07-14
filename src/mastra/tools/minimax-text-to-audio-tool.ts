import { api } from '@/convex/_generated/api'
import { MinimaxTextToAudio } from '@/integration/minimax/minimax-text-to-audio'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { ContextX, MastraX } from '@/mastra/factory'
import { MediaFileStorage } from '@/server/vfs/media-file-storage'
import { createTool } from '@mastra/core/tools'
import { firstValueFrom, lastValueFrom, tap } from 'rxjs'
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

      MastraX.logger.debug('Creating audio task with Minimax API', {
        model: 'speech-02-turbo',
        voiceId,
        outputFormat: 'mp3',
      })

      const audioTask = await firstValueFrom(
        client.create({
          model: 'speech-02-turbo', // Use turbo model for faster generation
          text: input.text,
          voice_setting: {
            voice_id: voiceId,
          },
          audio_setting: {
            output_format: 'mp3',
          },
          stream: false,
          output_format: 'hex',
        }),
      )

      MastraX.logger.info('Audio task created', {
        traceId: audioTask.trace_id,
        threadId,
      })

      const convexTaskId = await convex.mutation(api.tasks.createTask, {
        resourceId: resourceId || 'none',
        runId: runId || 'none',
        threadId,
        assetType: 'audio',
        toolId: TOOL_ID,
        internalTaskId: audioTask.trace_id,
        provider: 'minimax',
        input: {
          text: input.text,
          voice: voiceId,
        },
      })

      MastraX.logger.debug('Convex task created', {
        convexTaskId,
        internalTaskId: audioTask.trace_id,
      })

      MastraX.logger.info('Starting to poll for audio generation result', {
        traceId: audioTask.trace_id,
      })

      const audioResult = await lastValueFrom(
        MinimaxTextToAudio.client.poll(audioTask.trace_id).pipe(
          tap((it) => {
            MastraX.logger.debug('Minimax text-to-audio task progress', {
              traceId: audioTask.trace_id,
              status: it.data?.status,
            })
          }),
        ),
      )

      MastraX.logger.info('Audio generation completed', {
        traceId: audioTask.trace_id,
        status: audioResult.data?.status,
        subtitle_file: audioResult.subtitle_file,
        audio_url: audioResult.data?.audio_url,
        hasAudioData: !!audioResult.data?.audio,
      })

      const audioHexString = audioResult.data?.audio
      const durationSeconds = audioResult.extra_info?.audio_length

      invariant(audioHexString, 'audioHexData is required')
      invariant(durationSeconds, 'durationSeconds is required')

      MastraX.logger.debug('Saving audio file to storage', {
        path: input.output.path,
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        durationSeconds,
      })

      const savedFile = await MediaFileStorage.saveFile('audio', {
        convex,
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        threadId,
        path: input.output.path,
        source: {
          type: 'hex',
          data: audioHexString,
        },
        contentType: 'audio/mpeg',
        description: input.output.description || 'Generated audio narration',
        metadata: {
          durationSeconds,
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
          duration_seconds: durationSeconds,
          key: savedFile.key,
        },
      })

      MastraX.logger.info(
        'Minimax text-to-audio generation completed successfully',
        {
          threadId,
          outputPath: input.output.path,
          durationSeconds,
        },
      )

      return {
        file_path: input.output.path,
        duration_seconds: durationSeconds,
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
