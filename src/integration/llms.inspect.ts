import { generateText } from 'ai'

import { x302 } from './302/llm'
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

async function runTests(): Promise<void> {
  console.log('🧪 Testing LLM Integrations...\n')

  const tests = [
    {
      name: 'XAI',
      model: xai('grok-3-mini-fast-latest'),
      modelName: 'grok-3-mini-fast-latest',
    },
    {
      name: 'Huiyan',
      model: huiyan(LanguageModel.GPT_4O_MINI),
      modelName: 'gpt-4o-mini',
    },
    {
      name: '302.AI',
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

runTests().catch(console.error)
