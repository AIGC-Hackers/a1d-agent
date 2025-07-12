import { extractReasoningMiddleware, streamText, wrapLanguageModel } from 'ai'

import { createClient, xai } from './xai'

const prompt = `假设你是一家智能仓储机器人的调度系统，仓库中有4个机器人（A/B/C/D），每个机器人一次只能搬运一个货物，每个货物都有唯一编号。
某一天，A先搬了货物X，B搬了货物Y，A放下X后又去搬Z，但这时C因为路线冲突和A短暂停顿，D则趁机搬了W。
请用时序列表（Mermaid 或表格）详细还原整个搬运流程，标注出每一步的并发与冲突。 `

async function test1() {
  const model = wrapLanguageModel({
    model: xai('grok-4-0709'),
    middleware: extractReasoningMiddleware({ tagName: 'think' }),
  })

  const response = streamText({
    model,
    prompt,
  })

  for await (const chunk of response.textStream) {
    process.stdout.write(chunk)
  }

  await response.consumeStream({ onError: console.error })
}

async function test2() {
  const client = createClient()

  const stream = client.chat.completions.stream({
    model: 'grok-4-0709',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta.content ?? '')
  }
}

if (import.meta.main) {
  test2().catch(console.log)
}
