import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

const KontextImageEditInputSchema = z.object({
  model: z.enum(['pro', 'max']).describe('The model to use'),
  image: z.string().describe('File path, example: "/character/1.png"'),
  prompt: z.string(),
  output: fileDescriptorSchema,
})

export const kontextImageEditTool = createTool({
  id: 'kontext-image-edit',
  description: 'Edit an image',
  inputSchema: KontextImageEditInputSchema,
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
