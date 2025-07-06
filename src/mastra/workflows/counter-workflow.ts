import { init } from '@mastra/inngest'
import { z } from 'zod'

import { inngest, inngestWorkflows } from '../factory'

// Initialize Inngest with Mastra, pointing to your local Inngest server

// Step: Increment the counter value
const incrementStep = inngestWorkflows.createStep({
  id: 'increment',
  inputSchema: z.object({
    value: z.number(),
  }),
  outputSchema: z.object({
    value: z.number(),
  }),
  execute: async ({ inputData }) => {
    return { value: inputData.value + 1 }
  },
})

// workflow that is registered as a function on inngest server
const incrementWorkflow = inngestWorkflows
  .createWorkflow({
    id: 'increment-workflow',
    description: 'The inngest test workflow',
    inputSchema: z.object({
      value: z.number(),
    }),
    outputSchema: z.object({
      value: z.number(),
    }),
  })
  .then(incrementStep)

incrementWorkflow.commit()

export { incrementWorkflow }
