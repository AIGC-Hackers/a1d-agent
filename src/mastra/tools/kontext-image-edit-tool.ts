import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const kontextImageEditInputSchema = z.object({
  model: z.enum(['pro', 'max']).describe('Model to use'),
  image_path: z.string().describe('Input image file path'),
  prompt: z.string(),
  output: fileDescriptorSchema,
})

export type KontextImageEditOutput =
  | {
      id: string
      edited_image_path: string
      original_image_path: string
      edit_prompt: string
      model_used: string
    }
  | { error: string }

export const KONTEXT_TOOL_DESCRIPTION = 'Edit images using Kontext AI'

export const kontextImageEditTool = createTool({
  id: 'kontext-image-edit',
  description: KONTEXT_TOOL_DESCRIPTION,
  inputSchema: kontextImageEditInputSchema,
  execute: async ({
    context: input,
    resourceId,
    threadId,
    runtimeContext,
    runId,
  }) => {
    throw new Error('Not implemented')
  },
})
