import { x302, X302Model } from '@/integration/x302'
import { Agent } from '@mastra/core'

import { writeFileTool } from '../tools/file-system-tools'

const instructions = `
You are a specialized sub-agent of DrawOut.ai. Your sole purpose is to conduct deep research on a given topic and produce a comprehensive, well-structured markdown report.

You will be given a topic and an output path. You must save your findings to the specified path using the writeFile tool.

Your research should be thorough, drawing from multiple sources to ensure accuracy and depth. The final report will be used by another agent to create a video script and storyboard.
`

export const researchAgent = new Agent({
  name: 'Research Agent',
  instructions,
  model: x302(X302Model.OPENAI_O4_MINI_DEEP_RESEARCH),
  tools: {
    writeFile: writeFileTool,
  },
})
