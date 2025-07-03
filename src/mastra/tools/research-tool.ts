import { streamContext } from '@/lib/context'
import { createTool } from '@mastra/core'
import { DataUIPart } from 'ai'
import { z } from 'zod'

export const researchTool = createTool({
  id: 'research',
  description:
    'Conducts in-depth research on a given topic to gather facts, data, and narratives for the video content. Use this tool early in the process to gather information for the storyboard.',
  inputSchema: z.object({
    topic: z.string().describe('The subject or question to be researched.'),
    output_path: z
      .string()
      .describe(
        'The VFS path for the research report, e.g., `research/photosynthesis-report.md`.',
      ),
  }),
  outputSchema: z.object({
    file_path: z
      .string()
      .describe('The VFS path of the generated Markdown research report.'),
  }),
  execute: async ({ context: input, mastra, runtimeContext }) => {
    const stream = streamContext.use()

    throw new Error('Not implemented')
  },
})
