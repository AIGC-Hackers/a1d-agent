import { createHash } from 'crypto'
import { createTool } from '@mastra/core/tools'

import {
  MINIMAX_TOOL_DESCRIPTION,
  minimaxTextToAudioInputSchema,
  minimaxTextToAudioOutputSchema,
} from '../schemas/minimax-schemas'

// 模拟音频文件路径
const mockAudioFiles = [
  'assets/audios/1.mp3',
  'assets/audios/2.mp3',
  'assets/audios/3.mp3',
]

// 模拟不同文本的音频时长（秒）
const mockDurations = [10, 15, 20, 25, 30]

// 延迟函数
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const minimaxTextToAudioMockTool = createTool({
  id: 'minimax-text-to-audio',
  description: `${MINIMAX_TOOL_DESCRIPTION} (Mock version)`,
  inputSchema: minimaxTextToAudioInputSchema,
  outputSchema: minimaxTextToAudioOutputSchema,
  execute: async ({ context: input }) => {
    // 模拟 3 秒延迟
    await delay(3000)

    // 基于文本生成 hash 来选择不同的音频文件
    const textHash = createHash('md5').update(input.text).digest('hex')
    const hashIndex = parseInt(textHash.charAt(0), 16) % mockAudioFiles.length
    const selectedAudioFile = mockAudioFiles[hashIndex]

    // 基于文本长度估算音频时长
    const wordsPerMinute = 150
    const wordCount = input.text.split(/\s+/).length
    const estimatedDuration = Math.ceil((wordCount / wordsPerMinute) * 60)

    // 选择一个接近估算时长的模拟时长
    const duration = mockDurations.reduce((prev, curr) =>
      Math.abs(curr - estimatedDuration) < Math.abs(prev - estimatedDuration)
        ? curr
        : prev,
    )

    console.log(
      `[Mock Text-to-Audio] Generated audio for text (${wordCount} words):`,
    )
    console.log(`  Voice: ${input.voice}`)
    console.log(`  Mock file: ${selectedAudioFile}`)
    console.log(`  Duration: ${duration} seconds`)
    console.log(`  Output path: ${input.output.path}`)

    return {
      file_path: input.output.path,
      duration_seconds: duration,
    }
  },
})
