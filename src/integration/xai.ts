import { env } from '@/lib/env'
import { createXai } from '@ai-sdk/xai'
import { OpenAI } from 'openai'

export namespace Xai {
  export type Model =
    | 'grok-4-0709'
    | 'grok-3-latest'
    | 'grok-3-fast-latest'
    | 'grok-3-mini-latest'
    | 'grok-3-mini-fast-latest'

  export const model = (model: Model, settings?: { user: string }) =>
    createXai({
      apiKey: env.value.XAI_API_KEY,
    })(model, settings)

  export const client = () =>
    new OpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey: env.value.XAI_API_KEY,
    })
}
