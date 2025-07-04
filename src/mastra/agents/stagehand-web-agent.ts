import { openrouter } from '@/integration/openrouter'
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'

import { stagehandPageActTool } from '../tools/stagehand-page-act-tool'
import { stagehandPageExtractTool } from '../tools/stagehand-page-extract-tool'
import { stagehandPageNavigateTool } from '../tools/stagehand-page-navigate-tool'
import { stagehandPageObserveTool } from '../tools/stagehand-page-observe-tool'

export const stagehandWebAgent = new Agent({
  name: 'Stagehand Web Agent',
  instructions: `
      You are a helpful web assistant that can navigate websites and extract information.

      Your primary functions are:
      - Navigate to websites
      - Observe elements on webpages
      - Perform actions like clicking buttons or filling forms
      - Extract data from webpages

      When responding:
      - Ask for a specific URL if none is provided
      - Be specific about what actions to perform
      - When extracting data, be clear about what information you need

      Use the pageActTool to perform actions on webpages.
      Use the pageObserveTool to find elements on webpages.
      Use the pageExtractTool to extract data from webpages.
      Use the pageNavigateTool to navigate to a URL.
`,
  model: openrouter('openai/gpt-4o'),
  memory: new Memory(),
  tools: {
    pageActTool: stagehandPageActTool,
    pageObserveTool: stagehandPageObserveTool,
    pageExtractTool: stagehandPageExtractTool,
    pageNavigateTool: stagehandPageNavigateTool,
  },
})
