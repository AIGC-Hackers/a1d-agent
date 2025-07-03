import type { Config } from 'drizzle-kit'
import { env } from '@/lib/env'

export default {
  schema: './src/server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.value.POSTGRES_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config
