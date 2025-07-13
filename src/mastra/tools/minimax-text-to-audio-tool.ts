import { api } from '@/convex/_generated/api'
import { MinimaxTextToAudio } from '@/integration/minimax/minimax-text-to-audio'
import { ContextX } from '@/mastra/factory'
import { createTool } from '@mastra/core/tools'
import { firstValueFrom } from 'rxjs'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const minimaxTextToAudioInputSchema = z.object({
  text: z.string().describe('Narration script from storyboard'),
  voice: z.string().describe('Voice style'),
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

// Voice mapping configuration
const VOICE_MAPPING: Record<string, string> = {
  亲切女声: 'female-sweet',
  磁性男声: 'male-magnetic',
  活泼女声: 'female-lively',
  沉稳男声: 'male-calm',
  温柔女声: 'female-gentle',
  青年男声: 'male-youth',
  // Add more mappings as needed
}

// Convert voice style to voice_id
function getVoiceId(voiceStyle: string): string {
  // If it's already a voice_id format, return as is
  if (voiceStyle.includes('-')) {
    return voiceStyle
  }

  // Otherwise map from Chinese description
  return VOICE_MAPPING[voiceStyle] || 'female-sweet'
}

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
    // Hard error: missing required runtime dependency
    if (!threadId) {
      throw new Error('threadId is required for minimax-text-to-audio')
    }

    if (!runtimeContext) {
      throw new Error('runtimeContext is required')
    }

    const { convex } = ContextX.get(runtimeContext)

    try {
      const client = MinimaxTextToAudio.client

      // Convert voice style to voice_id
      const voiceId = getVoiceId(input.voice)

      // Submit audio generation task
      const result = await firstValueFrom(
        client.createTask({
          model: 'speech-02-turbo', // Use turbo model for faster generation
          text: input.text,
          voice_setting: {
            voice_id: voiceId,
            speed: 1.0,
            vol: 1.0,
          },
          audio_setting: {
            output_format: 'mp3',
            sample_rate: 24000,
            bitrate: 128,
            channel: 1,
          },
          stream: false,
          output_format: 'hex',
        }),
      )

      // Check initial response
      if (result.base_resp?.status_code !== 0) {
        return {
          error: `Minimax API error: ${result.base_resp?.status_msg || 'Unknown error'}`,
        }
      }

      // If we got audio directly (non-streaming mode)
      if (result.data?.audio) {
        // Create Convex task for tracking
        const convexTaskId = await convex.mutation(api.tasks.createTask, {
          resourceId: resourceId || 'none',
          runId: runId || 'none',
          threadId,
          assetType: 'audio',
          toolId: TOOL_ID,
          internalTaskId: result.trace_id,
          provider: 'minimax',
          input: {
            text: input.text,
            voice: input.voice,
          },
        })

        // Decode hex audio to binary
        const audioBytes = MinimaxTextToAudio.decodeAudioChunk(
          result.data.audio,
        )
        const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' })
        const audioBase64 = await blobToBase64(audioBlob)

        // Write audio file to VFS
        const { success, storageUrl, error } = await convex.mutation(
          api.vfs.writeFile,
          {
            threadId,
            path: input.output.path,
            content: audioBase64,
            contentType: 'audio/mpeg',
            description:
              input.output.description || 'Generated audio narration',
          },
        )

        if (!success || !storageUrl) {
          await convex.mutation(api.tasks.updateTaskProgress, {
            taskId: convexTaskId,
            progress: 100,
            status: 'failed',
            error: error || 'Failed to save audio file',
          })
          return { error: error || 'Failed to save audio file' }
        }

        // Update task as completed
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: 100,
          status: 'completed',
          output: {
            file_path: input.output.path,
            duration_seconds: result.extra_info?.audio_length || 0,
            storageUrl,
          },
        })

        return {
          file_path: input.output.path,
          duration_seconds: result.extra_info?.audio_length || 0,
        }
      }

      // For async tasks, we need to poll
      if (!result.trace_id) {
        return { error: 'No task ID returned from Minimax API' }
      }

      // Create Convex task for tracking
      const convexTaskId = await convex.mutation(api.tasks.createTask, {
        resourceId: resourceId || 'none',
        runId: runId || 'none',
        threadId,
        assetType: 'audio',
        toolId: TOOL_ID,
        internalTaskId: result.trace_id,
        provider: 'minimax',
        input: {
          text: input.text,
          voice: input.voice,
        },
      })

      // Poll for task completion
      const pollSubscription = client
        .pollTaskStatus(result.trace_id)
        .subscribe({
          next: async (status) => {
            // Calculate progress (Minimax doesn't provide progress, so we estimate)
            const progress =
              status.data?.audio || status.data?.audio_url ? 100 : 50

            await convex.mutation(api.tasks.addTaskEvent, {
              taskId: convexTaskId,
              eventType: 'progress_update',
              progress,
              data: status,
            })
          },
          error: async (error) => {
            await convex.mutation(api.tasks.updateTaskProgress, {
              taskId: convexTaskId,
              progress: 0,
              status: 'failed',
              error: error.message,
            })
          },
        })

      // Wait for the final result
      const finalStatus = await firstValueFrom(
        client.pollTaskStatus(result.trace_id),
      )

      pollSubscription.unsubscribe()

      if (!finalStatus.data?.audio) {
        const errorMessage =
          finalStatus.base_resp?.status_msg || 'Audio generation failed'
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: 100,
          status: 'failed',
          error: errorMessage,
        })
        return { error: errorMessage }
      }

      // Decode and save audio
      const audioBytes = MinimaxTextToAudio.decodeAudioChunk(
        finalStatus.data.audio,
      )
      const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' })
      const audioBase64 = await blobToBase64(audioBlob)

      // Write audio file to VFS
      const { success, storageUrl, error } = await convex.mutation(
        api.vfs.writeFile,
        {
          threadId,
          path: input.output.path,
          content: audioBase64,
          contentType: 'audio/mpeg',
          description: input.output.description || 'Generated audio narration',
        },
      )

      if (!success || !storageUrl) {
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: 100,
          status: 'failed',
          error: error || 'Failed to save audio file',
        })
        return { error: error || 'Failed to save audio file' }
      }

      // Update task as completed
      await convex.mutation(api.tasks.updateTaskProgress, {
        taskId: convexTaskId,
        progress: 100,
        status: 'completed',
        output: {
          file_path: input.output.path,
          duration_seconds: finalStatus.extra_info?.audio_length || 0,
          storageUrl,
        },
      })

      return {
        file_path: input.output.path,
        duration_seconds: finalStatus.extra_info?.audio_length || 0,
      }
    } catch (error) {
      // Soft error: return error message to LLM
      return {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})

// Helper function to convert Blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove data URL prefix
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      } else {
        reject(new Error('Failed to convert blob to base64'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
