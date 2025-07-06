import { generateImageStream } from '@/integration/huiyan/midjourney'
import { invariant } from '@/lib/invariant'
import { sendEvent } from '@/server/event/publish'
import { uploadQuadrantImage } from '@/server/midjourney-jobs'
import { createTool } from '@mastra/core/tools'
import { firstValueFrom } from 'rxjs'
import { z } from 'zod'

import { logger } from '../factory'

export const midjourneyImageGenerateTool = createTool({
  id: 'midjourney-image-generate',
  description: 'Generate images using Midjourney. ',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    status: z.string(),
    result: z.array(
      z.object({
        id: z.string(),
        resource_id: z.string().optional(),
        job_id: z.string(),
        file_name: z.string().optional(),
        file_size: z.number(),
        key: z.string(),
      }),
    ),
    error: z.string().optional(),
  }),
  execute: async (context) => {
    const { context: input, resourceId, threadId, runId } = context

    if (resourceId) {
      void sendEvent('a1d-agent-toolcall', {
        contentType: 'application/json',
        body: {
          resourceId,
          threadId,
          runId,
          model: 'midjourney',
          provider: 'huiyan',
          input,
        },
      })
    }

    try {
      const result = await firstValueFrom(
        generateImageStream({
          prompt: input.prompt,
          // webhookUrl: 'https://example.com/webhook',
        }),
      )

      if (result.progress === 100) {
        const imageUrl = result.imageUrl!
        invariant(imageUrl, 'imageUrl is required')
        const uploadRecords = await uploadQuadrantImage({
          resourceId,
          jobId: result.id,
          imageUrl,
          bucket: 'midjourney-images',
        })

        return {
          status: 'success',
          result: uploadRecords.map((it) => {
            return {
              id: it.id,
              resource_id: it.resource_id ?? undefined,
              job_id: it.job_id,
              file_name: it.file_name ?? undefined,
              file_size: it.file_size,
              key: it.key,
            }
          }),
        }
      }

      return {
        status: 'error',
        result: [],
        error: 'Unknown error',
      }
    } catch (error) {
      logger.error(
        `Failed to generate or upload image for resourceId=${resourceId}, prompt="${input.prompt}": ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      )

      return {
        status: 'error',
        result: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})
