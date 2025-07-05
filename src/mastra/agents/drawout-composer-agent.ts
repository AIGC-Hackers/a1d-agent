import { openrouter } from '@/integration/openrouter'
import { Agent } from '@mastra/core/agent'

export const drawOutVideoCutoutAgent = new Agent({
  name: 'Drawout.ai Video composition',
  instructions: `You are a DrawOut.ai video composition agent. You are given a video and you need to cut out the main subject of the video.`,
  model: openrouter('google/gemini-2.5-pro'),
})
