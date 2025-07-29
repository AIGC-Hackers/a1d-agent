import type { Id } from '@/convex/_generated/dataModel'
import type { QueueStatus } from '@fal-ai/client'
import { api } from '@/convex/_generated/api'
import { Fal } from '@/integration/fal'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { ContextX, MastraX } from '@/mastra/factory'
import { MediaFileStorage } from '@/server/vfs/media-file-storage'
import { StreamEvent } from '@mastra/core'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const kontextTextToImageInputSchema = z.object({
  prompt: z.string()
    .describe(`Craft visual prompts as a detailed canvas blueprint. Master techniques:

STRUCTURE: [Subject] + [Composition] + [Style] + [Details] + [Atmosphere]
• Subject first: "Four-tier pyramid structure" not "illustration of pyramid"
• Composition: centered, rule of thirds, diagonal flow, hierarchical layout
• Style tokens: hand-drawn, sketch style, line art, technical drawing, doodle art
• Detail modifiers: clean lines, varied line weights, cross-hatching, minimal shading

WHITEBOARD STYLE SPECIFICS:
• Use: "hand-drawn style", "sketch aesthetic", "marker illustration style"
• Avoid: "whiteboard", "on board", "whiteboard background", "drawn on white surface"
• Focus on content floating in space, not mounted on surfaces

VISUAL HIERARCHY:
• Primary elements: bold lines, larger scale, center placement
• Secondary: medium weight, supporting positions
• Tertiary: thin lines, subtle details, environmental elements

COLOR STRATEGY:
• Monochrome base with accent colors: "black line art with blue and orange accents"
• Limited palette: "two-tone design", "three-color scheme"
• Emphasis through color: "red highlighting critical elements"

NEGATIVE SPACE:
• Embrace emptiness: "floating elements", "isolated components", "clean composition"
• No frames or borders unless specifically needed for the design

Example transformation:
❌ "Professional whiteboard illustration showing AI pyramid on white background"
✅ "Four-tier pyramid structure in hand-drawn style, bold black lines with varied weights, centered composition, tier labels in clean sans-serif, red-orange-yellow-green gradient from top to bottom, floating icons around each level, technical drawing aesthetic, isolated on pure white"

Remember: Describe what IS there, not what it's ON or IN.`),
  aspectRatio: z.enum([
    '21:9',
    '16:9',
    '4:3',
    '3:2',
    '1:1',
    '2:3',
    '3:4',
    '9:16',
    '9:21',
  ]),
  output: fileDescriptorSchema.describe('VFS path prefix for generated images'),
})

export const KONTEXT_TOOL_DESCRIPTION =
  'Generate high-quality images using Flux Pro Kontext'

export type KontextTextToImageOutput =
  | {
      prompt: string
      files: string[]
      width: number
      height: number
    }
  | { error: string }

const TOOL_ID = 'kontext-text-to-image'
const MODEL_ID = 'fal-ai/flux-pro/kontext/max/text-to-image'

export const kontextTextToImageTool = createTool({
  id: TOOL_ID,
  description: KONTEXT_TOOL_DESCRIPTION,
  inputSchema: kontextTextToImageInputSchema,
  execute: async (context): Promise<KontextTextToImageOutput> => {
    const { context: input, resourceId, threadId, runId, writer } = context
    const { prompt, output, aspectRatio } = input

    invariant(threadId, 'threadId is required')
    // invariant(writer, 'writer is required')

    const { convex } = ContextX.get(context.runtimeContext)

    try {
      const client = Fal.client()

      MastraX.logger.info('Submitting Kontext text-to-image generation task', {
        prompt: prompt.slice(0, 80) + '...',
        aspectRatio,
      })

      // Wrap FAL subscription in a Promise for better control
      const { result, convexTaskId } = await new Promise<{
        result: {
          data: {
            images: Array<{ url: string; width: number; height: number }>
          }
          requestId: string
        }
        convexTaskId: Id<'task'>
      }>(async (resolve, reject) => {
        let taskId: Id<'task'> | null = null

        try {
          const falResult = await client.subscribe(MODEL_ID, {
            input: {
              prompt,
              aspect_ratio: aspectRatio,
              output_format: 'jpeg',
              num_images: 1,
              guidance_scale: 3.5,
              safety_tolerance: '1', // 最低安全限制
            },
            logs: true,
            onEnqueue: async (requestId) => {
              // Create Convex task record when request is enqueued
              taskId = await convex.mutation(api.tasks.createTask, {
                resourceId: resourceId || 'none',
                runId: runId || 'none',
                threadId,
                assetType: 'image',
                toolId: TOOL_ID,
                internalTaskId: requestId, // Use FAL's requestId as internal task ID
                provider: 'fal',
                input: {
                  prompt,
                  output_path: output.path,
                  aspect_ratio: aspectRatio,
                  request_id: requestId,
                },
              })

              MastraX.logger.info('Kontext task enqueued', {
                convexTaskId: taskId,
                requestId,
              })
            },
            onQueueUpdate: async (status: QueueStatus) => {
              MastraX.logger.info('Kontext progress update', {
                status: status.status,
                queuePosition:
                  'queue_position' in status
                    ? status.queue_position
                    : undefined,
              })

              // Calculate progress
              let progress = 0
              if (status.status === 'IN_QUEUE') {
                progress = 10
              } else if (status.status === 'IN_PROGRESS') {
                progress = 50
              } else if (status.status === 'COMPLETED') {
                progress = 90
              }

              // Update Convex task progress
              if (taskId) {
                await convex.mutation(api.tasks.addTaskEvent, {
                  taskId: taskId,
                  eventType: 'progress_update',
                  progress,
                  data: {
                    status: status.status,
                    logs: 'logs' in status ? status.logs : undefined,
                  },
                })
              }
            },
          })

          if (!taskId) {
            throw new Error('Failed to create Convex task')
          }

          resolve({ result: falResult, convexTaskId: taskId })
        } catch (error) {
          reject(error)
        }
      })

      if (!result.data.images || result.data.images.length === 0) {
        const errorMessage = 'No images generated'
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: 100,
          status: 'failed',
          error: errorMessage,
        })
        return { error: errorMessage }
      }

      MastraX.logger.info('Kontext generation completed, saving image')

      // Save the generated image (Kontext only generates 1 image)
      const image = result.data.images[0]

      const savedFile = await MediaFileStorage.saveFile('image', {
        convex,
        resourceId,
        threadId,
        path: output.path,
        source: {
          type: 'url',
          url: image.url,
        },
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        metadata: {
          width: image.width,
          height: image.height,
        },
      })

      // Update task as completed
      await convex.mutation(api.tasks.updateTaskProgress, {
        taskId: convexTaskId,
        progress: 100,
        status: 'completed',
        output: {
          file_paths: [savedFile.path],
          task_id: convexTaskId,
          r2_keys: [savedFile.key],
          vfs_entity_ids: [savedFile.entityId],
          request_id: result.requestId,
        },
      })

      MastraX.logger.info('Kontext image generation completed', {
        convexTaskId,
        requestId: result.requestId,
      })

      return {
        prompt,
        files: [savedFile.path],
        width: image.width,
        height: image.height,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      return {
        error: `Kontext image generation failed: ${errorMessage}`,
      }
    }
  },
})

if (import.meta.main) {
  const args = {
    prompt:
      'A futuristic cityscape at sunset with flying cars, neon lights, cyberpunk aesthetic, ultra detailed, 8k',
    output: {
      path: '/test-kontext/cityscape',
      description: 'Test Kontext generation - Futuristic cityscape',
    },
    aspectRatio: '16:9' as const,
  }

  const rt = new RuntimeContext()
  ContextX.set(rt)

  console.log('Testing Kontext text-to-image generation...')

  const result = await kontextTextToImageTool.execute!({
    context: args,
    threadId: 'test-kontext',
    resourceId: 'test-resource',
    runtimeContext: rt,
  })

  console.log('Kontext generation result:', result)
}
