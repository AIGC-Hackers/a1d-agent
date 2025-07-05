import { sendEvent } from '@/server/event/publish'
import { createTool } from '@mastra/core'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

const MidjourneyImageGenerateInputSchema = z.object({
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

type MidjourneyImageGenerateInput = z.infer<
  typeof MidjourneyImageGenerateInputSchema
>

export const midjourneyImageGenerateTool = createTool({
  id: 'midjourney-image-generate',
  description:
    'Creates a static image for a scene or shot. Call this tool when your `plan.md` indicates that an image asset needs to be created for a specific shot.',
  inputSchema: MidjourneyImageGenerateInputSchema,
  outputSchema: z.object({
    status: z.string(),
    file_path: z.string(),
  }),
  execute: async ({ context: input, resourceId, threadId, runId }) => {
    if (resourceId) {
      void sendEvent('a1d-agent-toolcall', {
        contentType: 'application/json',
        body: {
          resourceId,
          threadId,
          runId,
          model: 'midjourney',
          provider: '302',
          input,
        },
      })
    }

    return generateImage(input, { mock: true })
  },
})

function generateImage(
  input: MidjourneyImageGenerateInput,
  settings?: {
    mock?: boolean
    provider?: 'wavespeed' | '302' | 'huiyan'
  },
) {
  if (settings?.mock) {
    return {
      file_path: input.output.path,
      status: 'success',
    }
  }

  // TODO: implement
  return {
    file_path: input.output.path,
    status: 'success',
  }
}
