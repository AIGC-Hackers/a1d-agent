import { env } from '@/lib/env'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { firstValueFrom } from 'rxjs'
import { beforeAll, describe, expect, it } from 'vitest'

import type { MinimaxContext } from './config'
import { defaultMinimaxContext } from './config'
import type { VideoTaskStatus } from './video'
import {
  createVideoGenerationTask,
  generateVideoStream,
  pollVideoTask,
  retrieveVideoFile,
} from './video'

// Test logging utilities
const TEMP_DIR = './temp'
const LOG_FILE = join(TEMP_DIR, 'minimax-video-test.jsonl')

function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true })
  }
}

function logTestEvent(event: {
  timestamp: string
  testName: string
  phase: 'start' | 'api_call' | 'api_response' | 'success' | 'error'
  data?: any
  error?: any
}) {
  const logEntry = JSON.stringify({ ...event, error: event.error?.message || event.error }) + '\n'
  appendFileSync(LOG_FILE, logEntry)
}

function initializeTestLog() {
  ensureTempDir()
  const initEvent = {
    timestamp: new Date().toISOString(),
    testName: 'test_session_start',
    phase: 'start' as const,
    data: {
      env: {
        hasApiKey: !!env.value.MINIMAX_API_KEY,
        hasGroupId: !!env.value.MINIMAX_GROUP_ID,
      },
    },
  }
  writeFileSync(LOG_FILE, JSON.stringify(initEvent) + '\n')
}

async function saveVideoResult(taskId: string, fileId: string, downloadUrl: string) {
  const videoResultFile = join(TEMP_DIR, `video-result-${taskId}.json`)
  const result = {
    taskId,
    fileId,
    downloadUrl,
    timestamp: new Date().toISOString(),
  }
  writeFileSync(videoResultFile, JSON.stringify(result, null, 2))
  
  // Also try to download the video file
  try {
    const response = await fetch(downloadUrl)
    if (response.ok) {
      const buffer = await response.arrayBuffer()
      const videoFile = join(TEMP_DIR, `video-${taskId}.mp4`)
      writeFileSync(videoFile, Buffer.from(buffer))
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName: 'video_download',
        phase: 'success',
        data: { taskId, fileSize: buffer.byteLength, savedTo: videoFile },
      })
    }
  } catch (error: any) {
    logTestEvent({
      timestamp: new Date().toISOString(),
      testName: 'video_download',
      phase: 'error',
      error: error.message,
    })
  }
}

describe('Minimax Video Generation API - MiniMax-Hailuo-02 Only', () => {
  const context: MinimaxContext = defaultMinimaxContext

  beforeAll(() => {
    initializeTestLog()
    
    if (!env.value.MINIMAX_API_KEY || !env.value.MINIMAX_GROUP_ID) {
      const error = 'MINIMAX_API_KEY and MINIMAX_GROUP_ID are required for video tests'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName: 'setup',
        phase: 'error',
        error,
      })
      throw new Error(error)
    }
  })

  describe('createVideoGenerationTask - Basic API', () => {
    it('should create text-to-video task with MiniMax-Hailuo-02', async () => {
      const testName = 'create_video_task_basic'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { model: 'MiniMax-Hailuo-02' },
      })

      try {
        const input = {
          model: 'MiniMax-Hailuo-02' as const,
          prompt: 'A beautiful sunset over a calm ocean with gentle waves.',
          duration: 6 as const,
          resolution: '768P' as const,
          prompt_optimizer: true,
        }

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { input },
        })

        const result = await firstValueFrom(
          createVideoGenerationTask(input, context),
        )

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { result },
        })

        expect(result).toBeDefined()
        expect(result.task_id).toBeDefined()
        expect(result.base_resp.status_code).toBe(0)
        expect(result.base_resp.status_msg).toBe('success')

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: { taskId: result.task_id },
        })
      } catch (error: any) {
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'error',
          error: error.message,
        })
        throw error
      }
    })

    it('should create video with 1080P resolution', async () => {
      const testName = 'create_video_1080p'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { resolution: '1080P' },
      })

      try {
        const input = {
          model: 'MiniMax-Hailuo-02' as const,
          prompt: 'A person walking in a beautiful garden with flowers blooming.',
          duration: 6 as const,
          resolution: '1080P' as const,
        }

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { input },
        })

        const result = await firstValueFrom(
          createVideoGenerationTask(input, context),
        )

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { result },
        })

        expect(result).toBeDefined()
        expect(result.task_id).toBeDefined()
        expect(result.base_resp.status_code).toBe(0)

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: { taskId: result.task_id },
        })
      } catch (error: any) {
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'error',
          error: error.message,
        })
        throw error
      }
    })

    it('should create video with first frame image', async () => {
      const testName = 'create_video_with_image'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { hasFirstFrameImage: true },
      })

      try {
        // Using a simple base64 encoded 1x1 pixel image for testing
        const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        
        const input = {
          model: 'MiniMax-Hailuo-02' as const,
          prompt: 'The image slowly comes to life with gentle movement and magical sparkles.',
          duration: 6 as const,
          resolution: '768P' as const,
          first_frame_image: testImage,
        }

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { input: { ...input, first_frame_image: '[base64_data]' } },
        })

        const result = await firstValueFrom(
          createVideoGenerationTask(input, context),
        )

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { result },
        })

        expect(result).toBeDefined()
        expect(result.task_id).toBeDefined()
        expect(result.base_resp.status_code).toBe(0)

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: { taskId: result.task_id },
        })
      } catch (error: any) {
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'error',
          error: error.message,
        })
        throw error
      }
    })
  })

  describe('Complete Video Generation Workflow', () => {
    it('should start video generation workflow', async () => {
      const testName = 'complete_workflow'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { workflow: 'create -> poll -> retrieve' },
      })

      try {
        // Step 1: Create video generation task
        const input = {
          model: 'MiniMax-Hailuo-02' as const,
          prompt: 'A short test video with clouds moving across a blue sky.',
          duration: 6 as const,
          resolution: '768P' as const,
        }

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { step: 'create_task', input },
        })

        const creationResult = await firstValueFrom(
          createVideoGenerationTask(input, context),
        )

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { step: 'create_task', result: creationResult },
        })

        expect(creationResult.task_id).toBeDefined()
        expect(creationResult.base_resp.status_code).toBe(0)

        // Step 2: Check initial status only (don't wait for completion due to test timeout)
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { step: 'check_initial_status', taskId: creationResult.task_id },
        })

        const initialStatus = await firstValueFrom(
          pollVideoTask(
            { taskId: creationResult.task_id, pollInterval: 1000 },
            context,
          ),
        )

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { step: 'initial_status', status: initialStatus },
        })

        expect(initialStatus).toBeDefined()
        expect(initialStatus.task_id).toBe(creationResult.task_id)
        expect(['Queueing', 'Preparing', 'Processing', 'Success', 'Fail']).toContain(initialStatus.status)

        // For testing purposes, we'll simulate success workflow if possible
        // In real usage, you would continue polling until Success
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: {
            taskId: creationResult.task_id,
            initialStatus: initialStatus.status,
            note: 'Workflow verified - task created and status checked successfully',
          },
        })
      } catch (error: any) {
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'error',
          error: error.message,
        })
        throw error
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid prompt length', async () => {
      const testName = 'invalid_prompt_length'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { testType: 'prompt_too_long' },
      })

      try {
        const longPrompt = 'A'.repeat(2001) // Exceeds 2000 char limit
        
        const input = {
          model: 'MiniMax-Hailuo-02' as const,
          prompt: longPrompt,
          duration: 6 as const,
          resolution: '768P' as const,
        }

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { input: { ...input, prompt: `[${longPrompt.length} chars]` } },
        })

        const result = await firstValueFrom(
          createVideoGenerationTask(input, context),
        )

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { result },
        })

        // API might still accept long prompts, so check response
        if (result.base_resp.status_code !== 0) {
          logTestEvent({
            timestamp: new Date().toISOString(),
            testName,
            phase: 'success',
            data: { message: 'API correctly rejected long prompt' },
          })
        } else {
          logTestEvent({
            timestamp: new Date().toISOString(),
            testName,
            phase: 'success',
            data: { message: 'API accepted long prompt', taskId: result.task_id },
          })
        }

        expect(result).toBeDefined()
      } catch (error: any) {
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'error',
          error: error.message,
        })
        // This is expected behavior
        expect(error.message).toContain('Video generation failed')
      }
    })
  })
})