import { v } from 'convex/values'

import { Doc } from './_generated/dataModel'
import { mutation, query } from './_generated/server'
import { assetType, eventType, taskStatus } from './schema'

// 创建新任务
export const createTask = mutation({
  args: {
    threadId: v.string(),
    resourceId: v.string(),
    runId: v.optional(v.string()),
    toolId: v.string(),
    internalTaskId: v.string(),
    assetType,
    provider: v.string(),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    // 1. 创建任务（不再包含 events 字段）
    const taskId = await ctx.db.insert('task', {
      ...args,
      status: 'started',
      progress: 0,
    })

    // 2. 插入初始事件到 task_delta 表
    await ctx.db.insert('task_delta', {
      taskId,
      eventType: 'task_started',
      progress: 0,
      data: { input: args.input },
      timestamp: now,
    })

    return taskId
  },
})

// 更新任务进度
export const updateTaskProgress = mutation({
  args: {
    taskId: v.id('task'),
    progress: v.number(),
    status: v.optional(taskStatus),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { taskId, progress, status, output, error } = args

    // 1. 更新任务表（inplace）
    type TaskUpdate = Partial<Omit<Doc<'task'>, '_id' | '_creationTime'>>
    const updateData: TaskUpdate = {
      progress,
    }

    if (status) updateData.status = status
    if (output) updateData.output = output
    if (error) updateData.error = error

    await ctx.db.patch(taskId, updateData)
  },
})

// 添加任务事件
export const addTaskEvent = mutation({
  args: {
    taskId: v.id('task'),
    eventType,
    progress: v.optional(v.number()),
    data: v.optional(v.any()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { taskId, eventType, progress, data, error } = args
    const task = await ctx.db.get(taskId)
    if (!task) throw new Error('Task not found')

    await ctx.db.patch(taskId, {
      progress,
      error,
    })

    // 直接插入事件到 task_delta 表
    await ctx.db.insert('task_delta', {
      taskId,
      eventType,
      progress,
      data,
      error,
      timestamp: Date.now(),
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

    // 从 task_delta 表查询事件
    const events = await ctx.db
      .query('task_delta')
      .withIndex('by_task_and_time', (q) => q.eq('taskId', args.taskId))
      .order('asc')
      .collect()

    return {
      task,
      events,
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

// 获取任务的所有历史事件
export const getTaskDeltas = query({
  args: {
    taskId: v.id('task'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query('task_delta')
      .withIndex('by_task_and_time', (q) => q.eq('taskId', args.taskId))
      .order('desc')

    const deltas = args.limit
      ? await query.take(args.limit)
      : await query.collect()

    // 返回时按时间正序，最早的在前
    return deltas.reverse()
  },
})
