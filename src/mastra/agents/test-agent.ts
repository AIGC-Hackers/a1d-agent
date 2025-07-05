import { openrouter } from '@/integration/openrouter'
import { streamContext } from '@/lib/context'
import { Agent, createTool } from '@mastra/core'
import { Memory } from '@mastra/memory'
import { formatAssistantStreamPart, formatDataStreamPart, streamText } from 'ai'
import { ulid } from 'ulid'
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
      model: openrouter('x-ai/grok-3-mini'),
    })

    const writer = streamContext.use()

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
    'you are a test agent,Complete agent functionality testing according to user instructions.',
  model: openrouter('x-ai/grok-3-mini'),
  tools: { stream: toolcallStreamTool },
  memory: new Memory(),
})
