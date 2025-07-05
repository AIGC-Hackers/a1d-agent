import { env } from '@/lib/env'

import { WAVESPEED_BASE_URL } from './config'

export type WavespeedUploadResponse = {
  code: number
  message: string
  data: {
    type: string
    download_url: string
    filename: string
    size: number
  }
}

export async function uploadToWavespeed(
  file: Blob,
): Promise<WavespeedUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${WAVESPEED_BASE_URL}/media/upload/binary`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.value.WAVESPEED_API_KEY}`,
    },
    body: formData,
  })
  return res.json()
}
