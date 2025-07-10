import { openrouter } from '@/integration/openrouter'
import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { storage } from '../factory'
import { drawOutVideoCutoutTool } from '../tools/draw-out-video-cutout-tool'
import { kontextImageEditTool } from '../tools/kontext-image-edit-tool'
import { midjourneyImageGenerateTool } from '../tools/midjourney-image-generate-tool'
import { midjourneyVideoGenerateTool } from '../tools/midjourney-video-generate-tool'
import { minimaxTextToAudioTool } from '../tools/minimax-text-to-audio-tool'
import { speedpaintVideoCreateTool } from '../tools/speedpaint-video-create-tool'
import * as systemTools from '../tools/system-tools'
import { todoReadTool } from '../tools/todo-read-tool'
import { todoWriteTool } from '../tools/todo-write-tool'
import { drawOutInstructions } from './drawout-agent.instructions'

export const drawOutAgent = new Agent({
  name: 'Drawout.ai',
  description: 'Draw out the story',
  instructions: drawOutInstructions,
  model: openrouter('openai/gpt-4o-mini'),
  memory: new Memory({
    storage: storage.value,
  }),
  tools: ({ runtimeContext }) => {
    return {
      // System tools
      fileWrite: systemTools.writeFileTool,
      fileRead: systemTools.readFileTool,
      fileDelete: systemTools.deleteFileTool,

      // Todo tools
      todoWrite: todoWriteTool,
      todoRead: todoReadTool,

      // Production tools
      midjourneyImageGenerate: midjourneyImageGenerateTool,
      midjourneyVideoGenerate: midjourneyVideoGenerateTool,
      speedpaintVideoCreate: speedpaintVideoCreateTool,
      kontextImageEdit: kontextImageEditTool,
      minimaxTextToAudio: minimaxTextToAudioTool,
      drawOutVideoCutout: drawOutVideoCutoutTool,
    }
  },
})
