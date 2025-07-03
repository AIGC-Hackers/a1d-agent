import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type {
  PostgresJsDatabase,
  PostgresJsQueryResultHKT,
} from 'drizzle-orm/postgres-js'
import { env } from '@/lib/env'
import { lazy } from '@/lib/lazy'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

type Schema = typeof schema

export const db = lazy(() => {
  const client = postgres(env.value.POSTGRES_URL)
  return drizzle(client, {
    schema,
    logger: process.env.NODE_ENV === 'development',
  })
})

export type Database = PostgresJsDatabase<Schema> & {
  $client: postgres.Sql<{}>
}

export type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>

export { schema as t }
