import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const speedpaintVideoGenerateTool = createTool({
  id: 'speedpaint-video-generate',
  description:
    'Creates a hand-drawn animation video clip from a static image. Prerequisite: You can ONLY call this tool for a shot AFTER you have successfully generated both the source image and the narration audio for that same shot.',
  inputSchema: z.object({
    image_path: z
      .string()
      .describe(
        'The VFS path to the source image for this shot (e.g., `scenes/scene-01/shot-01/image-01.png`).',
      ),
    duration_seconds: z
      .number()
      .describe(
        'The duration of the resulting video. This value MUST be the `duration_seconds` returned by the `generate_audio` call for the same shot.',
      ),
    output: fileDescriptorSchema.describe(
      'The exact VFS path for the video clip: `scenes/scene-XX/shot-YY/speedpaint.mp4`.',
    ),
  }),
  outputSchema: z.object({
    file_path: z.string().describe('The VFS path of the generated video clip.'),
  }),
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
