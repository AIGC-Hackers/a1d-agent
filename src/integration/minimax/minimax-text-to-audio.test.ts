import { FileSource } from '@/lib/file-source'
import { firstValueFrom } from 'rxjs'
import { beforeAll, describe, expect, it } from 'vitest'

import { MinimaxTextToAudio } from './minimax-text-to-audio'

describe('Minimax Text-to-Audio API', () => {
  beforeAll(() => {})

  describe('text2Audio - Basic API', () => {
    it('should generate audio with voice_id', async () => {
      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'speech-02-turbo',
          text: 'Hello, this is a test of Minimax text to audio API.',
          voice_setting: {
            voice_id: 'male-qn-qingse',
            speed: 1.0,
            vol: 0.8,
          },
          audio_setting: {
            output_format: 'mp3',
            sample_rate: 24000,
          },
          output_format: 'hex',
        }),
      )

      expect(result).toBeDefined()
      expect(result.trace_id).toBeDefined()
      expect(result.data).toBeDefined()
      expect(result.data?.audio || result.data?.audio_url).toBeDefined()
      expect(result.base_resp?.status_code).toBe(0)
    })

    it('should generate audio with timber_weights mixing', async () => {
      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'speech-02-turbo',
          text: 'Testing voice mixing with multiple voices.',
          timber_weights: [
            { voice_id: 'male-qn-qingse', weight: 60 },
            { voice_id: 'female-shaonv', weight: 40 },
          ],
          audio_setting: {
            output_format: 'mp3',
          },
        }),
      )

      expect(result).toBeDefined()
      expect(result.trace_id).toBeDefined()
      expect(result.data).toBeDefined()
      expect(result.base_resp?.status_code).toBe(0)
    })

    it('should generate audio with pronunciation dictionary', async () => {
      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'speech-02-turbo',
          text: '你好，我是小明。',
          voice_setting: {
            voice_id: 'male-qn-qingse',
          },
          pronunciation_dict: {
            tone: ['小明/(xiao3)(ming2)'],
          },
          language_boost: 'Chinese',
        }),
      )

      expect(result).toBeDefined()
      expect(result.trace_id).toBeDefined()
      expect(result.data).toBeDefined()
      expect(result.base_resp?.status_code).toBe(0)
    })

    it('should handle subtitle generation request', async () => {
      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'speech-02-hd',
          text: 'This is a longer text for subtitle generation testing.',
          voice_setting: {
            voice_id: 'female-shaonv',
          },
          subtitle_enable: true,
          output_format: 'url',
        }),
      )

      expect(result).toBeDefined()

      // Check if subtitle feature is supported
      if (result.base_resp?.status_code === 0) {
        // If successful, verify audio was generated
        expect(result.data?.audio || result.data?.audio_url).toBeDefined()
        if (result.subtitle_file) {
          expect(result.subtitle_file).toBeDefined()
        }
      } else {
        // If subtitle feature is not supported, verify error response
        expect(result.base_resp?.status_code).toBe(2013)
        expect(result.base_resp?.status_msg).toContain('invalid params')
      }
    })
  })

  describe('textToAudioStream - Streaming API', () => {
    it('should stream audio chunks in real-time', async () => {
      const chunks: string[] = []
      let chunkCount = 0
      let totalBytes = 0

      const result = await MinimaxTextToAudio.client.stream({
        model: 'speech-02-turbo',
        text: 'This is a streaming test with real-time audio generation.',
        voice_setting: {
          voice_id: 'male-qn-qingse',
          speed: 1.2,
        },
        stream: true,
      })

      await new Promise<void>((resolve) => {
        result.events.subscribe({
          next: (event) => {
            if (event.type === 'audio_chunk') {
              expect(event.data.audio).toBeDefined()
              expect(typeof event.data.audio).toBe('string')
              expect(event.data.trace_id).toBeDefined()

              chunks.push(event.data.audio)
              chunkCount++
              totalBytes += event.data.audio.length

              // Validate hex encoding
              expect(event.data.audio).toMatch(/^[0-9a-fA-F]*$/)

              // Break after collecting enough chunks for testing
              if (chunkCount >= 5) {
                resolve()
              }
            }
          },
          complete: () => resolve(),
          error: (err) => {
            throw err
          },
        })
      })

      expect(chunkCount).toBeGreaterThan(0)
      expect(totalBytes).toBeGreaterThan(0)
      expect(chunks).toBeDefined()
    })

    it('should provide extra info in streaming response', async () => {
      let hasExtraInfo = false

      const result = await MinimaxTextToAudio.client.stream({
        model: 'speech-01-hd',
        text: 'Testing extra info in streaming response.',
        voice_setting: {
          voice_id: 'female-shaonv',
        },
      })

      await new Promise<void>((resolve) => {
        result.events.subscribe({
          next: (event) => {
            if (event.type === 'extra_info') {
              hasExtraInfo = true
              expect(event.data.extra_info.audio_sample_rate).toBeDefined()
              expect(event.data.extra_info.audio_format).toBeDefined()
              resolve()
            }
          },
          complete: () => resolve(),
          error: (err) => {
            throw err
          },
        })
      })

      expect(hasExtraInfo).toBe(true)
    })
  })

  describe('decodeAudioChunk - Utility Function', () => {
    it('should decode hex audio chunks to binary', () => {
      const hexString = '48656c6c6f' // "Hello" in hex
      const decoded = FileSource.decodeHexString(hexString)

      expect(decoded).toBeInstanceOf(Uint8Array)
      expect(decoded.length).toBe(5)
      expect(Array.from(decoded)).toEqual([72, 101, 108, 108, 111])
    })

    it('should handle empty hex strings', () => {
      const decoded = FileSource.decodeHexString('')
      expect(decoded).toBeInstanceOf(Uint8Array)
      expect(decoded.length).toBe(0)
    })

    it('should handle long hex strings', () => {
      const longHex = '0'.repeat(1000) // 500 bytes of zeros
      const decoded = FileSource.decodeHexString(longHex)

      expect(decoded).toBeInstanceOf(Uint8Array)
      expect(decoded.length).toBe(500)
      expect(decoded.every((byte) => byte === 0)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid model names', async () => {
      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'invalid-model' as any,
          text: 'Test text',
          voice_setting: {
            voice_id: 'male-qn-qingse',
          },
        }),
      )

      // API returns error response instead of throwing
      expect(result).toBeDefined()
      expect(result.base_resp?.status_code).not.toBe(0)
      expect(result.base_resp?.status_msg).toContain('invalid')
    })

    it('should handle missing required parameters', async () => {
      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'speech-02-turbo',
          text: 'Test without voice settings',
          // Missing both voice_setting and timber_weights
        }),
      )

      // API returns error response instead of throwing
      expect(result).toBeDefined()
      expect(result.base_resp?.status_code).not.toBe(0)
      expect(result.base_resp?.status_msg).toContain('invalid params')
    })

    it('should handle text exceeding character limit', async () => {
      const longText = 'A'.repeat(6000) // Exceeds 5000 char limit

      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'speech-02-turbo',
          text: longText,
          voice_setting: {
            voice_id: 'male-qn-qingse',
          },
        }),
      )

      // Note: API may still process long text successfully
      expect(result).toBeDefined()
      if (result.base_resp?.status_code === 0) {
        // If API accepts long text, verify audio was generated
        expect(result.data?.audio || result.data?.audio_url).toBeDefined()
      } else {
        // If API rejects long text, verify error message
        expect(result.base_resp?.status_msg).toBeDefined()
      }
    })
  })

  describe('Performance Tests', () => {
    it('should generate audio within reasonable time for short text', async () => {
      const startTime = Date.now()

      const result = await firstValueFrom(
        MinimaxTextToAudio.client.create({
          model: 'speech-01-turbo', // Turbo model for faster generation
          text: 'Quick test.',
          voice_setting: {
            voice_id: 'male-qn-qingse',
          },
        }),
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      expect(result).toBeDefined()
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
    })

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 3 }, (_, i) =>
        firstValueFrom(
          MinimaxTextToAudio.client.create({
            model: 'speech-02-turbo',
            text: `Concurrent request number ${i + 1}`,
            voice_setting: {
              voice_id: 'male-qn-qingse',
            },
          }),
        ),
      )

      const results = await Promise.all(requests)

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result).toBeDefined()
        expect(result.trace_id).toBeDefined()
        expect(result.data?.audio || result.data?.audio_url).toBeDefined()
      })
    })
  })
})
