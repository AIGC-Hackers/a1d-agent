import { inspect } from 'node:util'
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

const result = await Fal.client().subscribe(
  'fal-ai/flux-pro/kontext/max/text-to-image',
  {
    input: {
      prompt:
        'Business presentation style diagram: aircraft with integrated solid-state hydrogen storage system, performance radar chart comparing solid-state vs liquid hydrogen, aviation decarbonization roadmap timeline, market size projection showing $50 billion, hand-drawn illustration with blue and green colors',
      aspect_ratio: '16:9',
      output_format: 'jpeg',
    },
    logs: true,
    onQueueUpdate(status) {
      console.log(inspect(status, { depth: null }))
    },
  },
)

console.log(inspect(result, { depth: null }))
