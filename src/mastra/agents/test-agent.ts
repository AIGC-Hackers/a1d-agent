import { openrouter } from '@/integration/openrouter'
import { xai } from '@/integration/xai'
import { Agent, createTool } from '@mastra/core'
import { Memory } from '@mastra/memory'
import { formatDataStreamPart, streamText } from 'ai'
import { ulid } from 'ulid'
import { z } from 'zod'

import { mockImageGenerateTool } from '@/mastra/tools/mock-image-generate-tool'

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

    const id = ulid()

    const data = formatDataStreamPart('tool_call_streaming_start', {
      toolCallId: runId ?? id,
      toolName: 'toolcallStreamTool',
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
    mockImageGenerate: mockImageGenerateTool,
  },
  memory: new Memory(),
})
