import { z } from 'zod'

import { fileDescriptorSchema } from '../system-tools'

export const kontextImageEditInputSchema = z.object({
  model: z.enum(['pro', 'max']).describe('Model to use'),
  image_path: z.string().describe('Input image file path'),
  prompt: z.string(),
  output: fileDescriptorSchema,
})

export const kontextImageEditOutputSchema = z.object({
  success: z.boolean(),
  result: z.object({
    id: z.string(),
    edited_image_path: z.string(),
    original_image_path: z.string(),
    edit_prompt: z.string(),
    model_used: z.string(),
  }),
  error: z.string().optional(),
})

export const KONTEXT_TOOL_DESCRIPTION = 'Edit images using Kontext AI'
