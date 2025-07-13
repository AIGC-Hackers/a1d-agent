import { createHash } from 'crypto'
import { createTool } from '@mastra/core/tools'
import { ulid } from 'ulid'

import {
  KONTEXT_TOOL_DESCRIPTION,
  kontextImageEditInputSchema,
} from '../kontext-image-edit-tool'

// Mock edited image files
const mockEditedImages = [
  'assets/images/edited/e1.jpg',
  'assets/images/edited/e2.jpg',
  'assets/images/edited/e3.jpg',
  'assets/images/edited/e4.jpg',
]

// Delay function
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const kontextImageEditMockTool = createTool({
  id: 'kontext-image-edit',
  description: `${KONTEXT_TOOL_DESCRIPTION} (Mock version)`,
  inputSchema: kontextImageEditInputSchema,
  execute: async (context) => {
    const { context: input } = context

    // Mock 2-4 second delay (image editing is typically faster than generation)
    const editTime = 2000 + Math.random() * 2000
    await delay(editTime)

    // Generate hash based on image path + prompt for consistent mock results
    const editHash = createHash('md5')
      .update(input.image_path + input.prompt)
      .digest('hex')
    const hashIndex = parseInt(editHash.charAt(0), 16) % mockEditedImages.length
    const selectedEditedImage = mockEditedImages[hashIndex]

    // Generate mock IDs
    const editId = `mock-edit-${ulid()}`

    console.log(`[Mock Kontext Image Edit] Edited image:`)
    console.log(`  Original: ${input.image_path}`)
    console.log(`  Edit prompt: ${input.prompt.substring(0, 50)}...`)
    console.log(`  Model: ${input.model}`)
    console.log(`  Mock edited file: ${selectedEditedImage}`)
    console.log(`  Edit ID: ${editId}`)

    // Build output file path based on input requirements
    const outputPath = input.output.path || `edited-${Date.now()}.jpg`

    return {
      success: true,
      result: {
        id: editId,
        edited_image_path: outputPath,
        original_image_path: input.image_path,
        edit_prompt: input.prompt,
        model_used: input.model,
      },
    }
  },
})
