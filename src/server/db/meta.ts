import { sql } from 'drizzle-orm'
import { integer, pgEnum, text, timestamp } from 'drizzle-orm/pg-core'
import { ulid } from 'ulid'

export const id = text('id')
  .$defaultFn(() => ulid())
  .primaryKey()

export const created_at = timestamp()
  .notNull()
  .default(sql`now()`)

export const updated_at = timestamp()
  .notNull()
  .default(sql`now()`)
  .$onUpdateFn(() => new Date())

export const entity_status = pgEnum('entity_status', [
  'active',
  'inactive',
  'deleted',
])

export const version = integer()
  .notNull()
  .default(0)
  .$onUpdateFn(() => sql`version + 1`)
