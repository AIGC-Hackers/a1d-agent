import { createTool } from '@mastra/core'
import { z } from 'zod'

import { fileDescriptorSchema } from './system-tools'

export const minimaxTextToAudioTool = createTool({
  id: 'minimax-text-to-audio',
  description:
    'Creates a narration audio file for a shot. Call this tool when your `plan.md` requires you to generate the voiceover for a specific shot.',
  inputSchema: z.object({
    text: z
      .string()
      .describe(
        'The narration script for the shot, taken directly from `storyboard.md`.',
      ),
    voice: z.string().describe('The voice style to use for the narration.'),
    output: fileDescriptorSchema.describe(
      'The exact VFS path for the audio file: `scenes/scene-XX/shot-YY/narration.mp3`.',
    ),
  }),
  outputSchema: z.object({
    file_path: z.string(),
    duration_seconds: z.number(),
  }),
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
