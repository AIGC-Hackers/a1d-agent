import { env } from '@/lib/env'

import { WAVESPEED_BASE_URL } from './config'

export namespace Kontext {
  export type KontextInput = {
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

  type KontextOutput = {
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

  export type KontextResponse = {
    code: number
    message: string
    data: KontextOutput
  }

  export async function create(input: KontextInput): Promise<KontextResponse> {
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

  export async function getResult(requestId: string): Promise<KontextResponse> {
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
}
