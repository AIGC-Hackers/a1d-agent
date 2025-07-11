import { createState } from '@/lib/context'
import { type } from 'arktype'

export const drawoutAgentState = createState(
  type({
    todo: 'string',
  }),
)
