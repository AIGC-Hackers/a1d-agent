import { api } from '@/convex/_generated/api'
import { Midjourney } from '@/integration/302/midjourney'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { ContextX, logger } from '@/mastra/factory'
import { MediaFileStorage } from '@/server/vfs/media-file-storage'
import { createTool } from '@mastra/core/tools'
import { firstValueFrom, lastValueFrom, tap } from 'rxjs'

import {
  MIDJOURNEY_TOOL_DESCRIPTION,
  midjourneyImageGenerateInputSchema,
} from './schemas/midjourney-schemas'

type MidjourneyImageGenerateOutput =
  | {
      prompt: string
      files: string[]
      width: number
      height: number
    }
  | { error: string }

const TOOL_ID = 'midjourney-image-generate'

export const midjourneyImageGenerateTool = createTool({
  id: TOOL_ID,
  description: MIDJOURNEY_TOOL_DESCRIPTION,
  inputSchema: midjourneyImageGenerateInputSchema,
  execute: async (context): Promise<MidjourneyImageGenerateOutput> => {
    const { context: input, resourceId, threadId, runId } = context
    const { prompt, output } = input

    invariant(threadId, 'threadId is required')

    const { convex } = ContextX.get(context.runtimeContext)

    try {
      // 提交生成任务
      logger.info('Submitting Midjourney image generation task', { prompt })

      const submitResult = await firstValueFrom(
        Midjourney.client.submitImagine({ prompt }),
      )

      const midjourneyTaskId = submitResult.result

      // 创建 Convex 任务记录
      const convexTaskId = await convex.mutation(api.tasks.createTask, {
        resourceId: resourceId || 'none',
        runId: runId || 'none',
        threadId,
        assetType: 'image',
        toolId: TOOL_ID,
        internalTaskId: midjourneyTaskId,
        provider: '302',
        input: {
          prompt,
          output_path: output.path,
        },
      })

      // 使用流式接口获取进度
      const status$ = Midjourney.client.pollStream(midjourneyTaskId).pipe(
        tap(async (status) => {
          logger.info('Midjourney progress update', {
            progress: status.progress,
            status: status.status,
            hasImage: !!status.imageUrl,
          })

          // 更新 Convex 任务进度
          await convex.mutation(api.tasks.addTaskEvent, {
            taskId: convexTaskId,
            eventType: 'progress_update',
            progress: status.progress,
            data: status,
          })
        }),
      )

      logger.info('Waiting for Midjourney generation to complete...')

      // 获取最终结果
      const finalResult = await lastValueFrom(status$)

      if (
        !finalResult ||
        finalResult.progress !== 100 ||
        !finalResult.imageUrl
      ) {
        const errorMessage =
          finalResult?.failReason ||
          'Midjourney task ended without final result'
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: finalResult.progress,
          status: 'failed',
          error: errorMessage,
        })
        return { error: errorMessage }
      }

      logger.info('Midjourney generation completed, saving quadrant images', {
        imageUrl: finalResult.imageUrl,
      })

      // 保存四象限图片
      const savedQuadrants = await MediaFileStorage.saveQuadrantImage({
        convex,
        resourceId,
        threadId,
        path: output.path,
        imageUrl: finalResult.imageUrl,
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
      })

      const filePaths = savedQuadrants.map((record) => record.path)

      // 最终更新任务为完成
      await convex.mutation(api.tasks.updateTaskProgress, {
        taskId: convexTaskId,
        progress: 100,
        status: 'completed',
        output: {
          file_paths: filePaths,
          task_id: convexTaskId,
          original_image_url: finalResult.imageUrl,
          r2_keys: savedQuadrants.map((r) => r.key),
          vfs_entity_ids: savedQuadrants.map((r) => r.entityId),
          midjourney_task_id: midjourneyTaskId,
        },
      })

      logger.info('Midjourney image generation completed', {
        convexTaskId,
        midjourneyTaskId,
        savedFiles: filePaths.length,
      })

      // 返回结果
      return {
        prompt,
        files: filePaths,
        width: savedQuadrants.width,
        height: savedQuadrants.height,
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      return {
        error: errorMessage,
      }
    }
  },
})
