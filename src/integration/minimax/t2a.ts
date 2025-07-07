import { Observable, switchMap, timer, takeWhile } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'
import { events } from 'fetch-event-stream'

import type { MinimaxContext } from './config'
import { getMinimaxHeaders } from './config'

// Pattern: Use TypeScript types for API contracts - trust the API documentation
// AI guidance: Model the actual API response structure with good field comments
export type Text2AudioInput = {
  text: string // Text content to convert to audio
  voice_id?: string // Voice ID for synthesis
  speed?: number // Speech speed (0.5-2.0)
  vol?: number // Volume (0.1-1.0)
  pitch?: number // Pitch adjustment
  format?: 'mp3' | 'wav' | 'pcm' // Output audio format
  sample_rate?: number // Sample rate (8000, 16000, 24000, 48000)
}

export type Text2AudioOutput = {
  trace_id: string
  audio_file?: string // Direct audio URL if synchronous
  task_id?: string // Task ID for async processing
  status?: 'processing' | 'completed' | 'failed'
  error?: {
    code: string
    message: string
  }
}

// Pattern: Simple response handler - no schema validation for internal APIs
async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (import.meta.env.DEV) {
      const text = await response.text()
      console.error(
        `Minimax API request failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
      )
    }
    throw new Error(
      `Minimax API request failed: ${response.status} ${response.statusText}`,
    )
  }
  return response.json()
}

// Pattern: API client function with minimal validation
// AI guidance: Separate authentication config from request data, trust TypeScript types
export function text2Audio(
  input: Text2AudioInput,
  context: MinimaxContext,
): Observable<Text2AudioOutput> {
  const url = `${context.baseUrl}/t2a_v2`
  
  return fromFetch(url, {
    method: 'POST',
    headers: getMinimaxHeaders(context),
    body: JSON.stringify({
      ...input,
      group_id: context.groupId,
    }),
  }).pipe(
    switchMap((response) =>
      handleJsonResponse<Text2AudioOutput>(response),
    ),
  )
}

// Pattern: Polling API for long-running tasks - submit job then poll for completion
export type AudioTaskStatus = {
  task_id: string
  status: 'processing' | 'completed' | 'failed'
  audio_file?: string
  progress?: number
  error?: {
    code: string
    message: string
  }
}

export function pollAudioTask(
  params: {
    taskId: string
    pollInterval?: number // milliseconds between polls
  },
  context: MinimaxContext,
): Observable<AudioTaskStatus> {
  const { taskId, pollInterval = 2000 } = params
  const url = `${context.baseUrl}/query/t2a_v2/${taskId}`

  return timer(0, pollInterval).pipe(
    switchMap(() =>
      fromFetch(url, {
        method: 'GET',
        headers: getMinimaxHeaders(context),
      }).pipe(
        switchMap((response) =>
          handleJsonResponse<AudioTaskStatus>(response),
        ),
      ),
    ),
    takeWhile(
      (task) => task.status === 'processing',
      true, // Emit the final completed/failed state
    ),
  )
}

// Higher-level function that combines submission and polling
export function text2AudioStream(
  input: Text2AudioInput,
  context: MinimaxContext,
  pollInterval?: number,
): Observable<Text2AudioOutput | AudioTaskStatus> {
  return text2Audio(input, context).pipe(
    switchMap((result) => {
      // If we get a direct audio file, we're done
      if (result.audio_file) {
        return [result]
      }
      
      // Otherwise, poll for the task completion
      if (result.task_id) {
        return pollAudioTask(
          { taskId: result.task_id, pollInterval },
          context,
        )
      }
      
      throw new Error('No audio file or task ID in response')
    }),
  )
}

// Pattern: SSE streaming for real-time audio generation
// AI guidance: Returns an async iterator that yields audio chunks as hex strings
export type AudioStreamChunk = {
  audio: string // Hex-encoded audio chunk
  trace_id?: string
  status?: number
  extra_info?: {
    audio_length: number
    audio_sample_rate: number
    audio_size: number
    audio_bitrate: number
    word_count: number
    audio_format: string
    usage_characters: number
  }
}

export async function* text2AudioSSEStream(
  input: Text2AudioInput,
  context: MinimaxContext,
): AsyncIterableIterator<AudioStreamChunk> {
  const url = `${context.baseUrl}/t2a_v2`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: getMinimaxHeaders(context),
    body: JSON.stringify({
      ...input,
      group_id: context.groupId,
      stream: true, // Enable SSE streaming
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Minimax API request failed: ${response.status} ${response.statusText}`,
    )
  }

  // Use fetch-event-stream to iterate over SSE events
  for await (const event of events(response)) {
    if (event.data && event.data !== '[DONE]') {
      try {
        const data = JSON.parse(event.data)
        
        // Check if this is an audio chunk
        if (data.data?.audio) {
          yield {
            audio: data.data.audio,
            trace_id: data.trace_id,
            status: data.data.status,
            extra_info: data.extra_info,
          }
        }
      } catch (error) {
        // Skip malformed events
        if (import.meta.env.DEV) {
          console.warn('Failed to parse SSE event:', event.data, error)
        }
      }
    }
  }
}

// Convenience function to decode hex audio chunks to binary
export function decodeAudioChunk(hexString: string): Uint8Array {
  const bytes = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
  }
  return bytes
}