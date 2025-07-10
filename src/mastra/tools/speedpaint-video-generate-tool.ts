import { createTool } from '@mastra/core/tools'

import {
  SPEEDPAINT_TOOL_DESCRIPTION,
  speedpaintVideoGenerateInputSchema,
  speedpaintVideoGenerateOutputSchema,
} from './schemas/speedpaint-schemas'

export const speedpaintVideoGenerateTool = createTool({
  id: 'speedpaint-video-generate',
  description: SPEEDPAINT_TOOL_DESCRIPTION,
  inputSchema: speedpaintVideoGenerateInputSchema,
  outputSchema: speedpaintVideoGenerateOutputSchema,
  execute: async ({ context: input }) => {
    throw new Error('Not implemented')
  },
})
