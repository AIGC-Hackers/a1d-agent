import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { logger } from '../factory'

export const fileDescriptorSchema = z.object({
  path: z.string().describe('File path'),
  description: z.string().optional().describe('File description'),
})

export const readFileTool = createTool({
  id: 'read-file',
  description: 'Read file content from virtual storage.',
  inputSchema: z.object({
    file: z.string().describe('File path (must start with /)'),
  }),
  outputSchema: z.object({
    content: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId }) => {
    if (!threadId) {
      return {
        content: '',
        success: false,
        error: 'threadId is required',
      }
    }

    const vfs = new VirtualFileSystem(new MemoryStorage(threadId))

    try {
      const file = await vfs.readFile(input.file)

      return {
        content: file.content,
        success: true,
      }
    } catch (error) {
      logger.error('Read file tool error:', { error })
      return {
        content: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

export const writeFileTool = createTool({
  id: 'write-file',
  description: 'Create or update file content in virtual storage.',
  inputSchema: z.object({
    file: z.string().describe('File path (must start with /)'),
    content: z.string().describe('File content'),
    content_type: z.string().optional().describe('MIME type'),
    description: z.string().optional().describe('File description'),
    append: z.boolean().optional().describe('Append to existing content'),
    leading_newline: z.boolean().optional().describe('Add newline before content'),
    trailing_newline: z.boolean().optional().describe('Add newline after content'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId }) => {
    if (!threadId) {
      return {
        success: false,
        error: 'threadId is required',
      }
    }

    const vfs = new VirtualFileSystem(new MemoryStorage(threadId))

    try {
      if (input.append) {
        const file = await vfs.readFile(input.file)

        const leadingNewline = input.leading_newline ? '\n' : ''
        const trailingNewline = input.trailing_newline ? '\n' : ''
        const appendedContent =
          file.content + leadingNewline + input.content + trailingNewline

        await vfs.writeFile({
          path: input.file,
          content: appendedContent,
          description: input.description,
          contentType: input.content_type,
        })
      } else {
        await vfs.writeFile({
          path: input.file,
          content: input.content,
          description: input.description,
          contentType: input.content_type,
        })
      }

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Write file tool error:', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

export const editFileTool = createTool({
  id: 'edit-file',
  description: 'Replace exact text in file. Read file first to see current content. Use sufficient context for unique matching.',

  inputSchema: z.object({
    file_path: z.string().describe('File path (must start with /)'),
    old_string: z.string().describe('Exact text to replace'),
    new_string: z.string().describe('Replacement text'),
    expected_replacements: z.number().optional().default(1).describe('Number of replacements (default: 1)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    replacements: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId }) => {
    if (!threadId) {
      return {
        success: false,
        replacements: 0,
        error: 'threadId is required',
      }
    }

    const vfs = new VirtualFileSystem(new MemoryStorage(threadId))
    const expectedReplacements = input.expected_replacements ?? 1

    try {
      // Read the file first
      const file = await vfs.readFile(input.file_path)

      // Count occurrences of old_string
      const occurrences = (
        file.content.match(new RegExp(escapeRegExp(input.old_string), 'g')) ||
        []
      ).length

      if (occurrences === 0) {
        return {
          success: false,
          replacements: 0,
          error: 'Text to replace not found in file',
        }
      }

      if (expectedReplacements === 1 && occurrences > 1) {
        return {
          success: false,
          replacements: 0,
          error: `Found ${occurrences} occurrences but expected exactly 1. Text is not unique enough.`,
        }
      }

      if (expectedReplacements > occurrences) {
        return {
          success: false,
          replacements: 0,
          error: `Expected ${expectedReplacements} replacements but only found ${occurrences} occurrences`,
        }
      }

      // Perform the replacement
      let newContent = file.content
      let actualReplacements = 0

      if (expectedReplacements === occurrences) {
        // Replace all occurrences
        newContent = file.content.replaceAll(input.old_string, input.new_string)
        actualReplacements = occurrences
      } else {
        // Replace only the expected number of occurrences
        for (let i = 0; i < expectedReplacements; i++) {
          const index = newContent.indexOf(input.old_string)
          if (index !== -1) {
            newContent =
              newContent.substring(0, index) +
              input.new_string +
              newContent.substring(index + input.old_string.length)
            actualReplacements++
          }
        }
      }

      // Write the updated file back
      await vfs.writeFile({
        path: input.file_path,
        content: newContent,
        contentType: file.contentType,
        metadata: file.metadata,
      })

      return {
        success: true,
        replacements: actualReplacements,
      }
    } catch (error) {
      logger.error('Edit file tool error:', { error })
      return {
        success: false,
        replacements: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const deleteFileTool = createTool({
  id: 'delete-file',
  description: 'Delete files from virtual storage.',
  inputSchema: z.object({
    files: z.union([z.string(), z.array(z.string())]).describe('File path(s) to delete'),
    recursive: z.boolean().optional().describe('Delete files with matching path prefix'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId }) => {
    if (!threadId) {
      return {
        success: false,
        error: 'threadId is required',
      }
    }

    const vfs = new VirtualFileSystem(new MemoryStorage(threadId))
    const filePaths = Array.isArray(input.files) ? input.files : [input.files]

    try {
      for (const filePath of filePaths) {
        await vfs.deleteFile(filePath, {
          recursive: input.recursive,
        })
      }

      return {
        success: true,
      }
    } catch (error) {
      logger.error('Delete file tool error:', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})
