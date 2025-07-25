import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export type MidjourneyVideoGenerateOutput =
  | {
      // TODO
    }
  | {
      error: string
    }

export const midjourneyVideoGenerateTool = createTool({
  id: 'midjourney-video-generate',
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
  execute: async ({
    context: input,
    resourceId,
    threadId,
    runtimeContext,
    runId,
  }): Promise<MidjourneyVideoGenerateOutput> => {
    throw new Error('Not implemented')
  },
})
