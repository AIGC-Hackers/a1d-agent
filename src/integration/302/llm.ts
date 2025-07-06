import { inspect } from 'node:util'
import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'
import { OpenAPIToolset } from '@mastra/core'
import { stream } from 'fetch-event-stream'
import { OpenAI } from 'openai'

import { baseUrl } from './config'

export type Model =
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'gpt-4o-image-generation'
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'gpt-4.1-nano'
  | 'o4-mini'
  | 'o3'
  | 'gpt-4o'
  | 'o4-mini-deep-research'
  | 'o3-deep-research'

const create = (model: Model) =>
  createOpenAI({
    baseURL: baseUrl,
    apiKey: env.value.X_302_API_KEY,
  })(model)

export const x302 = (modelId: Model) => create(modelId)

type DeepResearchResponseEvent =
  | {
      type: 'response.created'
      sequence_number: number
      response: Record<string, unknown>
    }
  | {
      type: 'response.in_progress'
      sequence_number: number
      response: Record<string, unknown>
    }
  | {
      type: 'response.output_item.added'
      sequence_number: number
      output_index: number
      item: Record<string, unknown>
    }
  | {
      type: 'response.output_item.done'
      sequence_number: number
      output_index: number
      item: Record<string, unknown>
    }
  | {
      type: 'response.web_search_call.in_progress'
      sequence_number: number
      output_index: number
      item_id: string
    }
  | {
      type: 'response.web_search_call.searching'
      sequence_number: number
      output_index: number
      item_id: string
    }
  | {
      type: 'response.web_search_call.completed'
      sequence_number: number
      output_index: number
      item_id: string
    }
  | {
      type: 'response.content_part.added'
      sequence_number: number
      item_id: string
      output_index: number
      content_index: number
      part: Record<string, unknown>
    }
  | {
      type: 'response.output_text.delta'
      sequence_number: number
      item_id: string
      output_index: number
      content_index: number
      delta: string
      logprobs: unknown[]
    }
  | {
      type: 'response.output_text.done'
      sequence_number: number
      item_id: string
      output_index: number
      content_index: number
      text: string
      logprobs: unknown[]
    }
  | {
      type: 'response.content_part.done'
      sequence_number: number
      item_id: string
      output_index: number
      content_index: number
      part: Record<string, unknown>
    }
  | {
      type: 'response.completed'
      sequence_number: number
      response: Record<string, unknown>
    }

export async function* createDeepResearch(opts: {
  model: 'o4-mini-deep-research' | 'o3-deep-research'
  prompt: string
}): AsyncGenerator<DeepResearchResponseEvent> {
  const response = await stream('https://api.302.ai/v1/responses', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${env.value.X_302_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      input: [{ role: 'user', content: opts.prompt }],
      tools: [
        {
          type: 'web_search_preview',
        },
      ],
    }),
    redirect: 'follow',
  })
  for await (const chunk of response) {
    const { event, data } = chunk

    if (event && data) {
      yield JSON.parse(data) as any
    }
  }
}
