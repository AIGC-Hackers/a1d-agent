import { env } from '@/lib/env'

const WAVESPEED_BASE_URL = 'https://api.wavespeed.ai/api/v3'

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

export type WavespeedFluxKontextProRequest = {
  /**
   * 用于生成图像的提示词
   */
  prompt: string
  /**
   * 用于生成图像的输入图像
   */
  image: string
  /**
   * CFG（Classifier Free Guidance）scale，控制模型对 prompt 的遵循程度，范围 1.0~10.0，默认 3.5
   */
  guidance_scale?: number
  /**
   * 生成图像的安全容忍度，1 最严格，5 最宽松，默认 2
   */
  safety_tolerance?: string
}

type WavespeedPredictionData = {
  id: string
  model: string
  outputs: string[]
  urls: {
    get: string
  }
  has_nsfw_contents: boolean[]
  status: 'created' | 'processing' | 'completed' | 'failed'
  created_at: string
  error: string
  timings: {
    inference: number
  }
}

export type WavespeedPredictionResponse = {
  code: number
  message: string
  data: WavespeedPredictionData
}

export async function submitWavespeedFluxKontextPro(
  input: WavespeedFluxKontextProRequest,
): Promise<WavespeedPredictionResponse> {
  const res = await fetch(
    `${WAVESPEED_BASE_URL}/wavespeed-ai/flux-kontext-pro`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.value.WAVESPEED_API_KEY}`,
      },
      body: JSON.stringify(input),
    },
  )
  return res.json()
}

export async function getWavespeedPredictionResult(
  requestId: string,
): Promise<WavespeedPredictionResponse> {
  const res = await fetch(
    `${WAVESPEED_BASE_URL}/predictions/${requestId}/result`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${env.value.WAVESPEED_API_KEY}`,
      },
    },
  )
  return res.json()
}
