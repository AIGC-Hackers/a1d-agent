import { env } from '@/lib/env'
import { fromFetch } from 'rxjs/fetch'

import { baseUrl } from '../openrouter'
import { switchMapResponseToJson } from '../utils'

export type RecraftStyles =
  | 'digital_illustration/pixel_art'
  | 'digital_illustration/hand_drawn'
  | 'digital_illustration/grain'
  | 'digital_illustration/infantile_sketch'
  | 'digital_illustration/2d_art_poster'
  | 'digital_illustration/handmade_3d'
  | 'digital_illustration/hand_drawn_outline'
  | 'digital_illustration/engraving_color'
  | 'digital_illustration/2d_art_poster_2'
  | 'vector_illustration/engraving'
  | 'vector_illustration/line_art'
  | 'vector_illustration/line_circuit'
  | 'vector_illustration/linocut'

type GenerateImageInput = {
  prompt: string
  image_size: {
    width: number
    height: number
  }
  style?: RecraftStyles
  colors?: Array<{
    r: number
    g: number
    b: number
  }>
  style_id?: string
}
type GenerateImageOutput = {
  images: Array<{
    url: string
    content_type?: string
    file_size?: number
    width?: number
    height?: number
    seed?: number
    has_nsfw_concepts: boolean | null
    debug_latents: unknown | null
    debug_per_pass_latents: unknown | null
  }>
}

export function generateImage(input: GenerateImageInput) {
  fromFetch(`${baseUrl}/302/submit/recraft-v3`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.value.X_302_API_KEY}`,
    },
    body: JSON.stringify(input),
  }).pipe(switchMapResponseToJson<GenerateImageOutput>())
}
