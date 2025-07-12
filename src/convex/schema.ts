import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // VFS 文件存储 - 目前只支持小文件直接存储
  files: defineTable({
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

  // 资产生成任务表
  assetGenerationTasks: defineTable({
    threadId: v.string(),
    resourceId: v.string(),
    runId: v.optional(v.string()),

    // 任务基本信息
    toolId: v.string(), // mock-image-generate, midjourney-image-generate 等
    assetType: v.union(
      v.literal('image'),
      v.literal('video'),
      v.literal('audio'),
    ),
    provider: v.string(), // mock-provider, huiyan, minimax 等

    // 任务状态
    status: v.union(
      v.literal('started'),
      v.literal('generating'),
      v.literal('completed'),
      v.literal('failed'),
    ),
    progress: v.number(), // 0-100

    // 输入输出
    input: v.any(), // 工具输入参数
    output: v.optional(v.any()), // 最终输出结果
    error: v.optional(v.string()),

    // 时间戳
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_thread', ['threadId'])
    .index('by_resource', ['resourceId'])
    .index('by_status', ['status'])
    .index('by_tool', ['toolId'])
    .index('by_thread_status', ['threadId', 'status']),

  // 资产生成事件表
  assetGenerationEvents: defineTable({
    taskId: v.string(), // 关联到 assetGenerationTasks._id
    threadId: v.string(),

    eventType: v.union(
      v.literal('task_started'),
      v.literal('progress_update'),
      v.literal('image_preview'),
      v.literal('task_completed'),
      v.literal('error_occurred'),
    ),

    progress: v.optional(v.number()),
    data: v.optional(v.any()), // 事件相关数据
    error: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('by_task', ['taskId'])
    .index('by_thread', ['threadId'])
    .index('by_timestamp', ['timestamp'])
    .index('by_task_timestamp', ['taskId', 'timestamp']),
})
