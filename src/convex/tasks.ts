import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

// 创建新任务
export const createTask = mutation({
  args: {
    threadId: v.string(),
    resourceId: v.string(),
    runId: v.optional(v.string()),
    toolId: v.string(),
    assetType: v.union(
      v.literal('image'),
      v.literal('video'),
      v.literal('audio'),
    ),
    provider: v.string(),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const taskId = await ctx.db.insert('task', {
      ...args,
      status: 'started',
      progress: 0,
      events: [
        {
          eventType: 'task_started',
          progress: 0,
          data: { input: args.input },
          timestamp: now,
        },
      ],
    })

    return taskId
  },
})

// 更新任务进度
export const updateTaskProgress = mutation({
  args: {
    taskId: v.id('task'),
    progress: v.number(),
    status: v.optional(
      v.union(
        v.literal('started'),
        v.literal('generating'),
        v.literal('completed'),
        v.literal('failed'),
      ),
    ),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { progress, status, output, error } = args

    // 更新任务
    const updateData: any = {
      progress,
    }

    if (status) updateData.status = status
    if (output) updateData.output = output
    if (error) updateData.error = error

    await ctx.db.patch(args.taskId, updateData)

    return { success: true }
  },
})

// 添加任务事件
export const addTaskEvent = mutation({
  args: {
    taskId: v.id('task'),
    eventType: v.union(
      v.literal('task_started'),
      v.literal('progress_update'),
      v.literal('image_preview'),
      v.literal('task_completed'),
      v.literal('error_occurred'),
    ),
    progress: v.optional(v.number()),
    data: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { taskId, eventType, progress, data, error } = args
    const task = await ctx.db.get(taskId)
    if (!task) throw new Error('Task not found')

    const newEvent = {
      eventType,
      progress,
      data,
      error,
      timestamp: Date.now(),
    }

    const currentEvents = (task as any).events || []
    await ctx.db.patch(taskId, {
      events: [...currentEvents, newEvent],
    })

    return { success: true }
  },
})

// 获取任务及其事件（供前端实时订阅）
export const getTaskWithEvents = query({
  args: {
    taskId: v.id('task'),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId)
    if (!task) return null

    return {
      task,
      events: ((task as any).events || []).sort(
        (a: any, b: any) => a.timestamp - b.timestamp,
      ),
    }
  },
})

// 获取线程中的所有任务
export const getThreadTasks = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query('task')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))
      .collect()

    return tasks.sort((a, b) => b._creationTime - a._creationTime)
  },
})

// 获取进行中的任务
export const getActiveTasks = query({
  args: {
    threadId: v.string(),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query('task')
      .withIndex('by_thread_status', (q) =>
        q.eq('threadId', args.threadId).eq('status', 'generating'),
      )
      .collect()

    return tasks
  },
})
