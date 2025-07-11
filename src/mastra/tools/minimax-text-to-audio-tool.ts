import { createTool } from '@mastra/core/tools'

import {
  MINIMAX_TOOL_DESCRIPTION,
  minimaxTextToAudioInputSchema,
  minimaxTextToAudioOutputSchema,
} from './schemas/minimax-schemas'

export const minimaxTextToAudioTool = createTool({
  id: 'minimax-text-to-audio',
  description: MINIMAX_TOOL_DESCRIPTION,
  inputSchema: minimaxTextToAudioInputSchema,
  outputSchema: minimaxTextToAudioOutputSchema,
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
