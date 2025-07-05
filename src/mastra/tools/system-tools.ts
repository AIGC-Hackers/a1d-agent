import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

import { logger } from '../factory'

export const fileDescriptorSchema = z.object({
  path: z.string().describe('The relative path of the file'),
  description: z.string().optional().describe('The description of the file'),
})

export const messageNotifyUserTool = createTool({
  id: 'message-notify-user',
  description:
    'Send a message to user without requiring a response. Use for acknowledging receipt of messages, providing progress updates, reporting task completion, or explaining changes in approach.',
  inputSchema: z.object({
    text: z.string().describe('Message text to display to user'),
    attachments: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe(
        'List of attachments to show to user, can be file paths or URLs',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    throw new Error('Message notify user tool not implemented yet')
  },
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
  description: `Replaces text within a file. By default, replaces a single occurrence, but can replace multiple occurrences when \`expected_replacements\` is specified. This tool requires providing significant context around the change to ensure precise targeting. Always use the ${readFileTool.id} tool to examine the file's current content before attempting a text replacement.

      The user has the ability to modify the \`new_string\` content. If modified, this will be stated in the response.

Expectation for required parameters:
1. \`file_path\` MUST be an absolute path; otherwise an error will be thrown.
2. \`old_string\` MUST be the exact literal text to replace (including all whitespace, indentation, newlines, and surrounding code etc.).
3. \`new_string\` MUST be the exact literal text to replace \`old_string\` with (also including all whitespace, indentation, newlines, and surrounding code etc.). Ensure the resulting code is correct and idiomatic.
4. NEVER escape \`old_string\` or \`new_string\`, that would break the exact literal text requirement.
**Important:** If ANY of the above are not satisfied, the tool will fail. CRITICAL for \`old_string\`: Must uniquely identify the single instance to change. Include at least 3 lines of context BEFORE and AFTER the target text, matching whitespace and indentation precisely. If this string matches multiple locations, or does not match exactly, the tool will fail.
**Multiple replacements:** Set \`expected_replacements\` to the number of occurrences you want to replace. The tool will replace ALL occurrences that match \`old_string\` exactly. Ensure the number of replacements matches your expectation.`,

  inputSchema: z.object({
    file_path: z
      .string()
      .describe(
        `The absolute path to the file to modify. Must start with '/'.`,
      ),
    old_string: z
      .string()
      .describe(
        'The exact literal text to replace, preferably unescaped. For single replacements (default), include at least 3 lines of context BEFORE and AFTER the target text, matching whitespace and indentation precisely. For multiple replacements, specify expected_replacements parameter. If this string is not the exact literal text (i.e. you escaped it) or does not match exactly, the tool will fail.',
      ),
    new_string: z
      .string()
      .describe(
        'The exact literal text to replace `old_string` with, preferably unescaped. Provide the EXACT text. Ensure the resulting code is correct and idiomatic.',
      ),
    expected_replacements: z
      .number()
      .optional()
      .default(1)
      .describe(
        `Number of replacements expected. Defaults to 1 if not specified. Use when you want to replace multiple occurrences.`,
      ),
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

// Utility Tools
export const idleTool = createTool({
  id: 'idle',
  description:
    'A special tool to indicate you have completed all tasks and are about to enter idle state.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    status: z.string(),
  }),
  execute: async () => {
    throw new Error('Idle tool not implemented yet')
  },
})
