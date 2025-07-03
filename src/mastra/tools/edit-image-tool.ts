import { createTool } from '@mastra/core'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const editImageTool = createTool({
  id: 'edit-image',
  description: 'Edit an image',
  inputSchema: z.object({
    image: z.string().describe('File path, example: "/character/1.png"'),
    prompt: z.string(),
    output: fileDescriptorSchema,
  }),
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
