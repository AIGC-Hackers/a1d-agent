import { env } from '@/lib/env'

// Pattern: Define context/config type for API client configuration
// AI guidance: Separate authentication and configuration from business logic parameters
export type MinimaxContext = {
  apiKey: string
  groupId: string
  baseUrl?: string
}

// Default context using environment variables
export const defaultMinimaxContext: MinimaxContext = {
  apiKey: env.value.MINIMAX_API_KEY,
  groupId: env.value.MINIMAX_GROUP_ID,
  baseUrl: 'https://api.minimax.chat/v1', // May need to be updated based on actual API docs
}

// Common headers for Minimax API
export function getMinimaxHeaders(context: MinimaxContext) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${context.apiKey}`,
  }
}
