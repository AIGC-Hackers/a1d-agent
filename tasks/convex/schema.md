# Convex Schema 定义

## VFS 文件存储 Schema

```typescript
// convex/schema.ts (VFS 部分)
export default defineSchema({
  // VFS 文件存储 - 元数据 + 文件引用
  files: defineTable({
    path: v.string(),
    fileId: v.optional(v.string()), // Convex File Storage ID 或 R2 文件 ID
    storageType: v.union(
      v.literal('convex'), // Convex File Storage
      v.literal('r2'), // Cloudflare R2
      v.literal('inline'), // 小文件直接存储
    ),
    content: v.optional(v.string()), // 小文件内容（<100KB）
    contentType: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    size: v.number(),
    lastModified: v.number(),
    threadId: v.string(), // 用于隔离不同会话的文件
  })
    .index('by_path_and_thread', ['threadId', 'path'])
    .index('by_thread', ['threadId'])
    .index('by_storage_type', ['storageType']),
})
```

## 资产生成事件 Schema

```typescript
// 资产生成任务表
assetGenerationTasks: defineTable({
  id: v.string(), // ULID - 任务唯一标识
  threadId: v.string(),
  resourceId: v.string(),
  runId: v.optional(v.string()),

  // 任务基本信息
  toolId: v.string(), // midjourney-image-generate, speedpaint-video-generate 等
  assetType: v.union(v.literal("image"), v.literal("video"), v.literal("audio")),
  provider: v.string(), // huiyan, minimax, speedpaint 等

  // 任务状态
  status: v.union(
    v.literal("started"),    // 任务开始
    v.literal("generating"), // 生成中
    v.literal("uploading"),  // 上传中
    v.literal("completed"),  // 完成
    v.literal("failed")      // 失败
  ),
  progress: v.number(), // 0-100

  // 输入输出
  input: v.any(), // 工具输入参数
  output: v.optional(v.any()), // 最终输出结果
  error: v.optional(v.string()),

  // 文件信息
  files: v.optional(v.array(v.object({
    fileId: v.string(), // Convex R2 文件 ID
    fileName: v.string(),
    fileSize: v.number(),
    fileUrl: v.string(),
    vfsPath: v.string(), // VFS 兼容路径
  }))),

  // 时间戳
  createdAt: v.number(),
  updatedAt: v.number(),
})
.index("by_thread", ["threadId"])
.index("by_resource", ["resourceId"])
.index("by_status", ["status"])
.index("by_tool", ["toolId"])
.index("by_thread_status", ["threadId", "status"]),

// 资产生成进度事件表（详细的中间事件）
assetGenerationEvents: defineTable({
  id: v.string(), // ULID
  taskId: v.string(), // 关联到 assetGenerationTasks
  threadId: v.string(),

  eventType: v.union(
    v.literal("api_called"),     // API 调用
    v.literal("progress_update"), // 进度更新
    v.literal("file_generated"), // 文件生成完成
    v.literal("file_uploaded"),  // 文件上传完成
    v.literal("task_completed"), // 任务完成
    v.literal("error_occurred")  // 错误发生
  ),

  progress: v.optional(v.number()),
  data: v.optional(v.any()), // 事件相关数据
  error: v.optional(v.string()),
  timestamp: v.number(),
})
.index("by_task", ["taskId"])
.index("by_thread", ["threadId"])
.index("by_timestamp", ["timestamp"])
.index("by_task_timestamp", ["taskId", "timestamp"]),
```

## Mastra Storage Schema

```typescript
// 完整的 Mastra 数据模型
export default defineSchema({
  // 对话线程
  threads: defineTable({
    id: v.string(), // UUID
    resourceId: v.string(),
    title: v.string(),
    metadata: v.optional(v.string()), // JSON string
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_resource', ['resourceId'])
    .index('by_updated', ['updatedAt']),

  // 消息内容（支持 V1/V2 格式）
  messages: defineTable({
    id: v.string(), // UUID
    threadId: v.string(),
    resourceId: v.optional(v.string()),
    content: v.string(), // JSON string (V2 format)
    role: v.union(v.literal('user'), v.literal('assistant')),
    createdAt: v.number(),
  })
    .index('by_thread', ['threadId'])
    .index('by_thread_created', ['threadId', 'createdAt']),

  // 用户资源数据
  resources: defineTable({
    id: v.string(), // resourceId
    workingMemory: v.optional(v.string()), // Markdown
    metadata: v.optional(v.any()), // JSON
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  // 工作流状态快照
  workflows: defineTable({
    workflowName: v.string(),
    runId: v.string(), // UUID
    snapshot: v.string(), // JSON string
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workflow', ['workflowName'])
    .index('by_run', ['runId']),

  // 评估数据集
  evalDatasets: defineTable({
    input: v.string(),
    output: v.string(),
    result: v.any(), // JSON
    agentName: v.string(),
    metricName: v.string(),
    instructions: v.string(),
    testInfo: v.any(), // JSON
    globalRunId: v.string(), // UUID
    runId: v.string(), // UUID
    createdAt: v.number(),
  })
    .index('by_agent', ['agentName'])
    .index('by_global_run', ['globalRunId'])
    .index('by_run', ['runId']),

  // OpenTelemetry 追踪
  traces: defineTable({
    id: v.string(),
    parentSpanId: v.optional(v.string()),
    name: v.string(),
    traceId: v.string(),
    scope: v.string(),
    kind: v.number(),
    attributes: v.optional(v.any()), // JSON
    status: v.optional(v.any()), // JSON
    events: v.optional(v.any()), // JSON
    links: v.optional(v.any()), // JSON
    other: v.optional(v.string()), // JSON string
    startTime: v.string(), // bigint as string
    endTime: v.string(), // bigint as string
    createdAt: v.number(),
  })
    .index('by_trace', ['traceId'])
    .index('by_parent', ['parentSpanId']),
})
```

## 存储策略代码示例

```typescript
// 存储策略
if (fileSize < 100KB) {
  // 小文件直接存储在文档中
  storageType = "inline"
} else if (fileSize < 10MB) {
  // 中等文件使用 Convex File Storage
  storageType = "convex"
} else {
  // 大文件使用 R2
  storageType = "r2"
}
```

## 资产生成工作流代码

```typescript
// 资产生成工作流
const assetGenerationFlow = {
  1: 'execute begin', // 工具开始执行
  2: 'call generate api', // 调用第三方生成 API
  3: 'poll/subscribe updates', // 轮询或订阅进度更新 -> write to convex
  4: 'task done', // 任务完成 -> write file to convex-r2
  5: 'get path/url', // 获取文件路径/URL
  6: 'write final event', // 写入最终事件到 convex table
}
```
