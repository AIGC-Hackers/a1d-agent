import { createTool } from '@mastra/core/tools'

import {
  KONTEXT_TOOL_DESCRIPTION,
  kontextImageEditInputSchema,
  kontextImageEditOutputSchema,
} from './schemas/kontext-schemas'

export const kontextImageEditTool = createTool({
  id: 'kontext-image-edit',
  description: KONTEXT_TOOL_DESCRIPTION,
  inputSchema: kontextImageEditInputSchema,
  outputSchema: kontextImageEditOutputSchema,
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
