import { readFileSync } from 'fs'
import { join } from 'path'
import { firstValueFrom } from 'rxjs'
import { describe, expect, it } from 'vitest'

import { defaultMinimaxContext } from './config'
import { cloneVoice, uploadFile } from './voice-cloning'

function logTestEvent(event: {
  timestamp: string
  testName: string
  phase: 'start' | 'api_call' | 'api_response' | 'success' | 'error'
  data?: any
  error?: any
}) {
  const logEntry = JSON.stringify(event)
  console.log(`[VOICE-CLONE-SIMPLE] ${logEntry}`)

  // Save to temp folder
  const fs = require('fs')
  const tempDir = './temp'
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  fs.appendFileSync(
    join(tempDir, 'minimax-voice-clone-simple-test.jsonl'),
    logEntry + '\n',
  )
}

describe('MiniMax Voice Cloning - Simple Tests', () => {
  it('should upload audio file only', async () => {
    const timestamp = new Date().toISOString()
    const testName = 'upload_only'

    logTestEvent({
      timestamp,
      testName,
      phase: 'start',
      data: {
        env: {
          hasApiKey: !!defaultMinimaxContext.apiKey,
          hasGroupId: !!defaultMinimaxContext.groupId,
        },
      },
    })

    try {
      const audioBuffer = readFileSync(join(process.cwd(), 'assets/sample.mp3'))
      const audioFile = new File([audioBuffer], 'sample.mp3', {
        type: 'audio/mpeg',
      })

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_call',
        data: {
          filename: audioFile.name,
          fileSize: audioFile.size,
          purpose: 'voice_clone',
        },
      })

      const result = await firstValueFrom(
        uploadFile(
          {
            file: audioFile,
            purpose: 'voice_clone',
          },
          defaultMinimaxContext,
        ),
      )

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_response',
        data: {
          fileId: result.file.file_id,
          statusCode: result.base_resp.status_code,
          statusMsg: result.base_resp.status_msg,
        },
      })

      expect(result.base_resp.status_code).toBe(0)
      expect(result.file.file_id).toBeDefined()

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'success',
        data: { fileId: result.file.file_id },
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

  it('should clone voice without preview', async () => {
    const timestamp = new Date().toISOString()
    const testName = 'clone_without_preview'

    logTestEvent({
      timestamp,
      testName,
      phase: 'start',
      data: { note: 'Clone voice without text preview to avoid extra charges' },
    })

    try {
      // Upload file first
      const audioBuffer = readFileSync(join(process.cwd(), 'assets/sample.mp3'))
      const audioFile = new File([audioBuffer], 'sample.mp3', {
        type: 'audio/mpeg',
      })

      const uploadResult = await firstValueFrom(
        uploadFile(
          {
            file: audioFile,
            purpose: 'voice_clone',
          },
          defaultMinimaxContext,
        ),
      )

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_call',
        data: {
          step: 'clone_voice',
          fileId: uploadResult.file.file_id,
          voiceId: `simple_test_${Date.now()}`,
        },
      })

      // Clone voice without preview text
      const cloneResult = await firstValueFrom(
        cloneVoice(
          {
            file_id: uploadResult.file.file_id,
            voice_id: `simple_test_${Date.now()}`,
            need_noise_reduction: false,
          },
          defaultMinimaxContext,
        ),
      )

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_response',
        data: {
          inputSensitive: cloneResult.input_sensitive,
          statusCode: cloneResult.base_resp.status_code,
          statusMsg: cloneResult.base_resp.status_msg,
        },
      })

      expect(cloneResult.base_resp.status_code).toBe(0)
      expect(cloneResult.input_sensitive).toBe(false)

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'success',
        data: {
          voiceCloned: true,
          note: 'Voice cloned successfully without preview',
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

  it('should validate file upload parameters', async () => {
    const timestamp = new Date().toISOString()
    const testName = 'validate_upload_params'

    logTestEvent({
      timestamp,
      testName,
      phase: 'start',
      data: { test: 'invalid_purpose' },
    })

    try {
      const audioBuffer = readFileSync(join(process.cwd(), 'assets/sample.mp3'))
      const audioFile = new File([audioBuffer], 'sample.mp3', {
        type: 'audio/mpeg',
      })

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_call',
        data: {
          purpose: 'voice_clone',
          note: 'Testing valid purpose parameter',
        },
      })

      const result = await firstValueFrom(
        uploadFile(
          {
            file: audioFile,
            purpose: 'voice_clone',
          },
          defaultMinimaxContext,
        ),
      )

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_response',
        data: {
          fileId: result.file.file_id,
          purpose: result.file.purpose,
          statusCode: result.base_resp.status_code,
        },
      })

      expect(result.file.purpose).toBe('voice_clone')
      expect(result.base_resp.status_code).toBe(0)

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'success',
        data: {
          purposeValidated: true,
          fileId: result.file.file_id,
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
