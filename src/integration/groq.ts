import { env } from '@/lib/env'
import { createGroq } from '@ai-sdk/groq'

export namespace Groq {
  export const model = createGroq({
    apiKey: env.value.GROQ_API_KEY,
  })
}
