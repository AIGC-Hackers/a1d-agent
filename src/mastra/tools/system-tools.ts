import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { logger } from '../factory'

export const fileDescriptorSchema = z.object({
  path: z.string().describe('The relative path of the file'),
  description: z.string().optional().describe('The description of the file'),
})

export const messageAskUserTool = createTool({
  id: 'message-ask-user',
  description:
    'Ask user a question and wait for response. Use for requesting clarification, asking for confirmation, or gathering additional information.',
  inputSchema: z.object({
    text: z.string().describe('Question text to present to user'),
    attachments: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe('List of question-related files or reference materials'),
    suggest_user_takeover: z
      .enum(['none', 'browser'])
      .optional()
      .describe('Suggested operation for user takeover'),
  }),
  outputSchema: z.object({
    response: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    throw new Error('Message ask user tool not implemented yet')
  },
})

export const readFileTool = createTool({
  id: 'read-file',
  description:
    'Read file content. Use for checking file contents, analyzing logs, or reading configuration files.',
  inputSchema: z.object({
    file: z.string().describe('Absolute path of the file to read'),
    start_line: z
      .number()
      .optional()
      .describe('Starting line to read from, 0-based'),
    end_line: z.number().optional().describe('Ending line number (exclusive)'),
  }),
  outputSchema: z.object({
    content: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    throw new Error('File read tool not implemented yet')
  },
})

export const writeFileTool = createTool({
  id: 'write-file',
  description:
    'Overwrite or append content to a file. Use for creating new files, appending content, or modifying existing files.',
  inputSchema: z.object({
    file: z.string().describe('Absolute path of the file to write to'),
    content: z.string().describe('Text content to write'),
    content_type: z
      .string()
      .optional()
      .describe('MIME type of the file created'),
    description: z
      .string()
      .optional()
      .describe('Description of the file created'),
    append: z.boolean().optional().describe('Whether to use append mode'),
    leading_newline: z
      .boolean()
      .optional()
      .describe('Whether to add a leading newline'),
    trailing_newline: z
      .boolean()
      .optional()
      .describe('Whether to add a trailing newline'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId, resourceId, runtimeContext }) => {
    if (!threadId) {
      return {
        success: false,
        error: 'threadId is required',
      }
    }
    const vfs = new VirtualFileSystem(new MemoryStorage(threadId))
    if (input.append) {
      const file = await vfs.readFile(input.file)
      if (!file) {
        return {
          success: false,
          error: 'File not found',
        }
      }

      const leadingNewline = input.leading_newline ? '\n' : ''
      const trailingNewline = input.trailing_newline ? '\n' : ''
      const appendedContent =
        file.content + leadingNewline + input.content + trailingNewline

      await vfs.writeFile({
        path: input.file,
        content: appendedContent,
        description: input.description,
      })

      return {
        success: true,
      }
    }

    await vfs.writeFile({
      path: input.file,
      content: input.content,
      description: input.description,
    })
    return {
      success: true,
    }
  },
})

export const editFileTool = createTool({
  id: 'edit-file',
  description: `Replaces text within a file. Requires exact literal text matching with sufficient context (3+ lines before/after) to ensure unique identification. Use ${readFileTool.id} first to examine current content.

Parameters:
- file_path: Absolute path starting with '/'
- old_string: Exact literal text including all whitespace/indentation
- new_string: Exact replacement text
- expected_replacements: Number of occurrences to replace (default: 1)

The tool will fail if old_string doesn't match exactly or isn't unique (for single replacement).`,

  inputSchema: z.object({
    file_path: z.string(),
    old_string: z.string(),
    new_string: z.string(),
    expected_replacements: z.number().optional().default(1),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    replacements: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId, resourceId, runtimeContext }) => {
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
      throw new Error('Not implemented')
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

export const deleteFileTool = createTool({
  id: 'delete-file',
  description:
    'Delete one or more files or directories. Use for removing files, cleaning up temporary files, or deleting directories.',
  inputSchema: z.object({
    files: z
      .union([z.string(), z.array(z.string())])
      .describe('Absolute path(s) of file(s) or directory(s) to delete'),
    recursive: z
      .boolean()
      .optional()
      .describe('Whether to delete directories recursively'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context: input, threadId, resourceId, runtimeContext }) => {
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})
