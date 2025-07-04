import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'

export type OpenRouterModel =
  | 'google/gemini-2.5-flash'
  | 'google/gemini-2.5-flash-lite-preview-06-17'
  | 'minimax/minimax-m1'
  | 'google/gemini-2.5-pro'
  | 'x-ai/grok-3-mini'
  | 'x-ai/grok-3'
  | 'openai/gpt-4o-mini'
  | 'openai/gpt-4o'
  | 'openai/o3'
  | 'openai/gpt-4.1'
  | 'openai/gpt-4o-search-preview'
  | 'openai/gpt-4o-mini-search-preview'
  | 'perplexity/sonar-deep-research'
  | 'perplexity/sonar-pro'

export const baseUrl = 'https://openrouter.ai/api/v1'

export const openrouter = (model: OpenRouterModel) =>
  createOpenAI({
    baseURL: baseUrl,
    apiKey: env.value.OPENROUTER_API_KEY,
  })(model)
