import { type } from 'arktype'

import { lazy } from './lazy'

export const runtimeEnvSchema = type({
  // ----------------------------------
  // databases
  // ----------------------------------
  POSTGRES_URL: 'string.url',

  // ----------------------------------
  // integrations
  // ----------------------------------
  MINIMAX_API_KEY: 'string',
  MINIMAX_GROUP_ID: 'string',

  SPEEDPAINTER_API_KEY: 'string',

  X_302_API_KEY: 'string',

  // claude + openai
  HUIYAN_A_API_KEY: 'string',
  // claude
  HUIYAN_B_API_KEY: 'string',
  // midjourney
  HUIYAN_C_API_KEY: 'string',

  // https://wavespeed.ai/
  WAVESPEED_API_KEY: 'string',

  FAL_API_KEY: 'string',
  OPENROUTER_API_KEY: 'string',
  XAI_API_KEY: 'string',
  GEMINI_API_KEY: 'string',

  CLOUDFLARE_ACCOUNT_ID: 'string',
  CLOUDFLARE_ACCESS_KEY_ID: 'string',
  CLOUDFLARE_SECRET_KEY: 'string',
  CLOUDFLARE_R2_BUCKET_NAME: 'string = "dev"',

  // ----------------------------------
  // Convex
  // ----------------------------------
  CONVEX_URL: 'string',

  // ----------------------------------
  // AUTH
  // ----------------------------------
  // GOOGLE_CLOUD_LOCALTION: 'string',
  // GOOGLE_CLOUD_PROJECT_ID: 'string',
})

export const env = lazy(() => runtimeEnvSchema.assert(process.env))

export type RuntimeEnv = typeof runtimeEnvSchema.infer

declare global {
  namespace NodeJS {
    interface ProcessEnv extends RuntimeEnv {}
  }
}
