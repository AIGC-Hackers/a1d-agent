import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { MastraX, PreferredModels } from '../factory'
import { googleSearchTool } from '../tools/google-search-tool'
import { kontextImageEditMockTool } from '../tools/mock/kontext-image-edit-mock-tool'
import { kontextTextToImageMockTool } from '../tools/mock/kontext-text-to-image-mock-tool'
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
  instructions: ({ runtimeContext }) => {
    const instructions = drawOutInstructions({ runtimeContext })
    return (
      instructions +
      '\n' +
      'You are running in MOCK mode. All tool calls will return MOCK DATA for development and testing purposes.'
    )
  },
  model: ({ runtimeContext }) => {
    return PreferredModels.select(runtimeContext.get('model'))
  },
  // model: OpenRouter.model(OpenRouter.Model.OpenAIGpt41),
  memory: new Memory({
    storage: MastraX.storage.value,
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

    // Real tool (can be used in mock agent)
    googleSearch: googleSearchTool,

    // Mock tools
    minimaxTextToAudio: minimaxTextToAudioMockTool,
    kontextTextToImage: kontextTextToImageMockTool,
    kontextImageEdit: kontextImageEditMockTool,
    speedpaintVideoGenerate: speedpaintVideoGenerateMockTool,
  },
})
