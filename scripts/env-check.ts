#!/usr/bin/env bun
/// <reference types="@types/bun" />
import { type } from 'arktype'

import { runtimeEnvSchema } from '../src/lib/env'

const env = runtimeEnvSchema(process.env)
if (env instanceof type.errors) {
  console.log('❌ env check failed')
  console.log(env.summary)
  console.log('💡 Usage: dotenvx run -- bun scripts/env-check.ts')
} else {
  console.log('='.repeat(100))
  console.log(env)
  console.log('='.repeat(100))
  console.log('✅ env check passed')
}
