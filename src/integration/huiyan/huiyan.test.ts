import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'
import { generateText } from 'ai'
import { describe, expect, it } from 'vitest'

import { Huiyan } from './llm'
import { Midjourney } from './midjourney'

describe('Huiyan LLM Integration', () => {
  describe('API Integration', () => {
    it.skip('should work with GPT-4o-mini', async () => {
      const model = Huiyan.model(Huiyan.Model.GPT_4O_MINI)

      const result = await generateText({
        model,
        prompt: 'Respond with just "OK"',
        maxTokens: 10,
      })

      expect(result.text).toBeTruthy()
      console.log(`${Huiyan.Model.GPT_4O_MINI} response:`, result.text)
    }, 10000)
  })

  describe('Midjourney Integration', () => {
    it(
      'should test submit API response first',
      async () => {
        // 创建 temp 目录
        mkdirSync('./temp', { recursive: true })

        const logFile = join('./temp', 'midjourney-submit.jsonl')
        const logStream = createWriteStream(logFile, { flags: 'w' })

        const logEntry = (type: string, data: any) => {
          const entry = JSON.stringify({
            timestamp: new Date().toISOString(),
            type,
            data,
          })
          logStream.write(entry + '\n')
          console.log(`[${type}]`, data)
        }

        try {
          logEntry('START', { prompt: 'a simple red apple' })

          const result = await new Promise((resolve, reject) => {
            Midjourney.client
              .submitImagine({
                prompt: 'a simple red apple',
              })
              .subscribe({
                next: (response: any) => {
                  logEntry('SUBMIT_RESPONSE', response)
                  resolve(response)
                },
                error: (error: any) => {
                  logEntry('SUBMIT_ERROR', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    cause: error.cause,
                  })
                  reject(error)
                },
              })
          })

          logEntry('SUCCESS', { result })
        } catch (error) {
          logEntry('CATCH_ERROR', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
            fullError: error,
          })
          throw error
        } finally {
          logStream.end()
          console.log(`Submit test logs written to ${logFile}`)
        }
      },
      30000 * 100,
    )

    it(
      'should generate image stream and log to JSONL',
      async () => {
        // 创建 temp 目录
        mkdirSync('./temp', { recursive: true })

        const logFile = join('./temp', 'midjourney-stream.jsonl')
        const logStream = createWriteStream(logFile, { flags: 'w' })

        const logEntry = (type: string, data: any) => {
          const entry = JSON.stringify({
            timestamp: new Date().toISOString(),
            type,
            data,
          })
          logStream.write(entry + '\n')
          console.log(`[${type}]`, data)
        }

        try {
          let jobId: string | undefined

          // First submit the job
          await new Promise((resolve, reject) => {
            Midjourney.client
              .submitImagine({
                prompt: 'a simple red apple',
              })
              .subscribe({
                next: (result: any) => {
                  if (result.code !== 1) {
                    reject(new Error(result.description))
                  } else {
                    jobId = result.result
                    logEntry('SUBMIT', { jobId })
                    resolve(result)
                  }
                },
                error: reject,
              })
          })

          if (!jobId) throw new Error('No job ID received')

          // Then poll for progress
          await new Promise<void>((resolve, reject) => {
            Midjourney.client
              .pollStream(jobId!, {
                pollInterval: 5000,
                timeout: 30000,
              })
              .subscribe({
                next: (job: any) => {
                  const pstr = String(job.progress) ?? ''
                  let progress = 0
                  if (pstr !== '') {
                    progress = Number(pstr.replace('%', ''))
                  }
                  logEntry('PROGRESS', {
                    id: job.id,
                    progress: progress,
                    imageUrl: job.imageUrl,
                  })
                },
                complete: () => {
                  logEntry('COMPLETE', { message: 'Stream completed' })
                  resolve()
                },
                error: (error: any) => {
                  logEntry('ERROR', {
                    message: error.message,
                    stack: error.stack,
                    name: error.name,
                    cause: error.cause,
                    fullError: error,
                  })
                  reject(error)
                },
              })
          })
        } catch (error) {
          logEntry('CATCH_ERROR', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : undefined,
            fullError: error,
          })
          throw error
        } finally {
          logStream.end()
          console.log(`Stream logs written to ${logFile}`)
        }
      },
      60000 * 100,
    )
  })
})
