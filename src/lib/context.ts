import type { distill, Type } from 'arktype'
import { RuntimeContext } from '@mastra/core/runtime-context'

export function createState<T extends object>(schema: Type<T, any>) {
  function get(ctx: RuntimeContext): distill.Out<T> {
    const stateKey = 'state'
    const stored = ctx.get(stateKey) as T | undefined

    if (!stored) {
      throw new Error('State not found')
    }

    return schema.assert(stored) as distill.Out<T>
  }

  function set(ctx: RuntimeContext, value: distill.In<T>) {
    const stateKey = 'state'
    ctx.set(stateKey, value)
  }

  function assign(ctx: RuntimeContext, update: Partial<T>): distill.Out<T> {
    const stateKey = 'state'
    const current = get(ctx)
    if (!current) {
      throw new Error('State not found')
    }

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
