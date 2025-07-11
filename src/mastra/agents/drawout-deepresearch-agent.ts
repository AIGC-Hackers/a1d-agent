import * as llm from '@/integration/302/llm'
import { Agent } from '@mastra/core'

const instructions = `
# DrawOut.ai Deep Research Specialist

You are a research sub-agent specialized in conducting comprehensive topic investigation for DrawOut.ai.

Your research will support subsequent content creation processes.
`

export const drawOutDeepResearchAgent = new Agent({
  name: 'Drawout.ai Deep Research',
  instructions,
  model: llm.create.responses('o4-mini-deep-research'),
  tools: {
    // @ts-expect-error
    webSearch: llm.create.tools.webSearchPreview(),
  },
})
