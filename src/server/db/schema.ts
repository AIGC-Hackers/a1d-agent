import { index, integer, pgTable, text, unique } from 'drizzle-orm/pg-core'

import { created_at, id, updated_at, version } from './meta'

export const vfs = pgTable(
  'vfs',
  {
    id,
    project_id: text().notNull(),
    created_at,
    updated_at,
    path: text().notNull(),
    description: text(),
    content_type: text(),
    content: text().notNull(),
    version: version,
  },
  (table) => [unique().on(table.project_id, table.path)],
)

export const upload = pgTable(
  'upload',
  {
    id,
    // user id
    resource_id: text(),
    job_id: text().notNull(),
    created_at,
    updated_at,
    content_type: text(),
    file_name: text(),
    file_size: integer().notNull(),
    // s3 key
    key: text().notNull(),
  },
  (table) => [index().on(table.resource_id, table.job_id)],
)
