import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'

import { baseUrl } from './config'

const create = (model: X302Model) =>
  createOpenAI({
    baseURL: baseUrl,
    apiKey: env.value.X_302_API_KEY,
  })(model)

export const enum X302Model {
  OPENAI_GPT_4_PLUS = 'gpt-4-plus',
  OPENAI_GPT_4O_IMAGE_GENERATION = 'gpt-4o-image-generation',

  OPENAI_O4_MINI_DEEP_RESEARCH = 'o4-mini-deep-research',
  OPENAI_O3_DEEP_RESEARCH = 'o3-deep-research',

  ANTHROPIC_CLAUDE_SONNET_4 = 'claude-sonnet-4-20250514',
  ANTHROPIC_CLAUDE_OPUS_4 = 'claude-opus-4-20250514',
}

export const x302 = (modelId: X302Model) => create(modelId)
