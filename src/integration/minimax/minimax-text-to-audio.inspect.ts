import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '@/lib/env'

const MINIMAX_API_KEY = env.value.MINIMAX_API_KEY
const MINIMAX_GROUP_ID = env.value.MINIMAX_GROUP_ID

async function testMinimaxStream() {
  // 确保 temp 目录存在
  const tempDir = join(import.meta.dirname, '../../../temp')
  await mkdir(tempDir, { recursive: true })

  const logFile = join(tempDir, `minimax-stream-${Date.now()}.jsonl`)
  const logStream = createWriteStream(logFile, { flags: 'a' })

  console.log(`📝 日志文件: ${logFile}`)

  try {
    const url = `https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`

    const requestBody = {
      model: 'speech-02-turbo',
      text: '测试文本：2025年，氢能存储技术迎来历史性突破。',
      stream: true, // 启用流式传输
      voice_setting: {
        voice_id: 'male-qn-qingse',
        speed: 1.0,
        vol: 1.0,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    }

    console.log('🚀 发送请求到:', url)
    console.log('📦 请求体:', JSON.stringify(requestBody, null, 2))

    // 记录请求信息
    logStream.write(
      JSON.stringify({
        type: 'request',
        timestamp: new Date().toISOString(),
        url,
        body: requestBody,
      }) + '\n',
    )

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      // @ts-ignore - Bun specific option
      tls: {
        rejectUnauthorized: false,
      },
    })

    console.log('📨 响应状态:', response.status, response.statusText)
    console.log('📋 响应头:', Object.fromEntries(response.headers.entries()))

    // 记录响应信息
    logStream.write(
      JSON.stringify({
        type: 'response',
        timestamp: new Date().toISOString(),
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      }) + '\n',
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ 错误响应:', errorText)
      logStream.write(
        JSON.stringify({
          type: 'error',
          timestamp: new Date().toISOString(),
          error: errorText,
        }) + '\n',
      )
      return
    }

    // 处理 SSE 流
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      console.error('❌ 无法获取响应流')
      return
    }

    let buffer = ''
    let eventCount = 0

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        console.log('✅ 流结束')
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // 处理 SSE 事件
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留未完成的行

      for (const line of lines) {
        if (line.startsWith('data:')) {
          eventCount++
          const data = line.slice(5).trim()

          console.log(
            `📦 事件 #${eventCount}:`,
            data.slice(0, 100) + (data.length > 100 ? '...' : ''),
          )

          // 记录每个事件（截断大的 audio 数据）
          const truncatedData =
            data.length > 200 ? data.slice(0, 200) + '...' : data
          logStream.write(
            JSON.stringify({
              type: 'sse_event',
              timestamp: new Date().toISOString(),
              eventNumber: eventCount,
              data: truncatedData,
              dataLength: data.length,
            }) + '\n',
          )

          // 尝试解析 JSON
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data)

              // 记录解析后的数据（处理 audio 字段）
              const parsedForLog = { ...parsed }
              if (parsedForLog.data?.audio) {
                parsedForLog.data = {
                  ...parsedForLog.data,
                  audio:
                    parsedForLog.data.audio.length > 100
                      ? parsedForLog.data.audio.slice(0, 100) + '...'
                      : parsedForLog.data.audio,
                  audioLength: parsed.data.audio.length,
                }
              }

              logStream.write(
                JSON.stringify({
                  type: 'parsed_event',
                  timestamp: new Date().toISOString(),
                  eventNumber: eventCount,
                  parsed: parsedForLog,
                }) + '\n',
              )

              // 检查是否有音频数据
              if (parsed.data?.audio) {
                console.log(
                  `🎵 收到音频数据，长度: ${parsed.data.audio.length}`,
                )
              }

              // 打印额外信息
              if (parsed.extra_info) {
                console.log('ℹ️ 额外信息:', parsed.extra_info)
              }
            } catch (e) {
              console.error(`❌ 解析事件 #${eventCount} 失败:`, e)
              logStream.write(
                JSON.stringify({
                  type: 'parse_error',
                  timestamp: new Date().toISOString(),
                  eventNumber: eventCount,
                  error: String(e),
                  data,
                }) + '\n',
              )
            }
          }
        }
      }
    }

    console.log(`\n📊 总结: 收到 ${eventCount} 个事件`)
    console.log(`📁 详细日志已保存到: ${logFile}`)
  } catch (error) {
    console.error('❌ 测试失败:', error)
    logStream.write(
      JSON.stringify({
        type: 'fatal_error',
        timestamp: new Date().toISOString(),
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }) + '\n',
    )
  } finally {
    logStream.end()
  }
}

// 运行测试
if (import.meta.main) {
  await testMinimaxStream()
}
