import { env } from '@/lib/env'
import { generateText } from 'ai'
import OpenAI from 'openai'

import { x302 } from './302/llm'
import { baseUrl } from './huiyan/config'
import { huiyan, LanguageModel } from './huiyan/llm'
import { xai } from './xai'

type TestResult = {
  provider: string
  model: string
  status: 'success' | 'error'
  latency: number
  response?: string
  error?: string
}

async function testProvider(
  name: string,
  model: any,
  modelName: string,
): Promise<TestResult> {
  const startTime = Date.now()

  try {
    const result = await generateText({
      model,
      prompt: 'Say "Hello" in one word',
    })

    const latency = Date.now() - startTime

    return {
      provider: name,
      model: modelName,
      status: 'success',
      latency,
      response: result.text.trim(),
    }
  } catch (error) {
    const latency = Date.now() - startTime

    return {
      provider: name,
      model: modelName,
      status: 'error',
      latency,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function testStreamingChat(): Promise<void> {
  console.log('\n🌊 Testing Streaming Chat with Huiyan...\n')

  const api = new OpenAI({
    baseURL: `${baseUrl}/v1`,
    apiKey: env.value.HUIYAN_B_API_KEY,
  })

  try {
    const response = await api.chat.completions.create({
      model: 'claude-sonnet-4-20250514',
      stream: true,
      messages: [{ role: 'user', content: 'Hello, world!' }],
    })

    console.log('Streaming response:')
    for await (const chunk of response) {
      process.stdout.write(chunk.choices[0]?.delta.content || '')
    }
    console.log('\n✅ Streaming test completed successfully')
  } catch (error) {
    console.log(
      '\n❌ Streaming test failed:',
      error instanceof Error ? error.message : String(error),
    )
  }
}

async function runTests(): Promise<void> {
  console.log('🧪 Testing LLM Integrations...\n')

  const tests = [
    {
      name: 'XAI',
      model: xai('grok-3-mini-fast-latest'),
      modelName: 'grok-3-mini-fast-latest',
    },
    {
      name: 'Huiyan/GPT-4o-mini',
      model: huiyan(LanguageModel.GPT_4O_MINI),
      modelName: 'gpt-4o-mini',
    },
    {
      name: 'Huiyan/claude-sonnet',
      model: huiyan(LanguageModel.CLAUDE_SONNET_4),
      modelName: 'claude-sonnet',
    },
    {
      name: '302.AI/gpt-4.1-mini',
      model: x302('gpt-4.1-mini'),
      modelName: 'gpt-4.1-mini',
    },
  ]

  const results: TestResult[] = []

  for (const test of tests) {
    console.log(`Testing ${test.name}...`)
    const result = await testProvider(test.name, test.model, test.modelName)
    results.push(result)
  }

  console.log('\n📊 Test Results:')
  console.table(
    results.map((result) => ({
      Provider: result.provider,
      Model: result.model,
      Status: result.status === 'success' ? '✅ Success' : '❌ Error',
      'Latency(ms)': result.latency,
      'Response/Error': result.response || result.error || '',
    })),
  )

  const successCount = results.filter((r) => r.status === 'success').length
  const avgLatency =
    results
      .filter((r) => r.status === 'success')
      .reduce((sum, r) => sum + r.latency, 0) / successCount || 0

  console.log(
    `\n📈 Summary: ${successCount}/${results.length} providers working, avg latency: ${avgLatency.toFixed(0)}ms`,
  )
}

async function main(): Promise<void> {
  await runTests()
  await testStreamingChat()
}

if (import.meta.main) {
  main().catch(console.error)
}
