import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'

export const baseUrl = 'https://openrouter.ai/api/v1'

export const openrouter = (model: OpenRouterModel) =>
  createOpenAI({
    baseURL: baseUrl,
    apiKey: env.value.OPENROUTER_API_KEY,
  })(model)

export const enum OpenRouterModel {
  GoogleGemini25Flash = 'google/gemini-2.5-flash',
  GoogleGemini25FlashLitePreview0617 = 'google/gemini-2.5-flash-lite-preview-06-17',
  MinimaxMinimaxM1 = 'minimax/minimax-m1',
  GoogleGemini25Pro = 'google/gemini-2.5-pro',
  XaiGrok3Mini = 'x-ai/grok-3-mini',
  XaiGrok3 = 'x-ai/grok-3',

  OpenAIGpt4oMini = 'openai/gpt-4o-mini',
  OpenAIGpt4o = 'openai/gpt-4o',

  OpenAIO3 = 'openai/o3',
}
