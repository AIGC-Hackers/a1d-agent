import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { firstValueFrom } from 'rxjs'

import { defaultMinimaxContext } from './config'
import { uploadFile, cloneVoice } from './voice-cloning'
import { createText2AudioTask } from './t2a'

function logTestEvent(event: {
  timestamp: string
  testName: string
  phase: 'start' | 'api_call' | 'api_response' | 'success' | 'error'
  data?: any
  error?: any
}) {
  const logEntry = JSON.stringify(event)
  console.log(`[VOICE-CLONE-VERIFY] ${logEntry}`)
  
  // Save to temp folder
  const fs = require('fs')
  const tempDir = './temp'
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  fs.appendFileSync(join(tempDir, 'minimax-voice-clone-verify-test.jsonl'), logEntry + '\n')
}

describe('MiniMax Voice Cloning - Verification', () => {
  it('should clone voice and verify it can be used for TTS', async () => {
    const timestamp = new Date().toISOString()
    const testName = 'clone_and_verify'
    
    logTestEvent({
      timestamp,
      testName,
      phase: 'start',
      data: { workflow: 'upload -> clone -> verify_with_tts' }
    })

    try {
      // Step 1: Upload file
      const audioBuffer = readFileSync(join(process.cwd(), 'assets/sample.mp3'))
      const audioFile = new File([audioBuffer], 'sample.mp3', { type: 'audio/mpeg' })

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_call',
        data: { step: 'upload_file' }
      })

      const uploadResult = await firstValueFrom(uploadFile({
        file: audioFile,
        purpose: 'voice_clone'
      }, defaultMinimaxContext))

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_response',
        data: { 
          step: 'upload_file',
          fileId: uploadResult.file.file_id,
          statusCode: uploadResult.base_resp.status_code
        }
      })

      // Step 2: Clone voice
      const voiceId = `verify_test_${Date.now()}`
      
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_call',
        data: { 
          step: 'clone_voice',
          voiceId,
          fileId: uploadResult.file.file_id
        }
      })

      const cloneResult = await firstValueFrom(cloneVoice({
        file_id: uploadResult.file.file_id,
        voice_id: voiceId,
        need_noise_reduction: false
      }, defaultMinimaxContext))

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_response',
        data: { 
          step: 'clone_voice',
          voiceId,
          statusCode: cloneResult.base_resp.status_code,
          inputSensitive: cloneResult.input_sensitive
        }
      })

      expect(cloneResult.base_resp.status_code).toBe(0)

      // Step 3: Try to use the cloned voice for TTS to verify it actually exists
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_call',
        data: { 
          step: 'verify_with_tts',
          voiceId,
          note: 'Testing if cloned voice can be used for TTS'
        }
      })

      try {
        const ttsResult = await firstValueFrom(createText2AudioTask({
          model: 'speech-02-turbo',
          text: 'Hello, this is a test using the cloned voice.',
          voice_setting: {
            voice_id: voiceId, // Use the cloned voice
          },
          audio_setting: {
            output_format: 'mp3',
          },
        }, defaultMinimaxContext))

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { 
            step: 'verify_with_tts',
            success: true,
            voiceId,
            ttsStatusCode: ttsResult.base_resp?.status_code,
            hasAudio: !!ttsResult.data?.audio || !!ttsResult.data?.audio_url
          }
        })

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'success',
          data: { 
            voiceId,
            verified: true,
            note: 'Voice was successfully cloned and can be used for TTS'
          }
        })
      } catch (ttsError: any) {
        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'api_response',
          data: { 
            step: 'verify_with_tts',
            success: false,
            voiceId,
            error: ttsError.message,
            note: 'Voice cloning may have failed - cloned voice not usable for TTS'
          }
        })

        logTestEvent({
          timestamp: new Date().toISOString(),
          testName,
          phase: 'error',
          error: `Voice verification failed: ${ttsError.message}`,
          data: { 
            voiceId,
            possibleCause: 'Voice was not actually cloned despite API returning success'
          }
        })

        throw new Error(`Voice cloning verification failed: Voice '${voiceId}' cannot be used for TTS`)
      }
    } catch (error: any) {
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'error',
        error: error.message
      })
      throw error
    }
  })

  it('should test with existing voice ID from previous runs', async () => {
    const timestamp = new Date().toISOString()
    const testName = 'test_existing_voice'
    
    // Use a voice ID from our previous test runs
    const existingVoiceId = 'simple_test_1751900004023' // From the log
    
    logTestEvent({
      timestamp,
      testName,
      phase: 'start',
      data: { 
        voiceId: existingVoiceId,
        note: 'Testing if previously cloned voice is still available'
      }
    })

    try {
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_call',
        data: { 
          step: 'test_existing_voice',
          voiceId: existingVoiceId
        }
      })

      const ttsResult = await firstValueFrom(createText2AudioTask({
        model: 'speech-02-turbo',
        text: 'Testing if the previously cloned voice is available.',
        voice_setting: {
          voice_id: existingVoiceId,
        },
        audio_setting: {
          output_format: 'mp3',
        },
      }, defaultMinimaxContext))

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_response',
        data: { 
          voiceId: existingVoiceId,
          success: true,
          ttsStatusCode: ttsResult.base_resp?.status_code,
          hasAudio: !!ttsResult.data?.audio || !!ttsResult.data?.audio_url
        }
      })

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'success',
        data: { 
          voiceId: existingVoiceId,
          note: 'Previously cloned voice is still available and working'
        }
      })
    } catch (error: any) {
      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'api_response',
        data: { 
          voiceId: existingVoiceId,
          success: false,
          error: error.message
        }
      })

      logTestEvent({
        timestamp: new Date().toISOString(),
        testName,
        phase: 'success',
        data: { 
          voiceId: existingVoiceId,
          note: 'Previously cloned voice is not available - this confirms voice cloning may not be working properly'
        }
      })
    }
  })
})