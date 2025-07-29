import type { RuntimeContext } from '@mastra/core/runtime-context'
import type { LanguageModelV1 } from 'ai'
import type { Context, Next } from 'hono'
import { Anthropic } from '@/integration/anthropic'
import { Glm } from '@/integration/glm'
import { Groq } from '@/integration/groq'
import { OpenRouter } from '@/integration/openrouter'
import { isDev } from '@/lib/config'
import { lazy } from '@/lib/lazy'
import { ConvexStorage } from '@/server/vfs/convex-storage'
import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { registerApiRoute } from '@mastra/core/server'
import { PinoLogger } from '@mastra/loggers'
import { PostgresStore } from '@mastra/pg'
import { generateText } from 'ai'
import { type } from 'arktype'
import { ConvexHttpClient } from 'convex/browser'

import { env } from '../lib/env'

export namespace MastraX {
  function createLogger() {
    return new PinoLogger({
      name: 'Mastra',
      // level: isProd ? 'info' : 'debug',
      level: 'debug',
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
        const models: Record<string, string> = {}

        if (c.req.query('model') !== undefined) {
          const models = [
            Groq.model('moonshotai/kimi-k2-instruct'),
            OpenRouter.model(OpenRouter.Model.OpenAIGpt4oMini),
            Anthropic.model('claude-3-5-haiku-latest'),
          ]

          const generate = async (model: LanguageModelV1) => {
            try {
              const response = await generateText({
                model,
                prompt: 'Please respond with "Hello, world!"',
              })
              return { model: model.modelId, response: response.text }
            } catch (error) {
              return { model: model.modelId, error: error }
            }
          }

          const results = await Promise.all(models.map(generate))

          return c.json({
            status: 'UP',
            timestamp: Date.now(),
            buildTime: env.value.BUILD_TIMESTAMP || 'development',
            models: results,
          })
        }

        return c.json({
          status: 'UP',
          timestamp: Date.now(),
          buildTime: env.value.BUILD_TIMESTAMP || 'development',
          models,
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

export namespace PreferredModels {
  export const fallback = Glm.model('glm-4.5-x')

  export function select(id: string): LanguageModelV1 {
    const provider = id.split(':', 1)[0]
    const modelId = id.slice(provider.length + 1)

    switch (provider) {
      case 'anthropic':
        return Anthropic.model(modelId)

      case 'glm':
        return Glm.model(modelId as Glm.Model)

      case 'openrouter':
        return OpenRouter.model(modelId)

      case 'groq':
        return Groq.model(modelId)

      default:
        // Fallback to glm-4.5-x
        console.warn(`Unknown provider: ${provider}, falling back to glm-4.5-x`)
        return fallback
    }
  }
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
