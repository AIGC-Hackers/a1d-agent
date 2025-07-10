import { huiyan, LanguageModel } from '@/integration/huiyan/llm'
import { openrouter } from '@/integration/openrouter'
import { xai } from '@/integration/xai'
import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { storage } from '../factory'
import { kontextImageEditMockTool } from '../tools/mock/kontext-image-edit-mock-tool'
import { midjourneyImageGenerateMockTool } from '../tools/mock/midjourney-image-generate-mock-tool'
// Mock tools
import { minimaxTextToAudioMockTool } from '../tools/mock/minimax-text-to-audio-mock-tool'
import { speedpaintVideoGenerateMockTool } from '../tools/mock/speedpaint-video-generate-mock-tool'
import * as systemTools from '../tools/system-tools'
import { todoReadTool } from '../tools/todo-read-tool'
import { todoWriteTool } from '../tools/todo-write-tool'
import { drawOutInstructions } from './drawout-agent.instructions'

export const drawOutAgentMock = new Agent({
  name: 'Drawout.ai Mock',
  description:
    'Mock version of Draw out the story - for development and testing',
  instructions: drawOutInstructions,
  model: openrouter('anthropic/claude-sonnet-4'),
  memory: new Memory({
    storage: storage.value,
  }),
  defaultGenerateOptions({ runtimeContext }) {
    return {
      maxSteps: 128,
    }
  },
  defaultStreamOptions({ runtimeContext }) {
    return {
      maxSteps: 128,
    }
  },
  tools: {
    // System tools
    fileWrite: systemTools.writeFileTool,
    fileRead: systemTools.readFileTool,
    fileDelete: systemTools.deleteFileTool,

    // Todo tools
    todoWrite: todoWriteTool,
    todoRead: todoReadTool,

    // Mock tools
    minimaxTextToAudio: minimaxTextToAudioMockTool,
    midjourneyImageGenerate: midjourneyImageGenerateMockTool,
    kontextImageEdit: kontextImageEditMockTool,
    speedpaintVideoGenerate: speedpaintVideoGenerateMockTool,
  },
})
