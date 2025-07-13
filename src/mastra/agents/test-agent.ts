import { openrouter } from '@/integration/openrouter'
import { Agent, createTool } from '@mastra/core'
import { Memory } from '@mastra/memory'
import { streamText } from 'ai'
import { z } from 'zod'

const toolcallStreamTool = createTool({
  id: 'toolcall-stream',
  description: 'write stream in toolcall',
  inputSchema: z.object({
    text: z.string(),
  }),
  execute: async ({ context, runId }) => {
    const { text } = context

    const response = streamText({
      prompt: 'hello',
      model: openrouter('openai/gpt-4.1'),
    })

    for await (const chunk of response.textStream) {
      console.log(chunk)
    }

    response.consumeStream({
      onError(error) {
        console.error(error)
      },
    })

    return {
      text,
    }
  },
})

export const testAgent = new Agent({
  name: 'Test agent',
  description: 'Develop and test agent functionality',
  instructions:
    'you are a test agent, Complete agent functionality testing according to user instructions. You can generate images using the mock-image-generate tool for testing real-time event streams.',
  model: openrouter('openai/gpt-4.1'),
  tools: {
    stream: toolcallStreamTool,
  },
  memory: new Memory(),
})
