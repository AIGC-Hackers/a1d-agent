import { fromFetch } from 'rxjs/fetch'
import { map } from 'rxjs/operators'

import type { X302Context } from './config'
import { switchMapResponseToJson } from '../utils'
import { baseUrl } from './config'

export type ResponseFormat = 'url' | 'b64_json'

export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536'

export type Background = 'transparent' | 'opaque' | 'auto'

export type Moderation = 'low' | 'auto'

export type Quality = 'auto' | 'high' | 'medium' | 'low'

type GenerateImageInput = {
  prompt: string
  model?: 'gpt-image-1'
  size?: ImageSize
  background?: Background
  moderation?: Moderation
  n?: number
  quality?: Quality
  response_format?: ResponseFormat
}

type EditImageInput = {
  image: string | File
  mask?: string | File
  prompt: string
  model?: 'gpt-image-1'
  size?: ImageSize
  n?: number
  response_format?: ResponseFormat
}

type ImageResponse = {
  data: Array<{
    url?: string
    b64_json?: string
  }>
  created: number
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
    prompt_tokens_details: {
      cached_tokens_details: Record<string, unknown>
    }
    completion_tokens_details: Record<string, unknown>
    input_tokens: number
    output_tokens: number
    input_tokens_details: {
      text_tokens: number
      cached_tokens_details: Record<string, unknown>
    }
  }
}

export function generateImage(input: GenerateImageInput, ctx: X302Context) {
  const params = new URLSearchParams()
  if (input.response_format) {
    params.append('response_format', input.response_format)
  }

  const requestBody = {
    prompt: input.prompt,
    model: input.model || 'gpt-image-1',
    ...(input.size && { size: input.size }),
    ...(input.background && { background: input.background }),
    ...(input.moderation && { moderation: input.moderation }),
    ...(input.n && { n: input.n }),
    ...(input.quality && { quality: input.quality }),
  }

  return fromFetch(`${baseUrl}/images/generations?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  }).pipe(switchMapResponseToJson<ImageResponse>())
}

export function editImage(input: EditImageInput, ctx: X302Context) {
  const formData = new FormData()

  if (typeof input.image === 'string') {
    formData.append('image', input.image)
  } else {
    formData.append('image', input.image)
  }

  if (input.mask) {
    if (typeof input.mask === 'string') {
      formData.append('mask', input.mask)
    } else {
      formData.append('mask', input.mask)
    }
  }

  formData.append('prompt', input.prompt)
  formData.append('model', input.model || 'gpt-image-1')

  if (input.size) formData.append('size', input.size)
  if (input.n) formData.append('n', input.n.toString())
  if (input.response_format)
    formData.append('response_format', input.response_format)

  return fromFetch(`${baseUrl}/images/edits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.apiKey}`,
    },
    body: formData,
  }).pipe(switchMapResponseToJson<ImageResponse>())
}

// 便捷函数：生成图片并返回URL
export function generateImageUrl(
  prompt: string,
  options: Omit<GenerateImageInput, 'prompt' | 'response_format'> = {},
  ctx: X302Context,
) {
  return generateImage(
    {
      ...options,
      prompt,
      response_format: 'url',
    },
    ctx,
  ).pipe(
    map((response) => ({
      ...response,
      url: response.data[0]?.url,
    })),
  )
}

// 便捷函数：编辑图片并返回URL
export function editImageUrl(
  image: string | File,
  prompt: string,
  options: Omit<EditImageInput, 'image' | 'prompt' | 'response_format'> = {},
  ctx: X302Context,
) {
  return editImage(
    {
      ...options,
      image,
      prompt,
      response_format: 'url',
    },
    ctx,
  ).pipe(
    map((response) => ({
      ...response,
      url: response.data[0]?.url,
    })),
  )
}

// 便捷函数：生成Base64格式图片
export function generateImageBase64(
  prompt: string,
  options: Omit<GenerateImageInput, 'prompt' | 'response_format'> = {},
  ctx: X302Context,
) {
  return generateImage(
    {
      ...options,
      prompt,
      response_format: 'b64_json',
    },
    ctx,
  ).pipe(
    map((response) => ({
      ...response,
      base64: response.data[0]?.b64_json,
    })),
  )
}
