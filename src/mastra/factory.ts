import { lazy } from '@/lib/lazy'
import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { PinoLogger } from '@mastra/loggers'
import { PostgresStore } from '@mastra/pg'

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
