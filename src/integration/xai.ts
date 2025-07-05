import { env } from '@/lib/env'
import { createXai } from '@ai-sdk/xai'

type Model =
  | 'grok-3-latest'
  | 'grok-3-fast-latest'
  | 'grok-3-mini-latest'
  | 'grok-3-mini-fast-latest'

export const xai = (model: Model) =>
  createXai({
    apiKey: env.value.XAI_API_KEY,
  })(model)
