import { api } from '@/convex/_generated/api'
import { S3 } from '@/integration/s3'
import { Speedpainter } from '@/integration/speedpainter'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { Result } from '@/lib/result'
import { ContextX, MastraX } from '@/mastra/factory'
import { MediaFileStorage } from '@/server/vfs/media-file-storage'
import { RuntimeContext } from '@mastra/core/runtime-context'
import { createTool } from '@mastra/core/tools'
import { ConvexHttpClient } from 'convex/browser'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const speedpaintVideoGenerateInputSchema = z.object({
  image_path: z.string().describe('VFS path to source image'),
  duration_seconds: z
    .number()
    .min(3)
    .max(90)
    .transform(Math.round) // FIXME @moose
    .describe('Must be exactly equal to the audio file duration'),
  color_fill_duration: z
    .number()
    .min(1)
    .max(90)
    .transform(Math.round) // FIXME @moose
    .optional()
    .describe(
      'Duration for color fill (must be less than or equal to duration_seconds)',
    ),
  output: fileDescriptorSchema.describe('VFS path for video clip'),
})

export const SPEEDPAINT_TOOL_DESCRIPTION =
  'Generate speedpaint animation from image'

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
    const {
      context: input,
      resourceId,
      threadId,
      runId,
      runtimeContext,
    } = context

    const { image_path, duration_seconds, color_fill_duration, output } = input

    invariant(threadId, 'threadId is required')

    const convex = new ConvexHttpClient(env.value.CONVEX_URL)

    const inputData = await MediaFileStorage.getFileInfo('image', {
      convex,
      threadId,
      path: image_path,
    })

    // 创建 Convex 任务记录 - 生成过程开始就创建
    MastraX.logger.info(
      'Creating SpeedPainter video generation task',
      inputData.metadata,
    )

    const imageUrl = S3.createPublicUrl({
      bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
      key: `${inputData.metadata.key}`,
    })

    try {
      const { taskId: speedpainterTaskId } = await Speedpainter.createTask({
        imageUrl,
        mimeType: 'image/png',
        colorFillDuration: color_fill_duration ?? 3,
        sketchDuration: duration_seconds,
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
      MastraX.logger.info('Waiting for SpeedPainter generation to complete...')

      let finalResult: Speedpainter.TaskStatus | null = null

      for await (const status of videoStream) {
        MastraX.logger.info('SpeedPainter progress update', {
          status: status.status,
          progress: status.progress,
        })

        // 更新 Convex 任务进度
        await convex.mutation(api.tasks.addTaskEvent, {
          taskId: convexTaskId,
          eventType: 'progress_update',
          data: status,
          progress: status.progress,
        })

        finalResult = status
      }

      if (!finalResult || finalResult.status !== 'FINISHED') {
        return { error: 'SpeedPainter task ended without final status' }
      }

      MastraX.logger.info('SpeedPainter generation completed successfully', {
        videoUrl: finalResult.videoUrl,
        sketchImageUrl: finalResult.sketchImageUrl,
      })

      const saveResult = await MediaFileStorage.saveFile('video', {
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
          width: inputData.metadata.width,
          height: inputData.metadata.height,
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

      MastraX.logger.info('SpeedPaint video generation completed', {
        convexTaskId,
        speedpainterTaskId,
        publicUrl,
      })

      // 返回结果
      return {
        inputImagePath: image_path,
        width: inputData.metadata.width,
        height: inputData.metadata.height,
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

if (import.meta.main) {
  const rt = new RuntimeContext()
  ContextX.set(rt)

  // "/scene-6/image.png"
  // "672215d7-fb6c-4869-834c-3eb1a0a6c15c"

  // http://localhost:4111/agents/drawOutK2/chat/5cafdf34-3cc1-4df5-8673-057561db776b
  const threadId = '5cafdf34-3cc1-4df5-8673-057561db776b'
  const result = await speedpaintVideoGenerateTool.execute!({
    context: {
      image_path: '/test/circle.png', // Assume image is already in VFS
      duration_seconds: 10,
      color_fill_duration: 0,
      output: {
        path: '/test-speedpaint/scene-3/animation.mp4',
        description:
          'Test SpeedPaint video generation - 10 second animation from EU AI law pyramid',
      },
    },
    threadId,
    resourceId: 'test-resource',
    runtimeContext: rt,
  })

  console.log('\nSpeedPaint generation result:', result)
}
