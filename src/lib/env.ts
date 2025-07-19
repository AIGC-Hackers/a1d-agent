import { runtimeEnvSchema } from './env.schema'
import { lazy } from './lazy'

export const env = lazy(() => runtimeEnvSchema.assert(process.env))
