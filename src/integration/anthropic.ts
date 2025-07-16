import { env } from '@/lib/env'
import { createAnthropic } from '@ai-sdk/anthropic'

export namespace Anthropic {
  export const model = createAnthropic({
    apiKey: env.value.ANTHROPIC_API_KEY,
  })
}
