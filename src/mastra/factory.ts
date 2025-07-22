import type { RuntimeContext } from '@mastra/core/runtime-context'
import type { Context, Next } from 'hono'
import { isDev, isProd } from '@/lib/config'
import { lazy } from '@/lib/lazy'
import { ConvexStorage } from '@/server/vfs/convex-storage'
import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { registerApiRoute } from '@mastra/core/server'
import { PinoLogger } from '@mastra/loggers'
import { PostgresStore } from '@mastra/pg'
import { type } from 'arktype'
import { ConvexHttpClient } from 'convex/browser'

import { env } from '../lib/env'

export namespace MastraX {
  function createLogger() {
    return new PinoLogger({
      name: 'Mastra',
      level: isProd ? 'info' : 'debug',
    })
  }

  export const logger = createLogger()

  function createStorage() {
    const url = new URL(
      process.env.NODE_ENV === 'production'
        ? env.value.POSTGRES_PROD_URL
        : env.value.POSTGRES_DEV_URL,
    )

    logger.info('Connecting to Postgres: ' + url.host)

    const store = new PostgresStore({
      // connectionString: url.toString(),
      connectionString: url.toString(),
    })

    return store
  }

  export const storage = lazy(() => createStorage())

  export function healthRoute(path: string = '/health') {
    return registerApiRoute(path, {
      method: 'GET',
      handler: async (c) => {
        return c.json({
          status: 'UP',
          timestamp: Date.now(),
          buildTime: env.value.BUILD_TIMESTAMP || 'development',
        })
      },
    })
  }
}

export function createVirtualFileSystem(projectId: string) {
  // 使用 Convex 存储
  if (env.value.CONVEX_URL) {
    return new VirtualFileSystem(
      new ConvexStorage(env.value.CONVEX_URL, projectId),
    )
  }

  // 开发环境使用内存存储
  if (isDev) {
    return new VirtualFileSystem(new MemoryStorage(projectId))
  }

  throw new Error(
    'VirtualFileSystem requires CONVEX_URL or development environment',
  )
}

export namespace ContextX {
  export function middleware() {
    return async (c: Context, next: Next) => {
      const runtimeContext = c.get('runtimeContext') as RuntimeContext
      set(runtimeContext)
      await next()
    }
  }

  export function set(c: RuntimeContext) {
    const convex = new ConvexHttpClient(env.value.CONVEX_URL)
    c.set('convex', convex)
  }

  const schema = type({
    convex: type.instanceOf(ConvexHttpClient),
  })
  type ContextType = typeof schema.infer

  export function get(runtimeContext: RuntimeContext): ContextType {
    const convex = runtimeContext.get('convex') as ConvexHttpClient
    const key = '_ref'
    if (!runtimeContext.has(key)) {
      const ctx = schema.assert({ convex })
      runtimeContext.set(key, ctx)
    }

    return runtimeContext.get(key)
  }
}
