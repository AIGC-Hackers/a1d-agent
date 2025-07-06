import { generateText } from 'ai'
import { xai } from './xai'
import { huiyan, LanguageModel } from './huiyan/llm'
import { x302 } from './302/llm'

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
	modelName: string
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
	console.log('┌─────────────┬─────────────────────────┬─────────────┬─────────────┬─────────────────────────┐')
	console.log('│ Provider    │ Model                   │ Status      │ Latency(ms) │ Response/Error          │')
	console.log('├─────────────┼─────────────────────────┼─────────────┼─────────────┼─────────────────────────┤')

	for (const result of results) {
		const provider = result.provider.padEnd(11)
		const model = result.model.padEnd(23)
		const status = result.status === 'success' ? '✅ Success' : '❌ Error'
		const statusPadded = status.padEnd(11)
		const latency = result.latency.toString().padStart(11)
		const message = (result.response || result.error || '').substring(0, 23)

		console.log(`│ ${provider} │ ${model} │ ${statusPadded} │ ${latency} │ ${message.padEnd(23)} │`)
	}

	console.log('└─────────────┴─────────────────────────┴─────────────┴─────────────┴─────────────────────────┘')

	const successCount = results.filter(r => r.status === 'success').length
	const avgLatency = results
		.filter(r => r.status === 'success')
		.reduce((sum, r) => sum + r.latency, 0) / successCount || 0

	console.log(`\n📈 Summary: ${successCount}/${results.length} providers working, avg latency: ${avgLatency.toFixed(0)}ms`)
}

runTests().catch(console.error)