import { openrouter } from '@/integration/openrouter'
import { Agent } from '@mastra/core'

export const testAgent = new Agent({
  name: 'test-agent',
  description: 'develop and test agent functionality',
  instructions:
    'you are a test agent,Complete agent functionality testing according to user instructions.',
  model: openrouter('x-ai/grok-3-mini'),
})
