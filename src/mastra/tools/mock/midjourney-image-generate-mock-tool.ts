import { createHash } from 'crypto'
import { createTool } from '@mastra/core/tools'
import { ulid } from 'ulid'
import { z } from 'zod'

import {
  MIDJOURNEY_TOOL_DESCRIPTION,
  midjourneyImageGenerateInputSchema,
  midjourneyImageGenerateOutputSchema,
} from '../schemas/midjourney-schemas'

// 模拟图片文件路径
const mockImageFiles = [
  'assets/images/p1.jpg',
  'assets/images/p2.jpg',
  'assets/images/p3.jpg',
]

// 延迟函数
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const midjourneyImageGenerateMockTool = createTool({
  id: 'midjourney-image-generate',
  description: `${MIDJOURNEY_TOOL_DESCRIPTION} (Mock version)`,
  inputSchema: midjourneyImageGenerateInputSchema,
  outputSchema: midjourneyImageGenerateOutputSchema,
  execute: async (context) => {
    const { context: input } = context

    // 模拟 3 秒延迟
    await delay(3000)

    // 基于 prompt 生成 hash 来选择不同的图片文件
    const promptHash = createHash('md5').update(input.prompt).digest('hex')
    const hashIndex = parseInt(promptHash.charAt(0), 16) % mockImageFiles.length
    const selectedImageFile = mockImageFiles[hashIndex]

    // 生成模拟的 ID
    const jobId = `mock-${ulid()}`
    const imageId = ulid()

    console.log(`[Mock Midjourney] Generated image for prompt:`)
    console.log(`  Prompt: ${input.prompt.substring(0, 50)}...`)
    console.log(`  Mock file: ${selectedImageFile}`)
    console.log(`  Job ID: ${jobId}`)
    console.log(`  Output path: ${input.output.path}`)

    // 基于 output 路径生成文件路径
    const basePath = input.output.path.replace(/\.[^/.]+$/, '') // 移除扩展名

    // 返回模拟的成功结果（模拟 Midjourney 返回的 4 张图片）
    const mockResults = Array.from({ length: 4 }, (_, index) => ({
      id: `${imageId}-${index + 1}`,
      resource_id: undefined,
      job_id: jobId,
      file_name: `mock-image-${index + 1}.jpg`,
      file_size: 1024 * 1024 * (1 + Math.random() * 2), // 1-3MB
      key: `${basePath}-${index + 1}.jpg`,
    }))

    return {
      success: true,
      result: mockResults,
    }
  },
})
