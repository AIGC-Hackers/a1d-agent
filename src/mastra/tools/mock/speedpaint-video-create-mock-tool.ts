import { createHash } from 'crypto'
import { createTool } from '@mastra/core/tools'
import { ulid } from 'ulid'
import { z } from 'zod'

import { fileDescriptorSchema } from '../system-tools'

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

export const speedpaintVideoCreateMockTool = createTool({
  id: 'speedpaint-video-create',
  description:
    'Creates a hand-drawn animation video clip from a static image. Prerequisite: You can ONLY call this tool for a shot AFTER you have successfully generated both the source image and the narration audio for that same shot.',
  inputSchema: z.object({
    image_path: z
      .string()
      .describe(
        'The VFS path to the source image for this shot (e.g., `scenes/scene-01/shot-01/image-01.png`).',
      ),
    duration_seconds: z
      .number()
      .describe(
        'The duration of the resulting video. This value MUST be the `duration_seconds` returned by the `generate_audio` call for the same shot.',
      ),
    output: fileDescriptorSchema.describe(
      'The exact VFS path for the video clip: `scenes/scene-XX/shot-YY/speedpaint.mp4`.',
    ),
  }),
  outputSchema: z.object({
    file_path: z.string().describe('The VFS path of the generated video clip.'),
    task_id: z
      .string()
      .optional()
      .describe('The task ID for tracking the generation process.'),
  }),
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
