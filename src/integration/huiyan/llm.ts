import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'

import { baseUrl } from './config'

export namespace HuiyanLm {
  export const enum Model {
    CLAUDE_SONNET_4 = 'claude-sonnet-4-20250514',
    CLAUDE_SONNET_4_THINKING = 'claude-sonnet-4-20250514-thinking',
    CLAUDE_OPUS_4 = 'claude-opus-4-20250514',
    CLAUDE_OPUS_4_THINKING = 'claude-opus-4-20250514-thinking',
    GPT_4O_MINI = 'gpt-4o-mini',
    GPT_4O = 'gpt-4o',
    GPT_4O_IMAGE = 'gpt-4o-image',
    O3 = 'o3',
    GEMINI_2_5_PRO = 'gemini-2.5-pro',
  }

  export const model = (model: Model) =>
    createOpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: env.value.HUIYAN_A_API_KEY,
    })(model)
}
