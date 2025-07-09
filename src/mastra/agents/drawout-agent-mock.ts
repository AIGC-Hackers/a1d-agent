import { openrouter } from '@/integration/openrouter'
import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { storage } from '../factory'
import { midjourneyImageGenerateMockTool } from '../tools/mock/midjourney-image-generate-mock-tool'
// Mock tools
import { minimaxTextToAudioMockTool } from '../tools/mock/minimax-text-to-audio-mock-tool'
import { speedpaintVideoCreateMockTool } from '../tools/mock/speedpaint-video-create-mock-tool'
import * as systemTools from '../tools/system-tools'
import { drawOutInstructions } from './drawout-instructions'

export const drawOutAgentMock = new Agent({
  name: 'Drawout.ai Mock',
  description:
    'Mock version of Draw out the story - for development and testing',
  instructions: drawOutInstructions,
  model: openrouter('openai/gpt-4o-mini'),
  memory: new Memory({
    storage: storage.value,
  }),
  tools: {
    // System tools
    fileWrite: systemTools.writeFileTool,
    fileRead: systemTools.readFileTool,
    fileDelete: systemTools.deleteFileTool,

    // Mock tools
    minimaxTextToAudio: minimaxTextToAudioMockTool,
    midjourneyImageGenerate: midjourneyImageGenerateMockTool,
    speedpaintVideoCreate: speedpaintVideoCreateMockTool,
  },
})
