import { Anthropic } from '@/integration/anthropic'
import { Glm } from '@/integration/glm'
import { Groq } from '@/integration/groq'
import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { MastraX } from '../factory'
import { drawOutVideoCutoutScriptTool } from '../tools/draw-out-video-cutout-script-tool'
import { googleSearchTool } from '../tools/google-search-tool'
import { kontextTextToImageTool } from '../tools/kontext-text-to-image-tool'
import { minimaxTextToAudioTool } from '../tools/minimax-text-to-audio-tool'
import { speedpaintVideoGenerateTool } from '../tools/speedpaint-video-generate-tool'
import * as systemTools from '../tools/system-tools'
import { todoReadTool } from '../tools/todo-read-tool'
import { todoWriteTool } from '../tools/todo-write-tool'
import { drawOutInstructions } from './drawout-agent.instructions'

export const drawOutAgent = new Agent({
  name: 'Drawout.ai',
  description: 'Draw out the story',
  instructions: ({ runtimeContext }) => {
    runtimeContext.set('model', 'claude')
    return drawOutInstructions({ runtimeContext })
  },
  model: ({ runtimeContext }) => {
    const model = runtimeContext.get('model')

    switch (model) {
      case 'glm-4.5':
        return Glm.model('glm-4.5')
      case 'k2':
        return Groq.model('moonshotai/kimi-k2-instruct')
      case 'claude':
      default:
        return Anthropic.model('claude-4-sonnet-20250514')
    }
  },
  memory: new Memory({
    storage: MastraX.storage.value,
  }),
  defaultGenerateOptions({ runtimeContext }) {
    return {
      maxSteps: 256,
    }
  },
  defaultStreamOptions({ runtimeContext }) {
    return {
      maxSteps: 256,
    }
  },
  tools: ({ runtimeContext }) => {
    return {
      // System tools
      fileWrite: systemTools.writeFileTool,
      fileRead: systemTools.readFileTool,
      fileDelete: systemTools.deleteFileTool,

      // Planning tools
      todoWrite: todoWriteTool,
      todoRead: todoReadTool,

      // Production tools
      googleSearch: googleSearchTool,

      // Image tools
      // midjourneyImageGenerate: midjourneyImageGenerateTool,
      // kontextImageEdit: kontextImageEditTool,
      kontextTextToImage: kontextTextToImageTool,

      // Audio tools
      minimaxTextToAudio: minimaxTextToAudioTool,

      // Video tools
      speedpaintVideoGenerate: speedpaintVideoGenerateTool,

      // Composition tools
      // drawOutVideoCutout: drawOutVideoCutoutTool,
      drawOutVideoCutoutScript: drawOutVideoCutoutScriptTool,
    }
  },
})
