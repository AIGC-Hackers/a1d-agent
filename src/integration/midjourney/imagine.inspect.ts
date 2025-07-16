import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { MidjourneyProxy } from './factory'

// Get provider from command line args or default to '302'
const provider = (process.argv[2] as '302' | 'huiyan') || '302'

// Create temp directory and log file
const tempDir = join(process.cwd(), 'temp')
const logFile = join(
  tempDir,
  `midjourney-imagine-${provider}-${Date.now()}.jsonl`,
)

// Ensure temp directory exists
await mkdir(tempDir, { recursive: true })

// Create write stream for logging
const logStream = createWriteStream(logFile, { flags: 'a' })

function log(event: string, data: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: `${event}_${provider.toUpperCase()}`,
    provider,
    data,
  }
  logStream.write(JSON.stringify(logEntry) + '\n')
  console.log(`[${event}_${provider.toUpperCase()}]`, data)
}

log('START', { logFile, provider })

try {
  // Test 1: Create client via factory
  log('FACTORY_CREATE_CLIENT', { provider })
  const client = MidjourneyProxy.client(provider)
  log('CLIENT_CREATED', {
    provider: client.provider,
    baseUrl: client.baseUrl,
  })

  // Test 2: Create imagine task
  const input = {
    prompt: 'A futuristic city skyline at sunset, cyberpunk style, neon lights',
    aspectRatio: '16:9' as const,
  }
  log('IMAGINE_INPUT', input)

  log('IMAGINE_CALL_START', {})
  const taskResult = await client.imagine(input)

  if (!taskResult.success) {
    log('IMAGINE_FAILED', {
      error: taskResult.error.message,
      stack: taskResult.error.stack,
    })
    throw taskResult.error
  }

  const task = taskResult.data
  log('IMAGINE_TASK_CREATED', {
    taskId: task.id,
    taskIdType: typeof task.id,
    taskIdValue: String(task.id),
    inputPrompt: task.input.prompt,
    inputAspectRatio: task.input.aspectRatio,
    taskKeys: Object.keys(task),
  })

  // Test 3: Poll once directly
  log('DIRECT_POLL_START', { taskId: task.id })
  const pollResult = await task.poll()
  log('DIRECT_POLL_RESULT', {
    taskId: task.id,
    status: pollResult.status,
    progress: pollResult.progress,
    imageUrl: 'imageUrl' in pollResult ? pollResult.imageUrl : undefined,
    error: 'error' in pollResult ? pollResult.error?.message : undefined,
    payload: pollResult.payload,
  })

  // Test 4: Stream with observable
  log('STREAM_START', {
    interval: 5000,
    timeout: 120000,
  })

  const states: any[] = []
  const streamSubscription = task
    .stream({
      interval: 5000,
      timeout: 120000,
    })
    .subscribe({
      next: (state: any) => {
        log('STREAM_STATE', {
          taskId: task.id,
          status: state.status,
          progress: state.progress,
          imageUrl: 'imageUrl' in state ? state.imageUrl : undefined,
          error: 'error' in state ? state.error?.message : undefined,
          payload: state.payload,
        })
        states.push(state)
      },
      error: (error: any) => {
        log('STREAM_ERROR', {
          message: error.message,
          stack: error.stack,
        })
      },
      complete: () => {
        log('STREAM_COMPLETE', {
          totalStates: states.length,
          finalState: states[states.length - 1],
        })
      },
    })

  // Wait for stream to complete or timeout
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      log('STREAM_TIMEOUT_REACHED', {})
      streamSubscription.unsubscribe()
      resolve()
    }, 130000) // 130 seconds to give some buffer

    streamSubscription.add(() => {
      clearTimeout(timeout)
      resolve()
    })
  })
} catch (error) {
  log('FATAL_ERROR', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
} finally {
  log('END', { logFile, provider })
  logStream.end()
  console.log(`\nLog file written to: ${logFile}`)
  console.log(
    `\nUsage: pnpm x src/integration/midjourney/imagine.inspect.ts [302|huiyan]`,
  )
}
