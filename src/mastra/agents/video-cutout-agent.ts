import { openrouter } from '@/integration/openrouter'
import { Agent } from '@mastra/core/agent'

export const videoCutoutAgent = new Agent({
  name: 'Video Cutout Agent',
  instructions: `You are a video cutout agent. You are given a video and you need to cut out the main subject of the video.`,
  model: openrouter('google/gemini-2.5-pro'),
})
