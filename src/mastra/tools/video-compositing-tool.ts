import { createTool } from '@mastra/core'
import { z } from 'zod'

const example = {
  videoLayer: [
    {
      id: '1',
    },
    {
      id: '2',
      transition: {
        in: {
          type: 'fade',
          duration: 3,
        },
      },
    },
  ],

  audioLayer: [
    {
      id: '1',
    },
    {
      id: '2',
      transition: {
        out: {
          type: 'fade',
          duration: 3,
        },
      },
    },
  ],
}

export const videoCompositionTool = createTool({
  id: 'synthesize-video',
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
