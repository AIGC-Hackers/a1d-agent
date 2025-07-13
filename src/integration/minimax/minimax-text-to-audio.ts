import { events } from 'fetch-event-stream'
import { Observable, switchMap, takeWhile, timer } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import type { MinimaxContext } from './config'
import { defaultMinimaxContext, getMinimaxHeaders } from './config'

//
export namespace MinimaxTextToAudio {
  // Pattern: Use TypeScript types for API contracts - trust the API documentation
  // AI guidance: Model the actual API response structure with good field comments
  export type VoiceSetting = {
    voice_id?: string // Voice ID for synthesis
    speed?: number // Speech speed
    vol?: number // Volume
    pitch?: number // Pitch adjustment
  }

  export type AudioSetting = {
    output_format?: 'mp3' | 'wav' | 'pcm' // Output audio format
    sample_rate?: number // Sample rate
    bitrate?: number // Audio bitrate
    channel?: number // Audio channel count
  }

  export type PronunciationDict = {
    tone: string[] // Array of pronunciation replacements in format ["燕少飞/(yan4)(shao3)(fei1)", "达菲/(da2)(fei1)", "omg/oh my god"]
  }

  export type TimberWeight = {
    voice_id: string // System voice ID
    weight: number // Weight value in range [1, 100], supports up to 4 voices
  }

  export type TimberWeights = TimberWeight[] // Array of voice weights for mixing

  export type Text2AudioInput = {
    model:
      | 'speech-02-hd'
      | 'speech-02-turbo'
      | 'speech-01-hd'
      | 'speech-01-turbo' // Available models
    text: string // Text to be synthesized. Character limit < 5000 chars
    voice_setting?: VoiceSetting // Voice settings (requires voice_id if timber_weights not provided)
    audio_setting?: AudioSetting // Audio settings
    pronunciation_dict?: PronunciationDict // Pronunciation dictionary for manual tone/pronunciation control
    timber_weights?: TimberWeights // Voice mixing weights (required if voice_id not provided)
    stream?: boolean // Whether to enable streaming
    language_boost?:
      | 'Chinese'
      | 'Chinese,Yue'
      | 'English'
      | 'Arabic'
      | 'Russian'
      | 'Spanish'
      | 'French'
      | 'Portuguese'
      | 'German'
      | 'Turkish'
      | 'Dutch'
      | 'Ukrainian'
      | 'Vietnamese'
      | 'Indonesian'
      | 'Japanese'
      | 'Italian'
      | 'Korean'
      | 'Thai'
      | 'Polish'
      | 'Romanian'
      | 'Greek'
      | 'Czech'
      | 'Finnish'
      | 'Hindi'
      | 'auto' // Language enhancement
    subtitle_enable?: boolean // Whether to enable subtitles (only for non-streaming)
    output_format?: 'url' | 'hex' // Output format (only for non-streaming)
  }

  export type ExtraInfo = {
    audio_length?: number
    audio_sample_rate?: number
    audio_size?: number
    audio_bitrate?: number
    word_count?: number
    audio_format?: string
    usage_characters?: number
  }

  export type BaseResp = {
    status_code?: number
    status_msg?: string
  }

  export type Text2AudioOutput = {
    data?: {
      audio?: string // Hex-encoded audio data
      audio_url?: string // Audio URL if output_format is 'url'
      status?: number
    } | null
    trace_id: string
    subtitle_file?: string // Subtitle download link
    extra_info?: ExtraInfo
    base_resp?: BaseResp
  }

  export class Client {
    constructor(private readonly ctx: MinimaxContext) {}

    create(input: Text2AudioInput) {
      return create(input, this.ctx)
    }

    poll(taskId: string) {
      return poll({ taskId }, this.ctx)
    }

    stream(input: Text2AudioInput) {
      return stream(input, this.ctx)
    }
  }

  export const client = new Client(defaultMinimaxContext)

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
  function create(
    input: Text2AudioInput,
    context: MinimaxContext,
  ): Observable<Text2AudioOutput> {
    const url = `${context.baseUrl}/v1/t2a_v2?GroupId=${context.groupId}`

    return fromFetch(url, {
      method: 'POST',
      headers: {
        ...getMinimaxHeaders(context),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }).pipe(
      switchMap((response) => handleJsonResponse<Text2AudioOutput>(response)),
    )
  }

  // Pattern: Polling API for long-running tasks - submit job then poll for completion
  export type AudioTaskStatus = {
    data?: {
      audio?: string
      audio_url?: string
      status?: number
    } | null
    trace_id: string
    subtitle_file?: string
    extra_info?: ExtraInfo
    base_resp?: BaseResp
  }

  function poll(
    params: {
      taskId: string
      pollInterval?: number // milliseconds between polls
    },
    context: MinimaxContext,
  ): Observable<AudioTaskStatus> {
    const { taskId, pollInterval = 2000 } = params
    const url = `${context.baseUrl}/v1/query/t2a_v2/${taskId}?GroupId=${context.groupId}`

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
        (task) => !task.data?.audio && !task.data?.audio_url,
        true, // Emit the final completed state
      ),
    )
  }

  // Pattern: SSE streaming for real-time audio generation
  // AI guidance: Returns an async iterator that yields audio chunks as hex strings
  export type AudioStreamChunk = {
    audio: string // Hex-encoded audio chunk
    trace_id?: string
    status?: number
    extra_info?: ExtraInfo
  }

  async function* stream(
    input: Text2AudioInput,
    context: MinimaxContext,
  ): AsyncIterableIterator<AudioStreamChunk> {
    const url = `${context.baseUrl}/v1/t2a_v2?GroupId=${context.groupId}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getMinimaxHeaders(context),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...input,
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
}
