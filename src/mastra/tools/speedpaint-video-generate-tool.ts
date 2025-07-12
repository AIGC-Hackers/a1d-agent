/**
 * SpeedPaint Video Generate Tool
 *
 * This tool generates speedpaint (hand-drawing) animations from static images.
 *
 * ## Design Context
 *
 * This tool is primarily used by the DrawOut Agent for creating whiteboard-style videos.
 * The agent specifies an output path in VFS (Virtual File System) where the generated
 * video should be saved. This allows:
 *
 * 1. The agent to reference the generated video in subsequent conversation
 * 2. Frontend to access the video by prepending a domain to the VFS path
 * 3. Consistent file organization (e.g., /scene/scene-1/speedpaint.mp4)
 *
 * ## Path Management Rules
 *
 * - **Input Path**: VFS path (e.g., `/scene/scene-1/image.png`)
 * - **Output Path**: VFS path (e.g., `/scene/scene-1/speedpaint.mp4`)
 * - **R2 Storage Path**: `{threadId}/{output.path}` (with leading slash removed)
 *
 * This ensures thread isolation since LLM conversations are organized by thread.
 *
 * ## Image Requirements
 *
 * - Image must exist in VFS with valid metadata
 * - `contentType` field is required (enforced by invariant)
 * - `metadata.image_url` must contain HTTP URL (no data: URLs)
 * - Only HTTP/HTTPS URLs are accepted for security and performance
 *
 * ## Workflow
 *
 * 1. Read source image from VFS (metadata must contain HTTP URL)
 * 2. Create a Convex task to track generation progress
 * 3. Submit to SpeedPainter API and monitor progress via SSE stream
 * 4. Download generated video and save to R2 for permanent storage
 * 5. Save video reference to VFS at the specified output path
 * 6. Return task_id and video_url for confirmation
 *
 * ## Error Handling
 *
 * Returns error message instead of throwing, allowing LLM to see what went wrong.
 */
import type { SpeedpainterJobResult } from '@/integration/speedpainter'
import { api } from '@/convex/_generated/api'
import { createCloudflareR2Url } from '@/integration/s3'
import { generateSpeedpainterVideoStream } from '@/integration/speedpainter'
import { env } from '@/lib/env'
import { invariant } from '@/lib/invariant'
import { createTool } from '@mastra/core/tools'
import { ConvexHttpClient } from 'convex/browser'
import { firstValueFrom } from 'rxjs'
import { map, tap } from 'rxjs/operators'

import {
  SPEEDPAINT_TOOL_DESCRIPTION,
  speedpaintVideoGenerateInputSchema,
} from './schemas/speedpaint-schemas'

const DEFAULT_FPS = 12
const DEFAULT_SKETCH_DURATION = 10
const DEFAULT_COLOR_FILL_DURATION = 2

type SpeedpaintVideoGenerateOutput =
  | { task_id: string; video_url: string }
  | { error: string }
const TOOL_ID = 'speedpaint-video-generate'

export const speedpaintVideoGenerateTool = createTool({
  id: TOOL_ID,
  description: SPEEDPAINT_TOOL_DESCRIPTION,
  inputSchema: speedpaintVideoGenerateInputSchema,
  execute: async (context): Promise<SpeedpaintVideoGenerateOutput> => {
    const { context: input, resourceId, threadId, runId } = context
    const { image_path, duration_seconds, output } = input

    const convex = new ConvexHttpClient(env.value.CONVEX_URL)

    // 创建 Convex 任务记录 - 生成过程开始就创建
    const convexTaskId = await convex.mutation(api.tasks.createTask, {
      threadId: threadId || 'default',
      resourceId: resourceId || 'default',
      runId,
      toolId: TOOL_ID,
      assetType: 'video',
      provider: 'a1d',
      input: {
        image_path,
        duration_seconds,
        output,
      },
    })

    try {
      // 从 Convex VFS 读取源图片文件
      const imageFile = await convex.query(api.vfs.readFile, {
        threadId: threadId || 'default',
        path: image_path,
      })

      if (!imageFile) {
        throw new Error(`Image file not found: ${image_path}`)
      }

      // 检查 contentType 必须存在
      invariant(
        imageFile.contentType,
        `Image file must have contentType: ${image_path}`,
      )

      // 从 metadata 获取图片 URL
      invariant(
        imageFile.metadata?.image_url,
        `Image file must have image_url in metadata: ${image_path}`,
      )

      const imageUrl = imageFile.metadata.image_url as string

      // 验证是 HTTP URL
      if (!imageUrl.startsWith('http')) {
        throw new Error('Image URL must be an HTTP URL')
      }

      // 更新为生成中状态
      await convex.mutation(api.tasks.updateTaskProgress, {
        taskId: convexTaskId,
        progress: 0,
        status: 'generating',
      })

      let speedpainterTaskId: string | null = null

      // 使用流式接口生成视频
      const videoStream = generateSpeedpainterVideoStream({
        imageUrl,
        mimeType: imageFile.contentType,
        sketchDuration: Math.max(
          duration_seconds - DEFAULT_COLOR_FILL_DURATION,
          DEFAULT_SKETCH_DURATION,
        ),
        colorFillDuration: DEFAULT_COLOR_FILL_DURATION,
        source: 'api',
        needCanvas: true,
        canvasTitle: 'whiteboard',
        needHand: true,
        handTitle: 'drawing hand',
        needFadeout: false,
        fps: DEFAULT_FPS,
        onSubmit: ({ taskId }) => {
          speedpainterTaskId = taskId
          // 记录任务已提交
          convex.mutation(api.tasks.addTaskEvent, {
            taskId: convexTaskId,
            eventType: 'progress_update',
            data: {
              speedpainterTaskId: taskId,
              message: 'SpeedPainter task submitted',
            },
          })
        },
      })

      // 订阅流，更新进度
      const finalResult = await firstValueFrom(
        videoStream.pipe(
          // 为每个状态更新记录事件
          tap(async (result: SpeedpainterJobResult) => {
            await convex.mutation(api.tasks.addTaskEvent, {
              taskId: convexTaskId,
              eventType: 'progress_update',
              data: result,
            })
          }),
        ),
      )

      // 检查最终结果
      if (finalResult.status !== 'FINISHED') {
        const error =
          finalResult.status === 'ERROR' && 'error' in finalResult
            ? finalResult.error
            : 'Task failed or was cancelled'
        throw new Error(error)
      }

      // 构建 R2 key：threadId 作为前缀 + output.path（去掉前导斜杠）
      const pathWithoutSlash = output.path.startsWith('/')
        ? output.path.substring(1)
        : output.path
      const r2Key = `${threadId || 'default'}/${pathWithoutSlash}`

      // 使用自定义 action 保存视频到 R2
      const r2Result = await convex.action(api.speedpaint.saveVideoToR2, {
        videoUrl: finalResult.videoUrl,
        r2Key,
      })

      // 创建公开访问 URL
      const publicUrl = createCloudflareR2Url({
        bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
        key: r2Key,
      })

      // 最终更新任务为完成
      await convex.mutation(api.tasks.updateTaskProgress, {
        taskId: convexTaskId,
        progress: 100,
        status: 'completed',
        output: {
          file_path: output.path,
          task_id: convexTaskId,
          video_url: publicUrl,
          original_video_url: finalResult.videoUrl,
          sketch_image_url: finalResult.sketchImageUrl,
          r2_key: r2Key,
          r2_url: r2Result.url,
          file_size: r2Result.size,
        },
      })

      await convex.mutation(api.tasks.addTaskEvent, {
        taskId: convexTaskId,
        eventType: 'task_completed',
        data: { message: 'Video generation completed successfully' },
      })

      // 在 VFS 中创建文件记录，content 为空字符串，metadata 存储完整信息
      await convex.mutation(api.vfs.writeFile, {
        threadId: threadId || 'default',
        path: output.path,
        content: '', // 空字符串，实际文件在 R2
        contentType: 'video/mp4',
        description:
          output.description || `SpeedPaint video generated from ${image_path}`,
        metadata: {
          // 视频 URLs
          video_url: publicUrl, // 公开访问 URL
          original_video_url: finalResult.videoUrl, // SpeedPainter 原始 URL
          sketch_image_url: finalResult.sketchImageUrl, // 草图 URL
          r2_signed_url: r2Result.signedUrl, // R2 签名 URL（临时）

          // 任务信息
          speedpainter_task_id: speedpainterTaskId || finalResult.taskId,
          convex_task_id: convexTaskId,

          // 文件信息
          r2_key: r2Key,
          file_size: r2Result.size,

          // 生成参数
          source_image_path: image_path,
          duration_seconds: duration_seconds,

          // 时间戳
          generated_at: new Date().toISOString(),
        },
        size: r2Result.size,
      })

      return {
        task_id: speedpainterTaskId || finalResult.taskId,
        video_url: publicUrl,
      }
    } catch (error) {
      // 更新任务为失败状态
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      try {
        await convex.mutation(api.tasks.updateTaskProgress, {
          taskId: convexTaskId,
          progress: 0,
          status: 'failed',
          error: errorMessage,
        })

        await convex.mutation(api.tasks.addTaskEvent, {
          taskId: convexTaskId,
          eventType: 'error_occurred',
          error: errorMessage,
        })
      } catch (convexError) {
        // 忽略 Convex 错误
      }

      return {
        error: errorMessage,
      }
    }
  },
})
