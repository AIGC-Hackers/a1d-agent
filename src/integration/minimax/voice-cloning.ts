import { type } from 'arktype'
import { Observable, switchMap } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import type { MinimaxContext } from './config'
import { getMinimaxHeaders } from './config'

// Pattern: Only use schema for user input with business constraints
const voiceCloneInputSchema = type({
  audio_file: type('File').narrow(
    (it, ctx) =>
      it.size <= 1024 * 1024 * 50 || ctx.reject('audio file must be less than 50MB'),
  ),
  name: 'string',
  'description?': 'string',
})

export type VoiceCloneInput = typeof voiceCloneInputSchema.infer

export type VoiceCloneOutput = {
  voice_id: string
  name: string
  status: 'processing' | 'ready' | 'failed'
  created_at: string
  error?: {
    code: string
    message: string
  }
}

// Pattern: Example with FormData - demonstrates why generic request wrappers are problematic
export function cloneVoice(
  input: VoiceCloneInput,
  context: MinimaxContext,
): Observable<VoiceCloneOutput> {
  // Validate user input with business rules (file size constraint)
  const validatedInput = voiceCloneInputSchema.assert(input)
  
  const formData = new FormData()
  formData.append('audio_file', validatedInput.audio_file)
  formData.append('name', validatedInput.name)
  formData.append('group_id', context.groupId)
  
  if (validatedInput.description) {
    formData.append('description', validatedInput.description)
  }

  const url = `${context.baseUrl}/voice_cloning`

  return fromFetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${context.apiKey}`,
      // Note: Don't set Content-Type for FormData, let browser set it with boundary
    },
    body: formData,
  }).pipe(
    switchMap(async (response) => {
      if (!response.ok) {
        if (import.meta.env.DEV) {
          const text = await response.text()
          console.error(
            `Voice cloning failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
          )
        }
        throw new Error(
          `Voice cloning failed: ${response.status} ${response.statusText}`,
        )
      }
      return response.json() as Promise<VoiceCloneOutput>
    }),
  )
}

// List available voices
export type Voice = {
  voice_id: string
  name: string
  description?: string
  status: 'ready' | 'processing' | 'failed'
  created_at: string
  is_preset?: boolean // System-provided voices
}

export type ListVoicesOutput = {
  voices: Voice[]
  total: number
}

export function listVoices(
  params?: {
    page?: number
    page_size?: number
    include_presets?: boolean
  },
  context?: MinimaxContext,
): Observable<ListVoicesOutput> {
  const url = new URL(`${context?.baseUrl}/voices`)
  
  if (params?.page) {
    url.searchParams.append('page', params.page.toString())
  }
  if (params?.page_size) {
    url.searchParams.append('page_size', params.page_size.toString())
  }
  if (params?.include_presets !== undefined) {
    url.searchParams.append('include_presets', params.include_presets.toString())
  }

  return fromFetch(url.toString(), {
    method: 'GET',
    headers: getMinimaxHeaders(context!),
  }).pipe(
    switchMap(async (response) => {
      if (!response.ok) {
        throw new Error(
          `List voices failed: ${response.status} ${response.statusText}`,
        )
      }
      return response.json() as Promise<ListVoicesOutput>
    }),
  )
}