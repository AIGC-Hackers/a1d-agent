import { env } from '@/lib/env'

import type { ClientBase } from './base'
import { X302MidjourneyProxy } from './302'
import { HuiyanMidjourneyProxy } from './huiyan'

export namespace MidjourneyProxy {
  export function client(provider: '302' | 'huiyan'): ClientBase {
    switch (provider) {
      case '302':
        return new X302MidjourneyProxy.X302Client(env.value.X_302_API_KEY)
      case 'huiyan':
        return new HuiyanMidjourneyProxy.HuiyanClient(
          env.value.HUIYAN_C_API_KEY,
        )
    }
  }
}
