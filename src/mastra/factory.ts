import { lazy } from '@/lib/lazy'
// import { LibSQLStore } from '@mastra/libsql'
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
  if (process.env.NODE_ENV === 'production') {
    logger.info('Using PostgresStore for production environment')
    return new PostgresStore({
      connectionString: env.value.POSTGRES_URL,
    })
  }

  logger.info('Using LibSQLStore for non-production environment')
  throw new Error('LibSQLStore is not supported in non-production environment')
  // return new LibSQLStore({
  //   url: 'file:../mastra.db',
  // })
}

export const storage = lazy(() => createStorage())
