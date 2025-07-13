import { env } from '@/lib/env'
import { firstValueFrom, merge, Observable, Subscription } from 'rxjs'

import type { X302Context } from './302/config'
import { Midjourney } from './302/midjourney'
import { generateImage as generateRecraft } from './302/recraft'
import { Midjourney as HuiyanMidjourney } from './huiyan/midjourney'
import { WaveSpeedFluxKontext } from './wavespeed/wave-speed-flux-kontext'

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
  provider: string
  model: string
  status: TestStatus
  latency: number
  jobId?: string
  imageUrl?: string
  error?: string
}

type TestConfig = {
  name: string
  provider: string
  model: string
  skip?: boolean
  timeout?: number
  pollInterval?: number
  prompt?: string
  test: () => Observable<TestEvent>
}

function create302MidjourneyTest(prompt?: string): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()
      let jobId: string | undefined
      let subscription: Subscription | undefined

      observer.next({ type: 'start', name: '302.AI Midjourney' })

      const ctx: X302Context = {
        apiKey: env.value.X_302_API_KEY,
      }

      subscription = Midjourney.generateImageStream(
        {
          prompt: prompt || 'a simple red circle on white background',
          botType: 'MID_JOURNEY',
          onSubmit: (data) => {
            jobId = data.jobId
            observer.next({
              type: 'log',
              name: '302.AI Midjourney',
              message: `Job submitted: ${data.jobId}`,
              level: 'info',
            })
          },
          pollInterval: 2000,
          timeout: 300000,
        },
        ctx,
      ).subscribe({
        next: (job: any) => {
          const progress = Number(job.progress || 0)
          observer.next({
            type: 'progress',
            name: '302.AI Midjourney',
            progress,
            message: `Progress: ${progress}%`,
          })

          if (job.progress === 100 && job.imageUrl) {
            const latency = Date.now() - startTime
            observer.next({
              type: 'complete',
              name: '302.AI Midjourney',
              result: {
                name: '302.AI Midjourney',
                provider: '302.AI',
                model: 'Midjourney',
                status: 'success',
                latency,
                jobId: job.id,
                imageUrl: job.imageUrl,
              },
            })
            observer.complete()
          }
        },
        error: (error) => {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'complete',
            name: '302.AI Midjourney',
            result: {
              name: '302.AI Midjourney',
              provider: '302.AI',
              model: 'Midjourney',
              status: 'error',
              latency,
              jobId,
              error: errorMessage,
            },
          })
          observer.complete()
        },
      })

      return () => {
        subscription?.unsubscribe()
      }
    })
}

function createRecraftTest(prompt?: string): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()

      observer.next({ type: 'start', name: '302.AI Recraft' })
      observer.next({
        type: 'log',
        name: '302.AI Recraft',
        message: 'Starting Recraft generation...',
        level: 'info',
      })

      firstValueFrom(
        generateRecraft({
          prompt: prompt || 'a simple red circle on white background',
          image_size: { width: 512, height: 512 },
          style: 'digital_illustration/hand_drawn',
        }),
      )
        .then((result) => {
          const latency = Date.now() - startTime
          observer.next({
            type: 'complete',
            name: '302.AI Recraft',
            result: {
              name: '302.AI Recraft',
              provider: '302.AI',
              model: 'Recraft',
              status: 'success',
              latency,
              imageUrl: result.images?.[0]?.url,
            },
          })
          observer.complete()
        })
        .catch((error) => {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'complete',
            name: '302.AI Recraft',
            result: {
              name: '302.AI Recraft',
              provider: '302.AI',
              model: 'Recraft',
              status: 'error',
              latency,
              error: errorMessage,
            },
          })
          observer.complete()
        })
    })
}

function createHuiyanMidjourneyTest(
  prompt?: string,
): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()
      let jobId: string | undefined
      let subscription: Subscription | undefined

      observer.next({ type: 'start', name: 'Huiyan Midjourney' })

      const client = HuiyanMidjourney.client

      client
        .submitImagine({
          prompt: prompt || 'a simple red circle on white background',
          botType: 'MID_JOURNEY',
        })
        .subscribe({
          next: (result) => {
            if (result.code !== 1) {
              throw new Error(result.description)
            }
            jobId = result.result
            observer.next({
              type: 'log',
              name: 'Huiyan Midjourney',
              message: `Job submitted: ${jobId}`,
              level: 'info',
            })

            // Start polling
            subscription = client
              .pollStream(jobId, {
                pollInterval: 2000,
                timeout: 300000,
              })
              .subscribe({
                next: (job) => {
                  const pstr = String(job.progress) ?? ''
                  let progress = 0
                  if (pstr !== '') {
                    progress = Number(pstr.replace('%', ''))
                  }
                  observer.next({
                    type: 'progress',
                    name: 'Huiyan Midjourney',
                    progress: progress,
                    message: `Progress: ${progress}%`,
                  })

                  if (progress === 100 && job.imageUrl) {
                    const latency = Date.now() - startTime
                    observer.next({
                      type: 'complete',
                      name: 'Huiyan Midjourney',
                      result: {
                        name: 'Huiyan Midjourney',
                        provider: 'Huiyan',
                        model: 'Midjourney',
                        status: 'success',
                        latency,
                        jobId: job.id,
                        imageUrl: job.imageUrl,
                      },
                    })
                    observer.complete()
                  }
                },
                error: (error) => {
                  const latency = Date.now() - startTime
                  const errorMessage =
                    error instanceof Error ? error.message : String(error)
                  observer.next({
                    type: 'complete',
                    name: 'Huiyan Midjourney',
                    result: {
                      name: 'Huiyan Midjourney',
                      provider: 'Huiyan',
                      model: 'Midjourney',
                      status: 'error',
                      latency,
                      jobId,
                      error: errorMessage,
                    },
                  })
                  observer.complete()
                },
              })
          },
          error: (error) => {
            const latency = Date.now() - startTime
            const errorMessage =
              error instanceof Error ? error.message : String(error)
            observer.next({
              type: 'complete',
              name: 'Huiyan Midjourney',
              result: {
                name: 'Huiyan Midjourney',
                provider: 'Huiyan',
                model: 'Midjourney',
                status: 'error',
                latency,
                jobId,
                error: errorMessage,
              },
            })
            observer.complete()
          },
        })

      return () => {
        subscription?.unsubscribe()
      }
    })
}

function createWavespeedFluxTest(prompt?: string): () => Observable<TestEvent> {
  return () =>
    new Observable<TestEvent>((observer) => {
      const startTime = Date.now()

      observer.next({ type: 'start', name: 'Wavespeed Flux' })
      observer.next({
        type: 'log',
        name: 'Wavespeed Flux',
        message: 'Starting Wavespeed Flux generation...',
        level: 'info',
      })

      WaveSpeedFluxKontext.create({
        prompt: prompt || 'a simple red circle on white background',
        image:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      })
        .then((result) => {
          const latency = Date.now() - startTime

          if (result.code === 200) {
            observer.next({
              type: 'log',
              name: 'Wavespeed Flux',
              message: `Job ID: ${result.data.id}`,
              level: 'info',
            })
            observer.next({
              type: 'complete',
              name: 'Wavespeed Flux',
              result: {
                name: 'Wavespeed Flux',
                provider: 'Wavespeed',
                model: 'Flux Kontext Pro',
                status: 'success',
                latency,
                jobId: result.data?.id,
              },
            })
          } else {
            observer.next({
              type: 'complete',
              name: 'Wavespeed Flux',
              result: {
                name: 'Wavespeed Flux',
                provider: 'Wavespeed',
                model: 'Flux Kontext Pro',
                status: 'error',
                latency,
                error: `Failed with code ${result.code}: ${result.message}`,
              },
            })
          }
          observer.complete()
        })
        .catch((error) => {
          const latency = Date.now() - startTime
          const errorMessage =
            error instanceof Error ? error.message : String(error)
          observer.next({
            type: 'complete',
            name: 'Wavespeed Flux',
            result: {
              name: 'Wavespeed Flux',
              provider: 'Wavespeed',
              model: 'Flux Kontext Pro',
              status: 'error',
              latency,
              error: errorMessage,
            },
          })
          observer.complete()
        })
    })
}

// Test configurations
const TEST_CONFIGS: TestConfig[] = [
  {
    name: '302.AI Midjourney',
    provider: '302.AI',
    model: 'Midjourney',
    skip: true, // Skip by default due to cost
    timeout: 300000,
    test: create302MidjourneyTest(),
  },
  {
    name: '302.AI Recraft',
    provider: '302.AI',
    model: 'Recraft',
    skip: true, // Skip by default due to cost
    timeout: 60000,
    test: createRecraftTest(),
  },
  {
    name: 'Huiyan Midjourney',
    provider: 'Huiyan',
    model: 'Midjourney',
    skip: false,
    timeout: 300000,
    test: createHuiyanMidjourneyTest(),
  },
  {
    name: 'Wavespeed Flux',
    provider: 'Wavespeed',
    model: 'Flux Kontext Pro',
    skip: false,
    timeout: 60000,
    test: createWavespeedFluxTest(),
  },
]

async function runTests(configs: TestConfig[] = TEST_CONFIGS): Promise<void> {
  console.log('🎨 Testing Image Generation Integrations...\n')

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

  console.log('Starting concurrent tests...\n')

  const results: TestResult[] = []
  const progressMap = new Map<string, number>()

  // Create observables for all active tests
  const testObservables = activeConfigs.map((config) => config.test())

  // Wait for all tests to complete
  await new Promise<void>((resolve) => {
    // Merge all observables to handle events
    merge(...testObservables).subscribe({
      next: (event) => {
        switch (event.type) {
          case 'start':
            console.log(`[${event.name}] Starting...`)
            break
          case 'progress':
            progressMap.set(event.name, event.progress)
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
            provider: config.provider,
            model: config.model,
            status: 'skipped',
            latency: 0,
          })
        })

        // Display results table
        console.log('\n📊 Test Results:')
        console.table(
          results.map((result) => ({
            Provider: result.provider,
            Model: result.model,
            Status:
              result.status === 'success'
                ? '✅ Success'
                : result.status === 'skipped'
                  ? '⏭️  Skipped'
                  : '❌ Error',
            'Latency(ms)': result.status === 'skipped' ? '-' : result.latency,
            'Job ID':
              result.jobId || (result.status === 'skipped' ? '-' : 'N/A'),
            'Image URL':
              result.status === 'skipped'
                ? '-'
                : result.imageUrl
                  ? '✅ Generated'
                  : 'N/A',
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
          `\n📈 Summary: ${successCount}/${activeResults.length} providers working, ${errorCount} failed, avg latency: ${avgLatency.toFixed(0)}ms`,
        )

        resolve()
      },
    })
  })
}

runTests().catch(console.error)
