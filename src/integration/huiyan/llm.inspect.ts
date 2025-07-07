import { env } from '@/lib/env'
import OpenAI from 'openai'

import { baseUrl } from './config'

export const api = new OpenAI({
  baseURL: `${baseUrl}/v1`,
  apiKey: env.value.HUIYAN_B_API_KEY,
})

async function main() {
  const response = await api.chat.completions.create({
    model: 'claude-sonnet-4-20250514',
    stream: true,
    messages: [{ role: 'user', content: 'Hello, world!' }],
  })

  for await (const chunk of response) {
    process.stdout.write(chunk.choices[0]?.delta.content || '')
  }
}

if (import.meta.main) {
  main()
}
