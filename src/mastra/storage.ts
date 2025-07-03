import { lazy } from '@/lib/lazy'
import { LibSQLStore } from '@mastra/libsql'
import { PostgresStore } from '@mastra/pg'
import { memoize } from 'lodash-es'

import { env } from '../lib/env'

function createStorage() {
  if (process.env.NODE_ENV === 'production') {
    return new LibSQLStore({
      url: 'file:../mastra.db',
    })
  }

  return new PostgresStore({
    connectionString: env.value.POSTGRES_URL,
  })
}

export const storage = lazy(() => createStorage())
