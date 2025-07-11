import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const todoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['high', 'medium', 'low']),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

/**
 * Tool for reading the current to-do list for the session.
 *
 * This tool should be used proactively and frequently to ensure awareness of
 * the status of the current task list. Use it in the following situations:
 * - At the beginning of conversations to see what's pending
 * - Before starting new tasks to prioritize work
 * - When the user asks about previous tasks or plans
 * - Whenever uncertain about what to do next
 * - After completing tasks to update understanding of remaining work
 * - After every few messages to ensure staying on track
 *
 * The tool takes no parameters and returns a list of todo items with their
 * status, priority, and content. Use this information to track progress
 * and plan next steps. If no todos exist yet, an empty list will be returned.
 */
export const todoReadTool = createTool({
  id: 'todo-read',
  description: `Use this tool to read the current to-do list for the session. This tool should be used proactively and frequently to ensure that you are aware of
the status of the current task list. You should make use of this tool as often as possible, especially in the following situations:
- At the beginning of conversations to see what's pending
- Before starting new tasks to prioritize work
- When the user asks about previous tasks or plans
- Whenever you're uncertain about what to do next
- After completing tasks to update your understanding of remaining work
- After every few messages to ensure you're on track

Usage:
- This tool takes in no parameters. So leave the input blank or empty. DO NOT include a dummy object, placeholder string or a key like "input" or "empty". LEAVE IT BLANK.
- Returns a list of todo items with their status, priority, and content
- Use this information to track progress and plan next steps
- If no todos exist yet, an empty list will be returned`,
  inputSchema: z.object({}),
  outputSchema: z.object({
    todos: z.array(todoItemSchema),
    message: z.string().optional(),
  }),
  execute: async ({ threadId }) => {
    if (!threadId) {
      return {
        todos: [],
        success: false,
        error: 'threadId is required',
      }
    }

    const vfs = new VirtualFileSystem(new MemoryStorage(threadId))
    const todoFilePath = '/todos.json'

    // Try to read the existing todos file using Result pattern
    const fileResult = await vfs.readFile(todoFilePath)

    if (!fileResult.success) {
      // If file doesn't exist, return empty list
      if (fileResult.error.code === 'FILE_NOT_FOUND') {
        return {
          todos: [],
          success: true,
        }
      }

      // For other errors, propagate meaningful error message to LLM
      return {
        todos: [],
        message: `Failed to read todo file: ${fileResult.error.message}`,
      }
    }

    try {
      const todos = JSON.parse(fileResult.data.content)
      // Validate the todos structure
      const validatedTodos = z.array(todoItemSchema).parse(todos)

      return {
        todos: validatedTodos,
        success: true,
      }
    } catch (error) {
      // JSON parsing or validation error - provide meaningful feedback
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown parsing error'
      return {
        todos: [],
        message: `Invalid todo file format: ${errorMessage}`,
      }
    }
  },
})
