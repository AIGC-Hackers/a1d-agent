import { createHash } from 'crypto'
import { createTool } from '@mastra/core/tools'

import {
  KONTEXT_TOOL_DESCRIPTION,
  kontextTextToImageInputSchema,
} from '../kontext-text-to-image-tool'

// 模拟图片文件路径
const mockImageFiles = [
  'assets/images/i1.jpg',
  'assets/images/i2.jpg',
  'assets/images/i3.jpg',
  'assets/images/i4.jpg',
]

// 延迟函数
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const kontextTextToImageMockTool = createTool({
  id: 'kontext-text-to-image',
  description: `${KONTEXT_TOOL_DESCRIPTION} (Mock version)`,
  inputSchema: kontextTextToImageInputSchema,
  execute: async ({ context: input }) => {
    // 模拟 3-5 秒延迟（图片生成通常较慢）
    const generationTime = 3000 + Math.random() * 2000
    await delay(generationTime)

    // 基于 prompt 生成 hash 来选择不同的图片文件
    const promptHash = createHash('md5').update(input.prompt).digest('hex')
    const hashIndex = parseInt(promptHash.charAt(0), 16) % mockImageFiles.length
    const selectedImageFile = mockImageFiles[hashIndex]

    console.log(`[Mock Kontext Text-to-Image] Generated image:`)
    console.log(`  Prompt: ${input.prompt.substring(0, 50)}...`)
    console.log(`  Aspect ratio: ${input.aspectRatio}`)
    console.log(`  Mock file: ${selectedImageFile}`)
    console.log(`  Output path: ${input.output.path}`)

    // 根据宽高比计算模拟尺寸
    const aspectRatios: Record<string, { width: number; height: number }> = {
      '21:9': { width: 1344, height: 576 },
      '16:9': { width: 1344, height: 768 },
      '4:3': { width: 1024, height: 768 },
      '3:2': { width: 1216, height: 832 },
      '1:1': { width: 1024, height: 1024 },
      '2:3': { width: 832, height: 1216 },
      '3:4': { width: 768, height: 1024 },
      '9:16': { width: 768, height: 1344 },
      '9:21': { width: 576, height: 1344 },
    }

    const dimensions = aspectRatios[input.aspectRatio] || {
      width: 1024,
      height: 1024,
    }

    return {
      prompt: input.prompt,
      files: [input.output.path],
      width: dimensions.width,
      height: dimensions.height,
    }
  },
})
