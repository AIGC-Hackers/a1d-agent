import { api } from '@/convex/_generated/api'
import { S3 } from '@/integration/s3'
import { Speedpainter } from '@/integration/speedpainter'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { Result } from '@/lib/result'
import { logger } from '@/mastra/factory'
import { MediaFileStorage } from '@/server/vfs/media-file-storage'
import { createTool } from '@mastra/core/tools'
import { ConvexHttpClient } from 'convex/browser'

import {
  SPEEDPAINT_TOOL_DESCRIPTION,
  speedpaintVideoGenerateInputSchema,
} from './schemas/speedpaint-schemas'

type SpeedpaintVideoGenerateOutput =
  | {
      inputImagePath: string
      width: number
      height: number
      durationSeconds: number
      fileSavedPath: string
    }
  | { error: string }

const TOOL_ID = 'speedpaint-video-generate'

export const speedpaintVideoGenerateTool = createTool({
  id: TOOL_ID,
  description: SPEEDPAINT_TOOL_DESCRIPTION,
  inputSchema: speedpaintVideoGenerateInputSchema,
  execute: async (context): Promise<SpeedpaintVideoGenerateOutput> => {
    const { context: input, resourceId, threadId, runId } = context
    const { image_path, duration_seconds, output } = input

    invariant(threadId, 'threadId is required')

    const convex = new ConvexHttpClient(env.value.CONVEX_URL)

    const inputData = await getInputData({
      convex,
      threadId,
      image_path,
    })

    if (Result.isErr(inputData)) {
      return { error: inputData.error.message }
    }

    // 创建 Convex 任务记录 - 生成过程开始就创建
    logger.info('Creating SpeedPainter video generation task', inputData.data)

    try {
      const { taskId: speedpainterTaskId } = await Speedpainter.createTask({
        imageUrl: inputData.data.imageUrl,
        mimeType: 'image/png',
        colorFillDuration: 0,
        sketchDuration: 0,
        needCanvas: false,
        needHand: false,
        needFadeout: false,
      })

      const convexTaskId = await convex.mutation(api.tasks.createTask, {
        resourceId: resourceId || 'none',
        runId: runId || 'none',
        threadId,
        assetType: 'video',
        toolId: TOOL_ID,
        internalTaskId: speedpainterTaskId,
        provider: 'a1d',
        input: {
          image_path,
          duration_seconds,
          output_path: output.path,
        },
      })

      // 使用流式接口生成视频
      const videoStream = Speedpainter.getTaskStatusStream({
        taskId: speedpainterTaskId,
      })

      // 订阅流，更新进度
      logger.info('Waiting for SpeedPainter generation to complete...')

      let finalResult: Speedpainter.TaskStatus | null = null

      for await (const status of videoStream) {
        logger.info('SpeedPainter progress update', {
          status: status.status,
          progress: status.progress,
        })

        // 更新 Convex 任务进度
        await convex.mutation(api.tasks.addTaskEvent, {
          taskId: convexTaskId,
          eventType: 'progress_update',
          data: status,
        })

        finalResult = status
      }

      if (!finalResult || finalResult.status !== 'FINISHED') {
        return { error: 'SpeedPainter task ended without final status' }
      }

      logger.info('SpeedPainter generation completed successfully', {
        videoUrl: finalResult.videoUrl,
        sketchImageUrl: finalResult.sketchImageUrl,
      })

      const saveResult = await MediaFileStorage.saveFile({
        convex,
        resourceId,
        threadId,
        path: output.path,
        source: {
          type: 'url',
          url: finalResult.videoUrl,
        },
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        contentType: 'video/mp4',
        description: `SpeedPaint video generated from ${image_path}`,
        metadata: {
          width: inputData.data.width,
          height: inputData.data.height,
          durationSeconds: duration_seconds,
        },
      })

      const publicUrl = S3.createPublicUrl({
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        key: saveResult.key,
      })

      // 最终更新任务为完成
      await convex.mutation(api.tasks.updateTaskProgress, {
        taskId: convexTaskId,
        progress: 100,
        status: 'completed',
        output: {
          file_path: output.path,
          task_id: convexTaskId,
          original_video_url: finalResult.videoUrl,
          public_video_url: publicUrl,
          sketch_image_url: finalResult.sketchImageUrl,
          r2_key: saveResult.key,
          vfs_entity_id: saveResult.entityId,
          speedpainter_task_id: speedpainterTaskId,
        },
      })

      logger.info('SpeedPaint video generation completed', {
        convexTaskId,
        speedpainterTaskId,
        publicUrl,
      })

      // 返回结果
      return {
        inputImagePath: image_path,
        width: inputData.data.width,
        height: inputData.data.height,
        durationSeconds: duration_seconds,
        fileSavedPath: output.path,
      }
    } catch (error) {
      // 更新任务为失败状态
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      return {
        error: errorMessage,
      }
    }
  },
})

async function getInputData(props: {
  convex: ConvexHttpClient
  threadId: string
  image_path: string
}) {
  const { convex, threadId, image_path } = props

  // find & verify image file in vfs
  const imageFile = await convex.query(api.vfs.readFile, {
    threadId: threadId,
    path: image_path,
  })

  if (!imageFile) {
    return Result.err(new Error(`Image file not found: ${image_path}`))
  }

  const {
    key: imageKey,
    width,
    height,
  } = MediaFileStorage.Schema.ImageObject.assert(imageFile.metadata)
  const imageUrl = S3.createPublicUrl({
    bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
    key: imageKey,
  })

  return Result.ok({
    imageUrl,
    width,
    height,
  })
}
