import { createDeepResearch } from '@/integration/302/llm'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const drawoutDeepResearchTool = createTool({
  id: 'drawout-deepresearch',
  description: 'Use Drawout.ai to conduct deep research on a given topic',
  inputSchema: z.object({
    instructions: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const { instructions } = context

    const response = await createDeepResearch({
      prompt: instructions,
      model: 'o4-mini-deep-research',
    })

    let text = ''
    let reasoning = ''

    const source: { title: string; url: string }[] = []

    for await (const chunk of response) {
      switch (chunk.type) {
        case 'response.output_text.delta': {
          text += chunk.delta
          break
        }
        case 'response.reasoning.delta': {
          reasoning += chunk.delta
          break
        }
      }
    }

    return {
      success: true,
      data: {
        llm_response: text,
        llm_reasoning: reasoning,
        source,
      },
    }
  },
})
