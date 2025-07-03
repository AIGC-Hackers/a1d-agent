import type { SSEStreamingApi } from 'hono/streaming'
import { createContext } from 'unctx'

export const streamContext = createContext<SSEStreamingApi>()