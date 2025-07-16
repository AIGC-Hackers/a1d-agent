import { env } from '@/lib/env'
import { createGroq } from '@ai-sdk/groq'
import { streamText } from 'ai'

export namespace Groq {
  export const model = createGroq({
    apiKey: env.value.GROQ_API_KEY,
  })
}

if (import.meta.main) {
  console.log('Groq.model test')
  const response = streamText({
    model: Groq.model('moonshotai/kimi-k2-instruct'),
    prompt: 'Hello, world!',
  })

  for await (const chunk of response.textStream) {
    process.stdout.write(chunk)
  }
  response.consumeStream({
    onError: console.error,
  })
}
