import { createTool } from '@mastra/core/tools'
import z from 'zod'

import { stagehandSession } from '../../integration/stagehand'

export const stagehandPageActTool = createTool({
  id: 'stagehand-page-act',
  description: 'Take an action on a webpage using Stagehand',
  inputSchema: z.object({
    url: z
      .string()
      .optional()
      .describe('URL to navigate to (optional if already on a page)'),
    action: z
      .string()
      .describe(
        'Action to perform (e.g., "click sign in button", "type hello in search field")',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    return await performWebAction(context.url, context.action)
  },
})

const performWebAction = async (url?: string, action?: string) => {
  const stagehand = await stagehandSession.get()
  const page = stagehand.page

  try {
    // Navigate to the URL if provided
    if (url) {
      await page.goto(url)
    }

    // Perform the action
    if (action) {
      await page.act(action)
    }

    return {
      success: true,
      message: `Successfully performed: ${action}`,
    }
  } catch (error: any) {
    throw new Error(`Stagehand action failed: ${error.message}`)
  }
}
