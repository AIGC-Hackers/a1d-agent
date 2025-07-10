import { z } from 'zod'

import { fileDescriptorSchema } from '../system-tools'

export const midjourneyImageGenerateInputSchema = z.object({
  prompt: z.string(),
  output: fileDescriptorSchema.describe(
    'VFS path prefix for images (generates 4 images with -1 to -4 suffix)',
  ),
})

export const midjourneyImageGenerateOutputSchema = z.object({
  success: z.boolean(),
  result: z.array(
    z.object({
      id: z.string(),
      resource_id: z.string().optional(),
      job_id: z.string(),
      file_name: z.string().optional(),
      file_size: z.number(),
      key: z.string(),
    }),
  ),
  error: z.string().optional(),
})

export const MIDJOURNEY_TOOL_DESCRIPTION = 'Generate images using Midjourney'
