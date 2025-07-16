import { api } from '@/convex/_generated/api'
import { MidjourneyProxy } from '@/integration/midjourney/factory'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { ContextX, MastraX } from '@/mastra/factory'
import { MediaFileStorage } from '@/server/vfs/media-file-storage'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { createTool } from '@mastra/core/tools'
import { lastValueFrom, tap } from 'rxjs'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

/**
 * ⚠️ 警告：Midjourney 的代理服务极其不稳定，生成任务经常失败或延迟。
 * 高度建议不要再使用本工具，优先考虑使用 Kontext/FAL 等更可靠的生成服务。
 */

export const midjourneyImageGenerateInputSchema = z.object({
  prompt: z.string(),
  aspectRatio: z
    .enum(['1:2', '16:9', '9:16', '4:3', '3:4', '1:1'])
    .optional()
    .default('1:1'),
  output: fileDescriptorSchema.describe(
    'VFS path prefix for images (generates 4 images with 0 to 3 suffix)',
  ),
})

export const MIDJOURNEY_TOOL_DESCRIPTION = 'Generate images using Midjourney'

export type MidjourneyImageGenerateOutput =
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
    const { prompt, output, aspectRatio = '1:1' } = input
    const provider = 'huiyan'

    invariant(threadId, 'threadId is required')

    const { convex } = ContextX.get(context.runtimeContext)

    try {
      // 创建客户端
      const client = MidjourneyProxy.client(provider)

      MastraX.logger.info('Submitting Midjourney image generation task', {
        prompt,
        provider: client.provider,
        aspectRatio,
      })

      // 提交生成任务
      const taskResult = await client.imagine({
        prompt,
        aspectRatio,
      })

      if (!taskResult.success) {
        MastraX.logger.error('Failed to submit Midjourney task', {
          error: taskResult.error.message,
          provider,
        })
        return { error: taskResult.error.message }
      }

      const task = taskResult.data
      const midjourneyTaskId = task.id

      MastraX.logger.info('Midjourney task submitted', {
        midjourneyTaskId,
        provider,
      })

      // 创建 Convex 任务记录
      const convexTaskId = await convex.mutation(api.tasks.createTask, {
        resourceId: resourceId || 'none',
        runId: runId || 'none',
        threadId,
        assetType: 'image',
        toolId: TOOL_ID,
        internalTaskId: midjourneyTaskId,
        provider: provider,
        input: {
          prompt,
          output_path: output.path,
        },
      })

      // 使用流式接口获取进度
      const status$ = task
        .stream({
          interval: 5000,
          timeout: 600000, // 10 minutes
        })
        .pipe(
          tap(async (state) => {
            MastraX.logger.info('Midjourney progress update', {
              progress: state.progress,
              status: state.status,
              hasImage: state.status === 'completed' && 'imageUrl' in state,
              provider,
            })

            // 更新 Convex 任务进度
            await convex.mutation(api.tasks.addTaskEvent, {
              taskId: convexTaskId,
              eventType: 'progress_update',
              progress: state.progress,
              data: state.payload,
            })
          }),
        )

      MastraX.logger.info('Waiting for Midjourney generation to complete...')

      // 获取最终结果
      const finalState = await lastValueFrom(status$)

      if (finalState.status === 'failed') {
        const errorMessage =
          finalState.error?.message || 'Midjourney task failed'
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: finalState.progress,
          status: 'failed',
          error: errorMessage,
        })
        return { error: errorMessage }
      }

      if (finalState.status !== 'completed' || !('imageUrl' in finalState)) {
        const errorMessage = 'Midjourney task ended without final result'
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: finalState.progress,
          status: 'failed',
          error: errorMessage,
        })
        return { error: errorMessage }
      }

      MastraX.logger.info(
        'Midjourney generation completed, saving quadrant images',
        {
          imageUrl: finalState.imageUrl,
          provider,
        },
      )

      // 保存四象限图片
      const savedQuadrants = await MediaFileStorage.saveQuadrantImage({
        convex,
        resourceId,
        threadId,
        path: output.path,
        imageUrl: finalState.imageUrl,
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
          original_image_url: finalState.imageUrl,
          r2_keys: savedQuadrants.map((r) => r.key),
          vfs_entity_ids: savedQuadrants.map((r) => r.entityId),
          midjourney_task_id: midjourneyTaskId,
        },
      })

      MastraX.logger.info('Midjourney image generation completed', {
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
        error: `Midjourney image generation failed: ${errorMessage}`,
      }
    }
  },
})

if (import.meta.main) {
  const provider = (process.argv[2] as '302' | 'huiyan') || 'huiyan'

  const args = {
    prompt:
      'A serene Japanese garden with cherry blossoms, koi pond, traditional bridge, photorealistic, 8k',
    output: {
      path: '/test-mj/garden',
      description: 'Test Midjourney generation - Japanese garden scene',
    },
    provider,
    aspectRatio: '16:9' as const,
  }

  const rt = new RuntimeContext()
  ContextX.set(rt)

  console.log(`Testing with provider: ${provider}`)

  const result = await midjourneyImageGenerateTool.execute!({
    context: args,
    threadId: 'test-mj',
    resourceId: 'test-resource',
    runtimeContext: rt,
  })

  console.log('Midjourney generation result:', result)
}
