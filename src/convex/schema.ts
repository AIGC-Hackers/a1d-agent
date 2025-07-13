import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Type Validators
export const assetType = v.union(
  v.literal('image'),
  v.literal('video'),
  v.literal('audio'),
)

export const taskStatus = v.union(
  v.literal('started'),
  v.literal('generating'),
  v.literal('completed'),
  v.literal('failed'),
)

export const eventType = v.union(
  v.literal('task_started'),
  v.literal('progress_update'),
  v.literal('image_preview'),
  v.literal('task_completed'),
  v.literal('error_occurred'),
)

export const taskEvent = v.object({
  eventType: eventType,
  progress: v.optional(v.number()),
  data: v.optional(v.any()),
  error: v.optional(v.string()),
  timestamp: v.number(),
})

export default defineSchema({
  // VFS 文件存储 - 目前只支持小文件直接存储
  file: defineTable({
    path: v.string(),
    content: v.string(), // 文件内容
    contentType: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    size: v.number(),
    lastModified: v.number(),
    threadId: v.string(), // 用于隔离不同会话的文件
  })
    .index('by_path_and_thread', ['threadId', 'path'])
    .index('by_thread', ['threadId'])
    .searchIndex('search_path', {
      searchField: 'path',
      filterFields: ['threadId'],
    }),

  // 任务表
  task: defineTable({
    threadId: v.string(),
    resourceId: v.string(),
    runId: v.optional(v.string()),

    // 任务基本信息
    toolId: v.string(), // mock-image-generate, midjourney-image-generate 等
    assetType: assetType,
    provider: v.string(), // mock-provider, huiyan, minimax 等

    // 任务状态
    status: taskStatus,
    progress: v.number(), // 0-100

    // 输入输出
    input: v.any(), // 工具输入参数
    output: v.optional(v.any()), // 最终输出结果
    error: v.optional(v.string()),

    // 事件序列
    events: v.optional(v.array(taskEvent)),
  })
    .index('by_thread', ['threadId'])
    .index('by_resource', ['resourceId'])
    .index('by_status', ['status'])
    .index('by_tool', ['toolId'])
    .index('by_thread_status', ['threadId', 'status']),
})
