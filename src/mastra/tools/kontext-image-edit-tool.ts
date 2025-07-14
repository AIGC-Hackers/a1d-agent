import { api } from '@/convex/_generated/api'
import { invariant } from '@/lib/invariant'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { ContextX } from '../factory'
import { fileDescriptorSchema } from './system-tools'

export const kontextImageEditInputSchema = z.object({
  image_path: z.string().describe('Input image file path'),
  prompt: z.string(),
  output: fileDescriptorSchema,
})

export type KontextImageEditOutput =
  | {
      id: string
      edited_image_path: string
      original_image_path: string
      edit_prompt: string
      model_used: string
    }
  | { error: string }

export const KONTEXT_TOOL_DESCRIPTION = 'Edit images using AI'

export const kontextImageEditTool = createTool({
  id: 'kontext-image-edit',
  description: KONTEXT_TOOL_DESCRIPTION,
  inputSchema: kontextImageEditInputSchema,
  execute: async ({
    context: input,
    resourceId,
    threadId,
    runtimeContext,
    runId,
  }) => {
    invariant(threadId, 'threadId is required')

    const { convex } = ContextX.get(runtimeContext)

    const { image_path, prompt, output } = input

    const image = await convex.query(api.vfs.readFile, {
      path: image_path,
      threadId,
    })

    throw new Error('Not implemented')
  },
})
