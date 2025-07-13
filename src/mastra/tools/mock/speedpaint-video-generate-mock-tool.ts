import { createHash } from 'crypto'
import { createTool } from '@mastra/core/tools'
import { ulid } from 'ulid'

import {
  SPEEDPAINT_TOOL_DESCRIPTION,
  speedpaintVideoGenerateInputSchema,
} from '../speedpaint-video-generate-tool'

// 模拟视频文件路径
const mockVideoFiles = [
  'assets/videos/1.mp4',
  'assets/videos/2.mp4',
  'assets/videos/3.mp4',
]

// 延迟函数
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 模拟任务状态
interface MockTask {
  taskId: string
  status: 'WAITING' | 'PROCESSING' | 'FINISHED' | 'ERROR'
  videoUrl?: string
  sketchImageUrl?: string
  error?: string
  createdAt: number
}

// 存储模拟任务（实际应用中会使用数据库）
const mockTasks = new Map<string, MockTask>()

export const speedpaintVideoGenerateMockTool = createTool({
  id: 'speedpaint-video-generate',
  description: `${SPEEDPAINT_TOOL_DESCRIPTION} (Mock version)`,
  inputSchema: speedpaintVideoGenerateInputSchema,
  execute: async ({ context: input }) => {
    // 生成任务ID
    const taskId = `mock-task-${ulid()}`

    // 创建模拟任务
    const task: MockTask = {
      taskId,
      status: 'WAITING',
      createdAt: Date.now(),
    }
    mockTasks.set(taskId, task)

    console.log(`[Mock Speedpaint] Creating video for:`)
    console.log(`  Image: ${input.image_path}`)
    console.log(`  Duration: ${input.duration_seconds} seconds`)
    console.log(`  Task ID: ${taskId}`)

    // 模拟异步处理
    setTimeout(async () => {
      // 更新为处理中
      task.status = 'PROCESSING'

      // 再等待一段时间
      await delay(2000)

      // 基于图片路径生成 hash 来选择不同的视频文件
      const pathHash = createHash('md5').update(input.image_path).digest('hex')
      const hashIndex = parseInt(pathHash.charAt(0), 16) % mockVideoFiles.length
      const selectedVideoFile = mockVideoFiles[hashIndex]

      // 更新为完成
      task.status = 'FINISHED'
      task.videoUrl = selectedVideoFile
      task.sketchImageUrl = input.image_path // 使用输入的图片作为草图

      console.log(`[Mock Speedpaint] Task ${taskId} completed:`)
      console.log(`  Mock video: ${selectedVideoFile}`)
    }, 1000)

    // 立即返回，模拟异步任务创建
    await delay(3000) // 初始创建任务的延迟

    return {
      file_path: input.output.path,
      task_id: taskId,
    }
  },
})

// 辅助函数：获取任务状态（供其他工具使用）
export function getMockTaskStatus(taskId: string): MockTask | undefined {
  return mockTasks.get(taskId)
}
