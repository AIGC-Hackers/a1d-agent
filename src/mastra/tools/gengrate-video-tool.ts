import { createTool } from '@mastra/core'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const generateVideoTool = createTool({
  id: 'generate-video',
  description: 'Generate a video',
  inputSchema: z.object({
    referenceImages: z
      .array(z.string())
      .max(2)
      .optional()
      .describe('File paths, example: ["character/1.png", "character/2.png"]'),
    instructions: z.string().describe('Instructions for the video'),
    duration: z
      .enum(['5s', '10s'])
      .describe('Duration of the video in seconds'),
    output: fileDescriptorSchema,
  }),
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
