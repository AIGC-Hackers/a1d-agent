import { Observable, switchMap } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import type { MinimaxContext } from './config'
import { getMinimaxHeaders } from './config'

// Base response type for voice cloning API
export type VoiceCloneBaseResp = {
  status_code: number
  status_msg: string
}

// File upload types
export type FileUploadInput = {
  file: File
  purpose: 'voice_clone'
}

export type FileUploadOutput = {
  file: {
    file_id: number
    bytes: number
    created_at: number
    filename: string
    purpose: string
  }
  base_resp: VoiceCloneBaseResp
}

// Upload file for voice cloning
export function uploadFile(
  input: FileUploadInput,
  context: MinimaxContext,
): Observable<FileUploadOutput> {
  const formData = new FormData()
  formData.append('file', input.file)
  formData.append('purpose', input.purpose)

  const url = `${context.baseUrl}/v1/files/upload?GroupId=${context.groupId}`

  return fromFetch(url, {
    method: 'POST',
    headers: {
      Authority: 'api.minimax.io',
      Authorization: `Bearer ${context.apiKey}`,
    },
    body: formData,
  }).pipe(
    switchMap(async (response) => {
      if (!response.ok) {
        const text = await response.text()
        if (import.meta.env.DEV) {
          console.error(
            `File upload failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
          )
        }
        throw new Error(
          `File upload failed: ${response.status} ${response.statusText}`,
        )
      }
      return response.json() as Promise<FileUploadOutput>
    }),
  )
}

// Voice cloning types
export type VoiceCloneInput = {
  file_id: number
  voice_id: string
  need_noise_reduction?: boolean
  text?: string
  model?: 'speech-02-hd' | 'speech-02-turbo' | 'speech-01-hd' | 'speech-01-turbo'
  accuracy?: number
  need_volume_normalization?: boolean
}

export type VoiceCloneOutput = {
  input_sensitive: boolean
  input_sensitive_type: number
  base_resp: VoiceCloneBaseResp
}

// Clone voice from uploaded file
export function cloneVoice(
  input: VoiceCloneInput,
  context: MinimaxContext,
): Observable<VoiceCloneOutput> {
  const url = `${context.baseUrl}/v1/voice_clone?GroupId=${context.groupId}`

  return fromFetch(url, {
    method: 'POST',
    headers: {
      Authority: 'api.minimax.io',
      Authorization: `Bearer ${context.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }).pipe(
    switchMap(async (response) => {
      if (!response.ok) {
        const text = await response.text()
        if (import.meta.env.DEV) {
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
  is_preset?: boolean
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
  // Note: This API endpoint is not documented in the official MiniMax voice cloning docs
  // The actual endpoint may be different or may not exist
  const url = new URL(`${context?.baseUrl}/v1/voices?GroupId=${context?.groupId}`)

  if (params?.page) {
    url.searchParams.append('page', params.page.toString())
  }
  if (params?.page_size) {
    url.searchParams.append('page_size', params.page_size.toString())
  }
  if (params?.include_presets !== undefined) {
    url.searchParams.append(
      'include_presets',
      params.include_presets.toString(),
    )
  }

  return fromFetch(url.toString(), {
    method: 'GET',
    headers: getMinimaxHeaders(context!),
  }).pipe(
    switchMap(async (response) => {
      if (!response.ok) {
        const text = await response.text()
        if (import.meta.env.DEV) {
          console.error(
            `List voices failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
          )
        }
        throw new Error(
          `List voices failed: ${response.status} ${response.statusText}`,
        )
      }
      return response.json() as Promise<ListVoicesOutput>
    }),
  )
}
