import { z } from 'zod'

import { fileDescriptorSchema } from '../system-tools'

export const minimaxTextToAudioInputSchema = z.object({
  text: z.string().describe('Narration script from storyboard'),
  voice: z.string().describe('Voice style'),
  output: fileDescriptorSchema.describe('VFS path for audio file'),
})

export const minimaxTextToAudioOutputSchema = z.object({
  file_path: z.string(),
  duration_seconds: z.number(),
})

export const MINIMAX_TOOL_DESCRIPTION = 'Create narration audio for a shot'
