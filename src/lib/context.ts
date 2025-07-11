import type { Type } from 'arktype'
import { RuntimeContext } from '@mastra/core/runtime-context'

export function createState<
  S extends Type<any, any>,
  In = S['inferIn'],
  Out = S['inferOut'],
>(schema: S) {
  function get(ctx: RuntimeContext): Out {
    const stateKey = 'state'
    const stored = ctx.get(stateKey) as any

    if (!stored) {
      throw new Error('State not found')
    }
    return schema.assert(stored)
  }

  function set(ctx: RuntimeContext, value: In) {
    const stateKey = 'state'
    ctx.set(stateKey, value)
  }

  function assign(ctx: RuntimeContext, update: Partial<In>): Out {
    const stateKey = 'state'
    const current = get(ctx) as any

    const merged = { ...current, ...update }
    const validated = schema.assert(merged)
    ctx.set(stateKey, validated)
    return validated
  }

  return {
    set,
    get,
    assign,
  }
}
