import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { env } from '@/lib/env'

// Create temp directory and log file
const tempDir = join(process.cwd(), 'temp')
const logFile = join(tempDir, `midjourney-inspect-${Date.now()}.jsonl`)

// Ensure temp directory exists
await mkdir(tempDir, { recursive: true })

// Create write stream for logging
const logStream = createWriteStream(logFile, { flags: 'a' })

function log(event: string, data: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    data,
  }
  logStream.write(JSON.stringify(logEntry) + '\n')
  console.log(`[${event}]`, data)
}

log('START', { logFile, apiKeyLength: env.value.X_302_API_KEY?.length })

const baseUrl = 'https://api.302.ai/v1'
const apiKey = env.value.X_302_API_KEY

if (!apiKey) {
  log('ERROR', { message: 'Missing X_302_API_KEY' })
  process.exit(1)
}

// Test prompt
const prompt =
  'A serene Japanese garden with cherry blossoms, koi pond, traditional bridge, photorealistic, 8k'

log('PREPARE_REQUEST', {
  url: `${baseUrl}/mj/submit/imagine`,
  prompt,
  hasApiKey: !!apiKey,
})

try {
  // Step 1: Submit imagine task
  const submitUrl = `${baseUrl}/mj/submit/imagine`
  const submitBody = {
    prompt,
    botType: 'MID_JOURNEY',
  }

  log('SUBMIT_REQUEST', {
    url: submitUrl,
    body: submitBody,
    headers: {
      'mj-api-secret': apiKey.substring(0, 10) + '...',
      'Content-Type': 'application/json',
    },
  })

  const submitResponse = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'mj-api-secret': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(submitBody),
  })

  log('SUBMIT_RESPONSE', {
    status: submitResponse.status,
    statusText: submitResponse.statusText,
    headers: Object.fromEntries(submitResponse.headers.entries()),
  })

  const responseText = await submitResponse.text()
  log('SUBMIT_RESPONSE_TEXT', { text: responseText })

  let submitResult: any
  try {
    submitResult = JSON.parse(responseText)
    log('SUBMIT_RESPONSE_JSON', { result: submitResult })
  } catch (e) {
    log('PARSE_ERROR', {
      error: e instanceof Error ? e.message : String(e),
      responseText,
    })
    throw new Error('Failed to parse response as JSON')
  }

  if (!submitResult || !submitResult.result) {
    log('INVALID_RESULT', { submitResult })
    throw new Error('Invalid result structure')
  }

  const jobId = submitResult.result
  log('JOB_CREATED', { jobId })

  // Step 2: Poll job status
  let attempts = 0
  const maxAttempts = 60 // 10 minutes with 10s interval
  const pollInterval = 10000 // 10 seconds

  while (attempts < maxAttempts) {
    attempts++
    log('POLL_ATTEMPT', { attempt: attempts, jobId })

    await new Promise((resolve) => setTimeout(resolve, pollInterval))

    const jobUrl = `${baseUrl}/mj/task/${jobId}/fetch`
    log('POLL_REQUEST', { url: jobUrl })

    const jobResponse = await fetch(jobUrl, {
      method: 'GET',
      headers: {
        'mj-api-secret': apiKey,
        'Content-Type': 'application/json',
      },
    })

    log('POLL_RESPONSE', {
      status: jobResponse.status,
      statusText: jobResponse.statusText,
    })

    const jobText = await jobResponse.text()
    log('POLL_RESPONSE_TEXT', { text: jobText })

    let jobResult: any
    try {
      jobResult = JSON.parse(jobText)
      log('POLL_RESPONSE_JSON', { result: jobResult })
    } catch (e) {
      log('POLL_PARSE_ERROR', {
        error: e instanceof Error ? e.message : String(e),
        jobText,
      })
      continue
    }

    if (jobResult.progress === 100) {
      log('JOB_COMPLETED', {
        jobId,
        imageUrl: jobResult.imageUrl,
        finishTime: jobResult.finishTime,
      })
      break
    }

    if (jobResult.failReason) {
      log('JOB_FAILED', {
        jobId,
        failReason: jobResult.failReason,
        status: jobResult.status,
      })
      break
    }

    log('JOB_PROGRESS', {
      jobId,
      progress: jobResult.progress,
      status: jobResult.status,
    })
  }

  if (attempts >= maxAttempts) {
    log('TIMEOUT', { jobId, attempts })
  }
} catch (error) {
  log('ERROR', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
} finally {
  log('END', { logFile })
  logStream.end()
}
