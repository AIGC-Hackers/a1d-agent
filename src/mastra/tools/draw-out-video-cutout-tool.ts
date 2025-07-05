import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const drawOutVideoCutoutTool = createTool({
  id: 'draw-out-video-cutout',
  description:
    'Assembles all the generated video clips and audio files into the final video. Prerequisite: You can ONLY call this tool after `composition.md` has been created and all other tasks in `plan.md` are complete.',
  inputSchema: z.object({
    composition_path: z
      .string()
      .describe('The VFS path to the `composition.md` file.'),
  }),
  outputSchema: z.object({
    file_path: z
      .string()
      .describe(
        'The VFS path to the final, complete video, which should be located in the `/final/` directory.',
      ),
  }),
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
