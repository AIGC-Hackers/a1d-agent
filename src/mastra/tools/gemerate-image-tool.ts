import { createTool } from '@mastra/core'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

const GenerateImageInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A detailed text description of the image content. This should be derived from the `storyboard.md`.',
    ),
  style: z
    .string()
    .describe(
      'The visual style for the image, which should be consistent with the `style` defined in `project.md`.',
    ),
  output: fileDescriptorSchema.describe(
    'The exact VFS path where the image must be saved, following the structure `scenes/scene-XX/shot-YY/image-ZZ.png`.',
  ),
})

export const generateImageTool = createTool({
  id: 'generate-image',
  description:
    'Creates a static image for a scene or shot. Call this tool when your `plan.md` indicates that an image asset needs to be created for a specific shot.',
  inputSchema: GenerateImageInputSchema,
  outputSchema: z.object({
    file_path: z.string().describe('The VFS path of the newly created image.'),
  }),
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})

export const generateImageBatchTool = createTool({
  id: 'generate-image-batch',
  description: 'Generatea batch of images',
  inputSchema: GenerateImageInputSchema.array(),
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
