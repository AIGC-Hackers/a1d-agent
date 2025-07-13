import { firstValueFrom, merge, Observable } from 'rxjs'

import { defaultMinimaxContext } from './config'
import { generateImageStream } from './image'
import {
  createText2AudioTask,
  decodeAudioChunk,
  textToAudioStream,
} from './minimax-text-to-audio'
import { generateVideoStream } from './video'
import { listVoices } from './voice-cloning'

type TestStatus = 'running' | 'success' | 'error' | 'skipped'

type TestEvent =
  | { type: 'start'; name: string }
  | { type: 'progress'; name: string; progress: number; message?: string }
  | {
      type: 'log'
      name: string
      message: string
      level: 'info' | 'error' | 'warning'
    }
  | { type: 'complete'; name: string; result: TestResult }

type TestResult = {
  name: string
  api: string
  status: TestStatus
  latency: number
  details?: any
  error?: string
}

type TestConfig = {
  name: string
  api: string
  skip?: boolean
  timeout?: number
  test: () => Observable<TestEvent>
}

function createT2ATest(): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()

      observer.next({ type: 'start', name: 'Text-to-Audio' })
      observer.next({
        type: 'log',
        name: 'Text-to-Audio',
        message: 'Submitting text for audio generation...',
        level: 'info',
      })

      firstValueFrom(
        createText2AudioTask(
          {
            model: 'speech-02-turbo',
            text: 'Hello, this is a test of Minimax text to audio API.',
            voice_setting: {
              voice_id: 'default',
            },
            audio_setting: {
              output_format: 'mp3',
            },
          },
          defaultMinimaxContext,
        ),
      )
        .then((result) => {
          const latency = Date.now() - startTime
          observer.next({
            type: 'log',
            name: 'Text-to-Audio',
            message: `Trace ID: ${result.trace_id}`,
            level: 'info',
          })
          observer.next({
            type: 'complete',
            name: 'Text-to-Audio',
            result: {
              name: 'Text-to-Audio',
              api: 'Text-to-Audio',
              status: 'success',
              latency,
              details: {
                trace_id: result.trace_id,
                has_audio: !!result.data?.audio || !!result.data?.audio_url,
                status_code: result.base_resp?.status_code,
              },
            },
          })
          observer.complete()
        })
        .catch((error) => {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'log',
            name: 'Text-to-Audio',
            message: `Error: ${errorMessage}`,
            level: 'error',
          })
          observer.next({
            type: 'complete',
            name: 'Text-to-Audio',
            result: {
              name: 'Text-to-Audio',
              api: 'Text-to-Audio',
              status: 'error',
              latency,
              error: errorMessage,
            },
          })
          observer.complete()
        })
    })
}

function createT2ASSEStreamTest(): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()
      let totalBytes = 0
      let chunkCount = 0

      observer.next({ type: 'start', name: 'Text-to-Audio SSE Stream' })
      observer.next({
        type: 'log',
        name: 'Text-to-Audio SSE Stream',
        message: 'Starting SSE streaming...',
        level: 'info',
      })

      // Run the async iterator
      const runAsync = async () => {
        try {
          for await (const chunk of textToAudioStream(
            {
              model: 'speech-02-turbo',
              text: 'Hello, this is a test of Minimax real-time streaming API.',
              voice_setting: {
                voice_id: 'default',
              },
              audio_setting: {
                output_format: 'mp3',
              },
            },
            defaultMinimaxContext,
          )) {
            chunkCount++
            const audioBytes = decodeAudioChunk(chunk.audio)
            totalBytes += audioBytes.length

            observer.next({
              type: 'log',
              name: 'Text-to-Audio SSE Stream',
              message: `Chunk #${chunkCount}: ${audioBytes.length} bytes (total: ${totalBytes} bytes)`,
              level: 'info',
            })

            // Report progress based on chunk count
            observer.next({
              type: 'progress',
              name: 'Text-to-Audio SSE Stream',
              progress: Math.min(chunkCount * 10, 90), // Estimate progress
              message: `Received ${chunkCount} chunks`,
            })

            if (chunk.trace_id && chunkCount === 1) {
              observer.next({
                type: 'log',
                name: 'Text-to-Audio SSE Stream',
                message: `Trace ID: ${chunk.trace_id}`,
                level: 'info',
              })
            }
          }

          const latency = Date.now() - startTime
          observer.next({
            type: 'complete',
            name: 'Text-to-Audio SSE Stream',
            result: {
              name: 'Text-to-Audio SSE Stream',
              api: 'Text-to-Audio SSE Stream',
              status: 'success',
              latency,
              details: {
                total_chunks: chunkCount,
                total_bytes: totalBytes,
                avg_chunk_size: Math.round(totalBytes / chunkCount),
              },
            },
          })
          observer.complete()
        } catch (error) {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'log',
            name: 'Text-to-Audio SSE Stream',
            message: `Error: ${errorMessage}`,
            level: 'error',
          })
          observer.next({
            type: 'complete',
            name: 'Text-to-Audio SSE Stream',
            result: {
              name: 'Text-to-Audio SSE Stream',
              api: 'Text-to-Audio SSE Stream',
              status: 'error',
              latency,
              error: errorMessage,
            },
          })
          observer.complete()
        }
      }

      runAsync()
    })
}

function createListVoicesTest(): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()

      observer.next({ type: 'start', name: 'List Voices' })
      observer.next({
        type: 'log',
        name: 'List Voices',
        message: 'Fetching available voices...',
        level: 'info',
      })

      firstValueFrom(
        listVoices(
          {
            page_size: 10,
            include_presets: true,
          },
          defaultMinimaxContext,
        ),
      )
        .then((result) => {
          const latency = Date.now() - startTime
          observer.next({
            type: 'log',
            name: 'List Voices',
            message: `Found ${result.total} voices`,
            level: 'info',
          })
          observer.next({
            type: 'complete',
            name: 'List Voices',
            result: {
              name: 'List Voices',
              api: 'List Voices',
              status: 'success',
              latency,
              details: {
                total_voices: result.total,
                voices_returned: result.voices.length,
              },
            },
          })
          observer.complete()
        })
        .catch((error) => {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'log',
            name: 'List Voices',
            message: `Error: ${errorMessage}`,
            level: 'error',
          })
          observer.next({
            type: 'complete',
            name: 'List Voices',
            result: {
              name: 'List Voices',
              api: 'List Voices',
              status: 'error',
              latency,
              error: errorMessage,
            },
          })
          observer.complete()
        })
    })
}

function createImageGenerationTest(): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()
      let finalResult: any

      observer.next({ type: 'start', name: 'Image Generation' })
      observer.next({
        type: 'log',
        name: 'Image Generation',
        message: 'Submitting image generation request...',
        level: 'info',
      })

      const subscription = generateImageStream(
        {
          prompt: 'A cute cartoon cat sitting on a rainbow',
          model: 'abab6-4',
          width: 512,
          height: 512,
          n: 1,
        },
        defaultMinimaxContext,
        {
          onProgress: (progress) => {
            observer.next({
              type: 'progress',
              name: 'Image Generation',
              progress,
              message: `Progress: ${progress}%`,
            })
          },
        },
      ).subscribe({
        next: (result) => {
          finalResult = result
        },
        error: (error) => {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'log',
            name: 'Image Generation',
            message: `Error: ${errorMessage}`,
            level: 'error',
          })
          observer.next({
            type: 'complete',
            name: 'Image Generation',
            result: {
              name: 'Image Generation',
              api: 'Image Generation',
              status: 'error',
              latency,
              error: errorMessage,
            },
          })
          observer.complete()
        },
        complete: () => {
          const latency = Date.now() - startTime
          observer.next({
            type: 'log',
            name: 'Image Generation',
            message: 'Generation completed',
            level: 'info',
          })
          observer.next({
            type: 'complete',
            name: 'Image Generation',
            result: {
              name: 'Image Generation',
              api: 'Image Generation',
              status: 'success',
              latency,
              details: {
                has_images: !!(finalResult?.images?.length > 0),
                image_count: finalResult?.images?.length || 0,
                images: finalResult?.images,
              },
            },
          })
          observer.complete()
        },
      })

      return () => {
        subscription.unsubscribe()
      }
    })
}

function createVideoGenerationTest(): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()
      let finalResult: any

      observer.next({ type: 'start', name: 'Video Generation' })
      observer.next({
        type: 'log',
        name: 'Video Generation',
        message: 'Submitting video generation request...',
        level: 'info',
      })

      const subscription = generateVideoStream(
        {
          prompt: 'A cat walking on a rainbow bridge in cartoon style',
          model: 'MiniMax-Hailuo-02',
        },
        defaultMinimaxContext,
        {
          pollInterval: 5000,
          onProgress: (status) => {
            observer.next({
              type: 'progress',
              name: 'Video Generation',
              progress: 50, // Fixed progress value since status is string
              message: `Status: ${status.status}`,
            })
          },
        },
      ).subscribe({
        next: (result) => {
          finalResult = result
          if ('task_id' in result) {
            observer.next({
              type: 'log',
              name: 'Video Generation',
              message: `Task ID: ${result.task_id}`,
              level: 'info',
            })
          }
        },
        error: (error) => {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'log',
            name: 'Video Generation',
            message: `Error: ${errorMessage}`,
            level: 'error',
          })
          observer.next({
            type: 'complete',
            name: 'Video Generation',
            result: {
              name: 'Video Generation',
              api: 'Video Generation',
              status: 'error',
              latency,
              error: errorMessage,
            },
          })
          observer.complete()
        },
        complete: () => {
          const latency = Date.now() - startTime
          observer.next({
            type: 'log',
            name: 'Video Generation',
            message: 'Generation completed',
            level: 'info',
          })
          observer.next({
            type: 'complete',
            name: 'Video Generation',
            result: {
              name: 'Video Generation',
              api: 'Video Generation',
              status: 'success',
              latency,
              details: {
                has_video: !!finalResult?.video_url,
                video_url: finalResult?.video_url,
                cover_image_url: finalResult?.cover_image_url,
              },
            },
          })
          observer.complete()
        },
      })

      return () => {
        subscription.unsubscribe()
      }
    })
}

// Test configurations
const TEST_CONFIGS: TestConfig[] = [
  {
    name: 'Text-to-Audio',
    api: 'Text-to-Audio',
    skip: false, // Enable/disable tests by changing this
    timeout: 60000,
    test: createT2ATest(),
  },
  {
    name: 'Text-to-Audio SSE Stream',
    api: 'Text-to-Audio SSE Stream',
    skip: true, // Enable to test real-time streaming
    timeout: 60000,
    test: createT2ASSEStreamTest(),
  },
  {
    name: 'List Voices',
    api: 'List Voices',
    skip: true,
    timeout: 30000,
    test: createListVoicesTest(),
  },
  {
    name: 'Image Generation',
    api: 'Image Generation',
    skip: true,
    timeout: 120000,
    test: createImageGenerationTest(),
  },
  {
    name: 'Video Generation',
    api: 'Video Generation',
    skip: true, // Skip by default due to high cost
    timeout: 600000, // 10 minutes
    test: createVideoGenerationTest(),
  },
]

async function runTests(configs: TestConfig[] = TEST_CONFIGS): Promise<void> {
  console.log('🧪 Testing Minimax API Integrations...\n')
  console.log(`Base URL: ${defaultMinimaxContext.baseUrl}`)
  console.log(`Group ID: ${defaultMinimaxContext.groupId}`)
  console.log(`API Key: ${defaultMinimaxContext.apiKey.substring(0, 10)}...\n`)

  // Filter out skipped tests
  const activeConfigs = configs.filter((config) => !config.skip)
  const skippedConfigs = configs.filter((config) => config.skip)

  if (skippedConfigs.length > 0) {
    console.log(
      `⏭️  Skipping: ${skippedConfigs.map((c) => c.name).join(', ')}\n`,
    )
  }

  if (activeConfigs.length === 0) {
    console.log('❌ No tests to run (all tests are skipped)')
    return
  }

  console.log('Starting tests...\n')

  const results: TestResult[] = []

  // Create observables for all active tests
  const testObservables = activeConfigs.map((config) => config.test())

  // Wait for all tests to complete
  await new Promise<void>((resolve) => {
    // Merge all observables to handle events
    merge(...testObservables).subscribe({
      next: (event) => {
        switch (event.type) {
          case 'start':
            console.log(`\n[${event.name}] Starting...`)
            break
          case 'progress':
            if (event.message) {
              console.log(`[${event.name}] ${event.message}`)
            }
            break
          case 'log':
            console.log(`[${event.name}] ${event.message}`)
            break
          case 'complete':
            results.push(event.result)
            console.log(
              `[${event.name}] Completed with status: ${event.result.status}`,
            )
            break
        }
      },
      error: (error) => {
        console.error('Test error:', error)
      },
      complete: () => {
        // Add skipped tests to results
        skippedConfigs.forEach((config) => {
          results.push({
            name: config.name,
            api: config.api,
            status: 'skipped',
            latency: 0,
          })
        })

        // Display results table
        console.log('\n📊 Test Results:')
        console.table(
          results.map((result) => ({
            API: result.api,
            Status:
              result.status === 'success'
                ? '✅ Success'
                : result.status === 'skipped'
                  ? '⏭️  Skipped'
                  : '❌ Error',
            'Latency(ms)': result.status === 'skipped' ? '-' : result.latency,
            Details: result.details ? JSON.stringify(result.details) : '-',
            Error: result.error || '',
          })),
        )

        const successCount = results.filter(
          (r) => r.status === 'success',
        ).length
        const errorCount = results.filter((r) => r.status === 'error').length
        const activeResults = results.filter((r) => r.status !== 'skipped')
        const avgLatency =
          activeResults
            .filter((r) => r.status === 'success')
            .reduce((sum, r) => sum + r.latency, 0) / successCount || 0

        console.log(
          `\n📈 Summary: ${successCount}/${activeResults.length} APIs working, ${errorCount} failed, avg latency: ${avgLatency.toFixed(0)}ms`,
        )

        resolve()
      },
    })
  })
}

if (import.meta.main) {
  runTests().catch(console.error)
}
