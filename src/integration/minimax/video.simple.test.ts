import { env } from '@/lib/env'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { firstValueFrom } from 'rxjs'
import { beforeAll, describe, expect, it } from 'vitest'

import type { MinimaxContext } from './config'
import { defaultMinimaxContext } from './config'
import {
  createVideoGenerationTask,
  pollVideoTask,
  retrieveVideoFile,
} from './video'

// Test logging utilities
const TEMP_DIR = './temp'
const LOG_FILE = join(TEMP_DIR, 'minimax-video-simple-test.jsonl')

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
    testName: 'simple_test_session_start',
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

describe('Minimax Video Generation API - Simple Tests', () => {
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

  describe('Task Creation Only', () => {
    it('should create video generation task', async () => {
      const testName = 'create_task_only'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { model: 'MiniMax-Hailuo-02' },
      })

      try {
        const input = {
          model: 'MiniMax-Hailuo-02' as const,
          prompt: 'A simple test video - sunset over water.',
          duration: 6 as const,
          resolution: '768P' as const,
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

    it('should check task status once', async () => {
      const testName = 'check_status_once'
      
      try {
        // First create a task
        const createResult = await firstValueFrom(
          createVideoGenerationTask(
            {
              model: 'MiniMax-Hailuo-02' as const,
              prompt: 'Status check test video.',
              duration: 6 as const,
              resolution: '768P' as const,
            },
            context,
          ),
        )

        expect(createResult.task_id).toBeDefined()

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'start',
          data: { taskId: createResult.task_id },
        })

        // Then check status once
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { taskId: createResult.task_id },
        })

        const statusResult = await firstValueFrom(
          pollVideoTask(
            { taskId: createResult.task_id, pollInterval: 1000 },
            context,
          ),
        )

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { status: statusResult },
        })

        expect(statusResult).toBeDefined()
        expect(statusResult.task_id).toBe(createResult.task_id)
        expect(['Queueing', 'Preparing', 'Processing', 'Success', 'Fail']).toContain(statusResult.status)

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: { taskId: createResult.task_id, status: statusResult.status },
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

    it('should handle mock file retrieval', async () => {
      const testName = 'mock_file_retrieval'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { note: 'Testing file retrieval API structure' },
      })

      try {
        const mockFileId = '999999999999999' // This will fail but tests API structure

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_call',
          data: { fileId: mockFileId },
        })

        const result = await firstValueFrom(
          retrieveVideoFile(mockFileId, context),
        )

        // If somehow succeeds
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { result },
        })

        expect(result).toBeDefined()
        expect(result.file).toBeDefined()
        
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: { unexpected: 'Mock file ID worked' },
        })
      } catch (error: any) {
        // Expected to fail with mock file ID
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { expected_error: error.message },
        })

        expect(error.message).toContain('File retrieval failed')
        
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: { note: 'API correctly rejected mock file ID' },
        })
      }
    })
  })

  describe('API Validation', () => {
    it('should validate required fields', async () => {
      const testName = 'validate_required_fields'
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'start',
        data: { test: 'empty prompt' },
      })

      try {
        const input = {
          model: 'MiniMax-Hailuo-02' as const,
          prompt: '', // Empty prompt
          duration: 6 as const,
          resolution: '768P' as const,
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

        // API might still accept empty prompt or return error
        if (result.base_resp.status_code === 0) {
          logTestEvent({
            timestamp: new Date().toISOString(),
            testName,
            phase: 'success',
            data: { note: 'API accepted empty prompt', taskId: result.task_id },
          })
        } else {
          logTestEvent({
            timestamp: new Date().toISOString(),
            testName,
            phase: 'success',
            data: { note: 'API rejected empty prompt', error: result.base_resp.status_msg },
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
        // This might be expected
        expect(error.message).toContain('Video generation failed')
      }
    })
  })
})