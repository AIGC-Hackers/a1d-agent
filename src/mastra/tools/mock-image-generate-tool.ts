import type { Id } from '@/convex/_generated/dataModel'
import { api } from '@/convex/_generated/api'
import { env } from '@/lib/env'
import { createTool } from '@mastra/core'
import { ConvexClient } from 'convex/browser'
import { map, Observable, takeWhile, tap, timer } from 'rxjs'
import { ulid } from 'ulid'
import { z } from 'zod'

type ProgressStage = {
  progress: number
  status: 'started' | 'generating' | 'completed'
  eventType:
    | 'task_started'
    | 'progress_update'
    | 'image_preview'
    | 'task_completed'
  description: string
  imageUrl?: string
}

const progressStages: ProgressStage[] = [
  {
    progress: 0,
    status: 'started',
    eventType: 'task_started',
    description: '开始生图任务',
  },
  {
    progress: 30,
    status: 'generating',
    eventType: 'image_preview',
    description: '生成模糊图像',
    imageUrl: 'https://picsum.photos/512/512?blur=10&random=1',
  },
  {
    progress: 70,
    status: 'generating',
    eventType: 'image_preview',
    description: '图像变清晰',
    imageUrl: 'https://picsum.photos/512/512?blur=3&random=2',
  },
  {
    progress: 100,
    status: 'completed',
    eventType: 'task_completed',
    description: '图像生成完成',
    imageUrl: 'https://picsum.photos/512/512?random=3',
  },
]

function createMockImageGenerationStream(
  taskId: Id<'task'>,
  convexClient: ConvexClient,
): Observable<ProgressStage> {
  let currentStageIndex = 0

  return timer(0, 1500).pipe(
    // 每1.5秒一个阶段
    map(() => progressStages[currentStageIndex++]),
    takeWhile((stage) => stage.progress <= 100),
    tap(async (stage) => {
      // 更新任务进度
      await convexClient.mutation(api.tasks.updateTaskProgress, {
        taskId,
        progress: stage.progress,
        status: stage.status,
        output:
          stage.progress === 100
            ? {
                imageUrl: stage.imageUrl,
                description: stage.description,
              }
            : undefined,
      })

      // 添加事件
      await convexClient.mutation(api.tasks.addTaskEvent, {
        taskId,
        eventType: stage.eventType,
        progress: stage.progress,
        data: {
          description: stage.description,
          imageUrl: stage.imageUrl,
        },
      })

      console.log(
        `📸 Mock Image Generation: ${stage.progress}% - ${stage.description}`,
      )
    }),
  )
}

export const mockImageGenerateTool = createTool({
  id: 'mock-image-generate',
  description: '模拟生成图像的长任务工具，用于测试实时事件流',
  inputSchema: z.object({
    prompt: z.string().describe('图像生成提示词'),
    style: z.string().optional().describe('图像风格'),
    size: z.string().optional().default('512x512').describe('图像尺寸'),
  }),
  execute: async ({ context, runId }) => {
    const { prompt, style, size } = context

    // 获取线程和资源 ID（从 context 或 runId 推导）
    const threadId = runId || ulid()
    const resourceId = threadId // 简化处理

    // 初始化 Convex 客户端
    const convexClient = new ConvexClient(env.value.CONVEX_URL)

    console.log('🚀 Starting mock image generation:', prompt)

    try {
      // 创建任务
      const taskId = await convexClient.mutation(api.tasks.createTask, {
        threadId,
        resourceId,
        runId,
        toolId: 'mock-image-generate',
        assetType: 'image',
        provider: 'mock-provider',
        input: { prompt, style, size },
      })

      console.log('📋 Created task:', taskId)

      // 创建并启动模拟流
      const generationStream = createMockImageGenerationStream(
        taskId,
        convexClient,
      )

      // 执行流并等待完成
      await new Promise<void>((resolve, reject) => {
        generationStream.subscribe({
          next: (stage) => {
            console.log(`Progress: ${stage.progress}%`)
          },
          complete: () => {
            console.log('✅ Mock image generation completed')
            resolve()
          },
          error: (error) => {
            console.error('❌ Mock image generation failed:', error)
            reject(error)
          },
        })
      })

      // 返回最终结果
      return {
        success: true,
        taskId,
        imageUrl: progressStages[progressStages.length - 1].imageUrl,
        description: '模拟图像生成成功完成',
        prompt,
        style,
        size,
      }
    } catch (error) {
      console.error('❌ Tool execution failed:', error)
      throw error
    }
  },
})
