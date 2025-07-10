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

export const todoWriteTool = createTool({
  id: 'todo-write',
  description: `Use this tool to create and manage a structured task list for your current workflow session. This helps you track progress, organize complex multi-step processes, and maintain workflow continuity - especially important for video creation, asset generation, and when handling user interruptions.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. **Complex multi-step workflows** - Video creation, asset generation pipelines, or any task requiring 3+ distinct phases
2. **Sequential tool orchestration** - When generating multiple assets (audio, images, animations) that depend on each other
3. **User interruptions or plan changes** - When users modify requirements mid-workflow, update the todo list to track changes
4. **Workflow resumption** - When continuing from "resume" or "continue" commands, check existing todos for next steps
5. **Asset generation tracking** - Track each scene's audio, image, and animation generation status
6. **Progress visibility** - Give users clear insight into complex workflow progress
7. **State management** - One task should be in_progress at a time, complete before starting new ones

## When NOT to Use This Tool

Skip using this tool when:
1. Single, straightforward operations with immediate results
2. Pure information queries or explanations
3. Tasks completable in under 3 trivial steps
4. No workflow continuity needed

NOTE: Essential for video workflows and asset generation pipelines where tracking is critical.

## Examples of When to Use the Todo List

<example>
User: Create a whiteboard video about AI in healthcare for doctors
Assistant: I'll help create your AI in healthcare whiteboard video. Let me set up a todo list to track this production workflow.
*Creates todo list with the following items:*
1. Understand your vision and requirements for the healthcare AI video
2. Define the project's visual style and tone for medical professionals
3. Plan the narrative structure and key messages
4. Create opening scene that captures doctors' attention
5. Develop the main content scenes explaining AI benefits
6. Design a compelling closing with clear next steps
7. Produce the complete video presentation
*Begins understanding requirements*

<reasoning>
The assistant used the todo list because:
1. Video creation requires multiple phases of creative and technical work
2. Each scene needs coordinated asset creation (narration, visuals, animations)
3. The workflow has dependencies where creative decisions inform technical execution
4. Todo list provides transparency into the production process
</reasoning>
</example>

<example>
User: Wait, change the duration to 120 seconds and add a case study section
Assistant: Understood. I'll adjust to 120 seconds and incorporate a case study section.
*Updates todo list:*
- Revise project scope to accommodate longer duration
- Add new segment: "Real-world case study demonstration"
- Create additional scene showcasing practical application
*Adjusts project parameters and narrative flow*
*Continues production from current point with updated plan*

<reasoning>
The assistant used the todo list because:
1. Mid-workflow changes require systematic adjustment
2. New content requirements create additional production tasks
3. Todo list maintains continuity when plans evolve
4. Helps track what's complete versus what needs updating
</reasoning>
</example>

<example>
User: I want to create a 5-minute educational video explaining the process of photosynthesis
Assistant: I'll help you create this educational video about photosynthesis. Let me plan the production workflow.
*Creates todo list:*
1. Understand your specific requirements (target audience, style preferences)
2. Design opening - introduce photosynthesis concept with engaging visuals
3. Create first section - show how plants absorb sunlight
4. Create second section - explain carbon dioxide and water transformation
5. Create third section - demonstrate oxygen and glucose production
6. Design closing - summarize photosynthesis importance to ecosystems
7. Generate complete 5-minute educational animation

<reasoning>
The assistant used the todo list because:
1. A 5-minute educational video requires careful content structure planning
2. Each knowledge point needs appropriate visual representation
3. The production process has multiple coordinated phases
4. Task list helps ensure educational content completeness and coherence
</reasoning>
</example>

<example>
User: resume
Assistant: Let me check where we are in the video production process.
*Reviews current progress:*
- ✓ Opening scene completed
- ✓ Problem explanation finished
- → Currently working on solution demonstration
- Case study section awaiting production
- Final video assembly pending

I'll continue with the solution demonstration scene where we left off.
*Resumes creating the solution visualization*

<reasoning>
The assistant used the todo list because:
1. Resuming work requires understanding current progress
2. Todo list provides clear production status
3. Prevents duplicating completed work
4. Maintains creative continuity across sessions
</reasoning>
</example>

## Examples of When NOT to Use the Todo List

<example>
User: What video formats does the speedpaint tool support?
Assistant: The speedpaint tool generates MP4 videos with H.264 encoding, which is widely compatible across all platforms and browsers. It automatically matches the aspect ratio specified in your project settings.

<reasoning>
The assistant did not use the todo list because this is an informational request with no actual task to perform. The user is asking for technical specifications, not requesting any workflow execution.
</reasoning>
</example>

<example>
User: What color scheme should I use for this video?
Assistant: For your video theme, I recommend using a clean, bright color scheme. Use deep blue as the primary color to create professionalism, with green and orange as accent colors to highlight key content, and white background to keep it simple. This combination is both professional and energetic.

<reasoning>
The assistant did not use the todo list because this is a visual design consultation question that can be answered directly. No multi-step workflow or task tracking is needed for this simple advisory request.
</reasoning>
</example>

<example>
User: Change the voice style from professional to friendly
Assistant: I'll update the voice style setting to friendly tone.
*Updates the voice configuration parameter*

<reasoning>
The assistant did not use the todo list because this is a single configuration change. While it affects future asset generation, it doesn't require tracking multiple steps or managing a complex workflow.
</reasoning>
</example>

<example>
User: What's the maximum duration for a whiteboard video?
Assistant: The maximum duration for whiteboard videos is 180 seconds (3 minutes). This limit ensures optimal viewer engagement and manageable file sizes for the generated animations.

<reasoning>
The assistant did not use the todo list because this is a simple information query about system constraints. No workflow or task execution is required.
</reasoning>
</example>

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully
   - cancelled: Task no longer needed

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Cancel tasks that become irrelevant

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when fully successful
   - If asset generation fails, keep task as in_progress and retry
   - When blocked by errors, create new tasks for resolution
   - Never mark asset generation tasks complete if:
     - Audio generation failed or is corrupted
     - Image generation failed or doesn't match requirements
     - Speedpaint animation failed to process
     - Any tool returned an error

4. **Task Breakdown**:
   - Create specific, actionable items (e.g., "Generate Scene 1 audio narration")
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names
   - Group related assets by scene for better organization

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.
`,
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
