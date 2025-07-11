import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'
import { OpenAI } from 'openai'

import { baseUrl } from './config'

export type DeepResearchModel = 'o4-mini-deep-research' | 'o3-deep-research'
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
  | DeepResearchModel

export const create = createOpenAI({
  baseURL: baseUrl,
  apiKey: env.value.X_302_API_KEY,
})

export const openai = new OpenAI({
  baseURL: baseUrl,
  apiKey: env.value.X_302_API_KEY,
})

export const x302 = (modelId: Model) => create(modelId)

export async function createDeepResearch(opts: {
  prompt: string
  model: DeepResearchModel
}) {
  const response = await openai.responses.create({
    model: opts.model,
    stream: true,
    input: [{ role: 'user', content: opts.prompt }],
    tools: [{ type: 'web_search_preview' }],
  })

  return response
}
