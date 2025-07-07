import type { Mastra } from '@mastra/core'
import type { RuntimeContext } from '@mastra/core/runtime-context'
import type { Context, Next } from 'hono'
import { lazy } from '@/lib/lazy'
import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { PinoLogger } from '@mastra/loggers'
import { PostgresStore } from '@mastra/pg'
import { type } from 'arktype'
import { events } from 'fetch-event-stream'
import PartySocket from 'partysocket'
import { createContext } from 'unctx'

import { env } from '../lib/env'

function createLogger() {
  return new PinoLogger({
    name: 'Mastra',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  })
}

export const logger = createLogger()

function createStorage() {
  return new PostgresStore({
    connectionString: env.value.POSTGRES_URL,
  })
}

export const storage = lazy(() => createStorage())

export function createVirtualFileSystem(projectId: string) {
  if (process.env.NODE_ENV === 'development') {
    return new VirtualFileSystem(new MemoryStorage(projectId))
  }

  throw new Error('VirtualFileSystem is not supported in production')
}

const streamRequestBodySchema = type({
  threadId: 'string?',
  resourceId: 'string?',
})

export const partySocketContext = createContext<Pick<PartySocket, 'send'>>()

export function streamMiddleware() {
  const handler = async (c: Context, next: Next) => {
    const body = await c.req.json()

    const input = streamRequestBodySchema(body)

    if (input instanceof type.errors) {
      return next()
    }

    const { threadId, resourceId } = input
    if (!threadId || !resourceId) {
      return next()
    }

    const partySocket = new PartySocket({
      host: 'project-name.username.partykit.dev', // or localhost:1999 in dev
      room: resourceId,
      // add an optional id to identify the client,
      // if not provided, a random id will be generated
      // note that the id needs to be unique per connection,
      // not per user, so e.g. multiple devices or tabs need a different id
      // id: resourceId,

      // optionally, specify the party to connect to.
      // if not provided, will connect to the "main" party defined in partykit.json
      party: 'main',

      // optionally, pass an object of query string parameters to add to the request
      query: async () => ({
        token: '123',
      }),
    })

    const runtimeContext = c.get('runtimeContext') as RuntimeContext
    runtimeContext.set('partySocket', partySocket)

    await partySocketContext.callAsync(partySocket, next)
    const response = c.res.clone()

    for await (const chunk of events(response)) {
      if (chunk.event && chunk.data) {
        partySocket.send(JSON.stringify(chunk))
      }
    }

    partySocket.close()
  }

  return {
    path: '/api/**/stream',
    handler,
  }
}
