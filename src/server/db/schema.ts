import { pgTable, text, unique } from 'drizzle-orm/pg-core'

import { created_at, id, updated_at, version } from './meta'

export const vfs = pgTable(
  'vfs',
  {
    id: id,
    project_id: text().notNull(),
    created_at: created_at,
    updated_at: updated_at,
    path: text().notNull(),
    description: text(),
    content_type: text(),
    content: text().notNull(),
    version: version,
  },
  (table) => [unique().on(table.project_id, table.path)],
)
