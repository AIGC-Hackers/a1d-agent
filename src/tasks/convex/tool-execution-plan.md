# 长任务工具 Execute 实现计划

## 背景与目标

### 业务需求

- **问题**：Agent 的长任务工具（如 Midjourney 生图）是阻塞式调用，前端无法显示执行进度
- **目标**：让 UI 能实时显示工具执行过程，避免几十秒无响应的用户体验问题
- **价值**：完整的 agent 对话和生成过程回放，作为产品 showcase 的核心功能

### 技术方案

- 工具在 execute 中通过 tap 流的方式将进度写入 Convex tasks 表
- 生成的资源直接上传到 S3（通过现有的 `@/integration/s3.ts`）
- 通过 VFS 创建虚拟文件引用，让 LLM 能够引用这些资源

## 核心架构

### 数据流

```
LLM 调用工具（指定输出路径如 /images/logo.png）
    ↓
tool.execute 开始执行
    ↓
创建 task 记录（状态: started）
    ↓
调用 generateImageStream 并 tap 流
    ↓
流事件 → 更新 tasks 表（进度、预览等）
    ↓
任务完成，获取最终图片 URL
    ↓
下载图片 → 上传到 S3（key: {threadId}/images/logo.png）
    ↓
通过 VFS 创建文件记录（content: ""，metadata 包含 S3 信息）
    ↓
更新 task 状态为 completed
    ↓
返回结果给 LLM
```

### 关键组件

#### 1. Convex Schema（已定义）

参见 `@src/convex/schema.ts` 中的 `task` 表定义，包含了任务追踪所需的所有字段：

- 任务标识（threadId, resourceId, runId）
- 任务信息（toolId, assetType, provider）
- 状态管理（status, progress）
- 输入输出（input, output, error）
- 事件序列（events 数组）

#### 2. Convex Mutations（需要创建）

```typescript
// src/convex/tasks.ts
export const create = mutation({
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
    // 创建任务记录，初始状态为 'started'
    // 同时添加 task_started 事件
  },
})

export const update = mutation({
  args: {
    taskId: v.id('task'),
    // 瞬时状态更新（外部字段）
    status: v.optional(
      v.union(
        v.literal('started'),
        v.literal('generating'),
        v.literal('completed'),
        v.literal('failed'),
      ),
    ),
    progress: v.optional(v.number()),

    // 事件追加到 events 数组
    event: v.optional(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    // 1. 更新外部字段（status, progress）
    // 2. 如果有 event，追加到 events 数组（带 timestamp）
    // 3. 原子操作，保证数据一致性
  },
})

export const complete = mutation({
  args: {
    taskId: v.id('task'),
    output: v.any(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. 更新 status 为 'completed' 或 'failed'
    // 2. 设置 output 或 error
    // 3. 添加 task_completed 或 error_occurred 事件
  },
})
```

#### 3. 工具实现模板

以 Midjourney 为例的标准实现流程：

```typescript
// src/mastra/tools/midjourney-image-generate-tool.ts
import { api } from '@/convex/_generated/api'
import { s3 } from '@/integration/s3'
import { createVirtualFileSystem } from '@/mastra/factory'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { ConvexClient } from 'convex/browser'

type MidjourneyImageGenerateResult =
  | Array<{
      id: string
      resource_id?: string
      job_id: string
      file_name?: string
      file_size: number
      key: string
    }>
  | { error: string }

export const midjourneyImageGenerateTool = createTool({
  id: 'midjourney-image-generate',
  description: MIDJOURNEY_TOOL_DESCRIPTION,
  inputSchema: midjourneyImageGenerateInputSchema,
  execute: async (context): Promise<MidjourneyImageGenerateResult> => {
    const { context: input, resourceId, threadId, runId } = context

    // 硬错误：必须有 threadId
    if (!threadId) {
      throw new Error('threadId is required for midjourney-image-generate tool')
    }

    const convex = new ConvexClient(env.value.CONVEX_URL)

    // 1. 创建任务记录
    const taskId = await convex.mutation(api.tasks.create, {
      threadId,
      resourceId,
      runId,
      toolId: 'midjourney-image-generate',
      assetType: 'image',
      provider: 'huiyan',
      input,
    })

    try {
      // 2. 生成图片流并监听事件
      const result = await firstValueFrom(
        generateImageStream({
          prompt: input.prompt,
        }).pipe(
          tap(async (event) => {
            // 3. 将流事件写入 tasks 表
            if ('progress' in event) {
              await convex.mutation(api.tasks.update, {
                taskId,
                progress: event.progress,
                status: 'generating',
                event: {
                  eventType: 'progress_update',
                  progress: event.progress,
                  data: event.imageUrl
                    ? { previewUrl: event.imageUrl }
                    : undefined,
                },
              })
            }
          }),
        ),
      )

      if (result.progress === 100) {
        // 4. 下载并上传到 S3（直接流式传输）
        const imageResponse = await fetch(result.imageUrl!)

        const s3Key = `${threadId}${input.output.path}`
        await s3.value.send(
          new PutObjectCommand({
            Bucket: env.value.S3_BUCKET,
            Key: s3Key,
            Body: imageResponse.body!, // 直接使用 ReadableStream
            ContentType: 'image/jpeg',
          }),
        )

        // 5. 创建 VFS 文件引用
        const vfs = createVirtualFileSystem(threadId)
        await vfs.writeFile({
          path: input.output.path,
          content: '', // 实际内容在 S3
          contentType: 'image/jpeg',
          metadata: {
            s3Key,
            s3Bucket: env.value.S3_BUCKET,
            originalUrl: result.imageUrl,
            jobId: result.id,
          },
        })

        // 6. 完成任务
        await convex.mutation(api.tasks.complete, {
          taskId,
          output: {
            success: true,
            path: input.output.path,
            s3Key,
          },
        })

        return [
          {
            key: input.output.path,
            id: result.id,
            job_id: result.id,
            file_size: 0, // 实际大小可从 S3 获取
            // 其他返回字段...
          },
        ]
      }

      // 软错误：生成失败
      await convex.mutation(api.tasks.complete, {
        taskId,
        error: 'Image generation failed - progress did not reach 100%',
      })

      return {
        error: 'Image generation failed - progress did not reach 100%',
      }
    } catch (error) {
      // 软错误：将错误信息返回给 LLM
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      await convex.mutation(api.tasks.complete, {
        taskId,
        error: errorMessage,
      })

      return {
        error: errorMessage,
      }
    }
  },
})
```

## 实施指南

### 1. 环境准备

- 确保 Convex 项目已初始化并配置
- 确保 S3/R2 凭证已配置
- 确保 VFS 使用 ConvexStorage 实现

### 2. 核心实现步骤

1. **创建 Convex mutations**（`src/convex/tasks.ts`）
   - 实现 create、update、complete mutations
   - update mutation 同时处理瞬时状态和事件追加
   - 添加必要的查询（如 getTasksByThread）

2. **改造工具的 execute 方法**
   - 添加 Convex client 初始化
   - 在执行开始时创建 task 记录
   - 使用 RxJS tap 操作符监听流事件
   - 将事件写入 Convex
   - 完成后上传文件到 S3
   - 创建 VFS 文件引用
   - 更新 task 状态

3. **处理错误和边界情况**
   - 网络错误重试
   - 任务超时处理
   - 清理未完成的任务

### 3. 测试要点

- 单元测试：模拟流事件，验证 Convex 写入
- 集成测试：完整的工具调用流程
- 并发测试：多个任务同时执行
- 错误恢复测试：网络中断、服务异常等

### 4. 前端集成（参考）

```typescript
// 前端订阅任务进度
const tasks = useQuery(api.tasks.getTasksByThread, { threadId })

// 实时显示进度
tasks?.map(task => (
  <div>
    <h3>{task.toolId}</h3>
    <progress value={task.progress} max={100} />
    {task.events?.map(event => (
      // 显示事件详情
    ))}
  </div>
))
```

## 关键点总结

1. **VFS 路径即 S3 Key**：`{threadId}/{input.output.path}`
2. **文件内容分离**：VFS 只存储元数据，实际内容在 S3
3. **事件持久化**：所有进度更新都写入 Convex，可回放
4. **错误处理**：任何步骤失败都要更新 task 状态
5. **类型安全**：利用 Convex 的端到端类型系统

## 适用工具列表

需要按此模式改造的工具：

- `midjourney-image-generate-tool.ts` - Midjourney 图片生成
- `speedpaint-video-generate-tool.ts` - 速绘视频生成
- `minimax-text-to-audio-tool.ts` - 文本转音频
- `draw-out-video-cutout-tool.ts` - 视频剪辑
- 其他长时间执行的工具...

## 注意事项

1. **Convex 限制**：单个 mutation 执行时间限制，需要合理拆分
2. **流处理**：确保 tap 操作不阻塞主流程
3. **并发控制**：避免过多并发请求导致限流
4. **成本考虑**：Convex 按操作计费，需要合理设计更新频率
