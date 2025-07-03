import { streamContext } from '@/lib/context'
import { Mastra } from '@mastra/core/mastra'
import { PinoLogger } from '@mastra/loggers'
import { streamSSE } from 'hono/streaming'

import { weatherAgent } from './agents/weather-agent'
import { storage } from './storage'
import { weatherWorkflow } from './workflows/weather-workflow'

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: { weatherAgent },
  storage: storage.value,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    middleware: [
      // TODO: Test
      // {
      //   path: '/api/*',
      //   handler: async (c, next) => {
      //     c.res = streamSSE(c, async (writer) => {
      //       streamContext.callAsync(writer, next)
      //     })
      //   },
      // },
    ],
  },
})
