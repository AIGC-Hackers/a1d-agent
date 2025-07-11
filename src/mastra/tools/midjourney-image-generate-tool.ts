import { generateImageStream } from '@/integration/huiyan/midjourney'
import { invariant } from '@/lib/invariant'
import { sendEvent } from '@/server/event/publish'
import { uploadQuadrantImage } from '@/server/midjourney-jobs'
import { createTool } from '@mastra/core/tools'
import { firstValueFrom } from 'rxjs'
import { z } from 'zod'

import { logger } from '../factory'
import {
  MIDJOURNEY_TOOL_DESCRIPTION,
  midjourneyImageGenerateInputSchema,
  midjourneyImageGenerateOutputSchema,
} from './schemas/midjourney-schemas'

export const midjourneyImageGenerateTool = createTool({
  id: 'midjourney-image-generate',
  description: MIDJOURNEY_TOOL_DESCRIPTION,
  inputSchema: midjourneyImageGenerateInputSchema,
  outputSchema: midjourneyImageGenerateOutputSchema,
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

        // 基于 output 路径生成 VFS 兼容的路径
        const basePath = input.output.path.replace(/\.[^/.]+$/, '') // 移除扩展名

        return {
          success: true,
          result: uploadRecords.map((it, index) => {
            return {
              id: it.id,
              resource_id: it.resource_id ?? undefined,
              job_id: it.job_id,
              file_name: it.file_name ?? undefined,
              file_size: it.file_size,
              key: `${basePath}-${index + 1}.jpg`, // 使用 VFS 路径格式
            }
          }),
        }
      }

      return {
        success: false,
        result: [],
        error: 'Unknown error',
      }
    } catch (error) {
      logger.error(
        `Failed to generate or upload image for resourceId=${resourceId}, prompt="${input.prompt}": ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
      )

      return {
        success: false,
        result: [],
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})
