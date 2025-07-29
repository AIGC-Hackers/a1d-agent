import { env } from '@/lib/env'
import { createOpenAI, OpenAIProviderSettings } from '@ai-sdk/openai'
import { streamText } from 'ai'

export namespace Glm {
  export type Model =
    | 'glm-4.5'
    | 'glm-4.5-air'
    | 'glm-4.5-x'
    | 'glm-4.5-airx'
    | 'glm-4.5-flash'
    | 'glm-z1-air'
    | 'glm-z1-airx'
    | 'glm-z1-flash'
    | 'glm-z1-flashx'
    | 'glm-4.1v-thinking-flashx'
    | 'glm-4.1v-thinking-flash'

  type Settings = Parameters<ReturnType<typeof createOpenAI>>[1]

  export const model = (model: Model, settings?: Settings) =>
    createOpenAI({
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: env.value.GLM_API_KEY,
    })(model, settings)
}

if (import.meta.main) {
  console.log('Glm.model test')
  const response = streamText({
    model: Glm.model('glm-4.5'),
    prompt: 'Hello, world!',
  })

  for await (const chunk of response.textStream) {
    process.stdout.write(chunk)
  }

  response.consumeStream({
    onError: console.error,
  })
}
