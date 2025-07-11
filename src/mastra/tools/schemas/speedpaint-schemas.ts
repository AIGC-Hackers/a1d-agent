import { z } from 'zod'

import { fileDescriptorSchema } from '../system-tools'

export const speedpaintVideoGenerateInputSchema = z.object({
  image_path: z.string().describe('VFS path to source image'),
  duration_seconds: z.number().describe('Duration from audio file'),
  output: fileDescriptorSchema.describe('VFS path for video clip'),
})

export const speedpaintVideoGenerateOutputSchema = z.object({
  file_path: z.string().describe('VFS path of generated video'),
  task_id: z.string().optional(),
})

export const SPEEDPAINT_TOOL_DESCRIPTION =
  'Generate speedpaint animation from image'
