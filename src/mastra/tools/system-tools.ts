import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const fileDescriptorSchema = z.object({
  path: z.string().describe('The relative path of the file'),
  description: z.string().optional().describe('The description of the file'),
})

// Message Tools
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

// File System Tools
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
    append: z.boolean().optional().describe('Whether to use append mode'),
    leading_newline: z
      .boolean()
      .optional()
      .describe('Whether to add a leading newline'),
    trailing_newline: z
      .boolean()
      .optional()
      .describe('Whether to add a trailing newline'),
    sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    throw new Error('File write tool not implemented yet')
  },
})

export const editFileTool = createTool({
  id: 'edit-file',
  description:
    'Replace specified string in a file. Use for updating specific content in files or fixing errors in code.',
  inputSchema: z.object({
    file: z
      .string()
      .describe('Absolute path of the file to perform replacement on'),
    old_str: z.string().describe('Original string to be replaced'),
    new_str: z.string().describe('New string to replace with'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    replacements: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    throw new Error('File string replace tool not implemented yet')
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
    force: z
      .boolean()
      .optional()
      .describe('Whether to force deletion without confirmation'),
  }),
  outputSchema: z.object({
    deleted_files: z.array(z.string()),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    throw new Error('Delete files tool not implemented yet')
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
