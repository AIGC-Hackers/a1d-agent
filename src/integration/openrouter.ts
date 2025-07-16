import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'

export namespace OpenRouter {
  export const enum Model {
    GoogleGemini25Flash = 'google/gemini-2.5-flash',
    GoogleGemini25FlashLitePreview0617 = 'google/gemini-2.5-flash-lite-preview-06-17',
    MinimaxM1 = 'minimax/minimax-m1',
    GoogleGemini25Pro = 'google/gemini-2.5-pro',
    XAiGrok40709 = 'x-ai/grok-4-07-09',
    OpenAIGpt4oMini = 'openai/gpt-4o-mini',
    OpenAIGpt4o = 'openai/gpt-4o',
    OpenAIO3 = 'openai/o3',
    OpenAIGpt41 = 'openai/gpt-4.1',
    OpenAIGpt4oSearchPreview = 'openai/gpt-4o-search-preview',
    OpenAIGpt4oMiniSearchPreview = 'openai/gpt-4o-mini-search-preview',
    AnthropicClaudeSonnet4 = 'anthropic/claude-sonnet-4',
    PerplexitySonarDeepResearch = 'perplexity/sonar-deep-research',
    PerplexitySonarPro = 'perplexity/sonar-pro',
  }

  export const baseUrl = 'https://openrouter.ai/api/v1'

  export const model = createOpenAI({
    baseURL: baseUrl,
    apiKey: env.value.OPENROUTER_API_KEY,
  })
}
