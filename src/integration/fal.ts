import { env } from '@/lib/env'
import { fal } from '@fal-ai/client'

export namespace Fal {
  export function client() {
    fal.config({
      credentials: env.value.FAL_API_KEY,
    })

    return fal
  }
}
