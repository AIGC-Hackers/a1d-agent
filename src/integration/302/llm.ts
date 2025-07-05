import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'

import { baseUrl } from './config'

export type Model =
  | 'gpt-4o-image-generation'
  | 'o4-mini-deep-research'
  | 'o3-deep-research'

const create = (model: Model) =>
  createOpenAI({
    baseURL: baseUrl,
    apiKey: env.value.X_302_API_KEY,
  })(model)
export const x302 = (modelId: Model) => create(modelId)
