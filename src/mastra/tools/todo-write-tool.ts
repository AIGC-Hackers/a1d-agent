import { MemoryStorage } from '@/server/vfs/memory-storage'
import { VirtualFileSystem } from '@/server/vfs/virtual-file-system'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

const todoItemSchema = z.object({
  id: z.string(),
  content: z.string().min(1),
  status: z.enum(['pending', 'in_progress', 'completed']),
  priority: z.enum(['high', 'medium', 'low']),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

/**
 * Tool for creating and managing a structured task list for the current session.
 * This helps track progress, organize complex tasks, and demonstrate thoroughness.
 *
 * ## When to Use This Tool
 * Use this tool proactively in these scenarios:
 *
 * 1. Complex multi-step tasks - When a task requires 3 or more distinct steps or actions
 * 2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
 * 3. User explicitly requests todo list - When the user directly asks to use the todo list
 * 4. User provides multiple tasks - When users provide a list of things to be done
 * 5. After receiving new instructions - Immediately capture user requirements as todos
 * 6. When starting work on a task - Mark it as in_progress BEFORE beginning work
 * 7. After completing a task - Mark it as completed and add any new follow-up tasks
 *
 * ## When NOT to Use This Tool
 *
 * Skip using this tool when:
 * 1. There is only a single, straightforward task
 * 2. The task is trivial and tracking provides no organizational benefit
 * 3. The task can be completed in less than 3 trivial steps
 * 4. The task is purely conversational or informational
 *
 * ## Task States and Management
 *
 * 1. **Task States**: Use these states to track progress:
 *    - pending: Task not yet started
 *    - in_progress: Currently working on (limit to ONE task at a time)
 *    - completed: Task finished successfully
 *
 * 2. **Task Management**:
 *    - Update task status in real-time as you work
 *    - Mark tasks complete IMMEDIATELY after finishing
 *    - Only have ONE task in_progress at any time
 *    - Complete current tasks before starting new ones
 *    - Remove tasks that are no longer relevant
 *
 * 3. **Task Completion Requirements**:
 *    - ONLY mark a task as completed when you have FULLY accomplished it
 *    - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
 *    - When blocked, create a new task describing what needs to be resolved
 *    - Never mark a task as completed if:
 *      - Tests are failing
 *      - Implementation is partial
 *      - You encountered unresolved errors
 *      - You couldn't find necessary files or dependencies
 *
 * 4. **Task Breakdown**:
 *    - Create specific, actionable items
 *    - Break complex tasks into smaller, manageable steps
 *    - Use clear, descriptive task names
 */
export const todoWriteTool = createTool({
  id: 'todo-write',
  description:
    'Create and manage a structured task list for the current session to track progress and organize complex tasks.',
  inputSchema: z.object({
    todos: z
      .array(todoItemSchema)
      .describe('The updated todo list with all tasks'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
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
    const todoFilePath = '/todos.json'

    try {
      // Validate the input todos
      const validatedTodos = z.array(todoItemSchema).parse(input.todos)

      // Add timestamps for new todos or update existing ones
      const processedTodos = validatedTodos.map((todo) => {
        const now = new Date().toISOString()
        return {
          ...todo,
          createdAt: todo.createdAt || now,
          updatedAt: now,
        }
      })

      // Validate business rules
      const inProgressTodos = processedTodos.filter(
        (todo) => todo.status === 'in_progress',
      )
      if (inProgressTodos.length > 1) {
        return {
          success: false,
          error:
            'Only one task can be in_progress at a time. Please complete current tasks before starting new ones.',
        }
      }

      // Write the todos to the VFS using Result pattern
      const writeResult = await vfs.writeFile({
        path: todoFilePath,
        content: JSON.stringify(processedTodos, null, 2),
        contentType: 'application/json',
        description: 'Session todo list for tracking tasks and progress',
      })

      if (!writeResult.success) {
        return {
          success: false,
          error: `Failed to save todo list: ${writeResult.error.message}`,
        }
      }

      // Generate a summary message
      const pending = processedTodos.filter(
        (todo) => todo.status === 'pending',
      ).length
      const inProgress = processedTodos.filter(
        (todo) => todo.status === 'in_progress',
      ).length
      const completed = processedTodos.filter(
        (todo) => todo.status === 'completed',
      ).length

      const message = `Todo list updated: ${pending} pending, ${inProgress} in progress, ${completed} completed`

      return {
        success: true,
        message,
      }
    } catch (error) {
      // Handle validation errors or other unexpected issues
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: `Todo validation failed: ${errorMessage}`,
      }
    }
  },
})
