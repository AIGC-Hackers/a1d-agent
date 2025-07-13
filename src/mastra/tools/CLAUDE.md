# Mastra 工具开发指南

本文档定义了在 `src/mastra/tools` 目录下开发工具时应遵循的规范和原则。

## 核心原则

### 1. 工具定义结构

工具定义包含以下核心部分：

```typescript
export const tool = createTool({
  id: 'example',
  description: '清晰描述工具的功能',
  inputSchema: schema, // 使用 zod 定义输入验证
  execute: async (): Promise<ToolResult> => {
    /* ... */
  },
})
```

关键要点：

- 通过 TypeScript 类型系统确保类型安全
- 使用明确的返回类型声明
- 保持工具定义简洁明了

### 2. 返回类型设计

采用简洁的 OR 类型模式，让 LLM 能够通过结构理解结果状态：

```typescript
// 定义清晰的 OR 类型
type ToolResult = DataType | { error: string }

// 具体示例
type ImageGenerateResult =
  | Array<{ id: string; url: string }> // 成功时返回数据
  | { error: string } // 失败时返回错误

// 实际使用
const result = await tool.execute()
// LLM 通过结构判断：存在 error 字段表示失败，否则为成功数据
```

## 错误处理原则

### 1. 硬错误 vs 软错误

**硬错误**（Hard Errors）- 使用 `throw` 抛出：

- 必需的运行时依赖缺失（如 `threadId`）
- 环境配置错误（如缺少必需的 API 密钥）
- 编程错误（如类型错误）

**软错误**（Soft Errors）- 作为结果返回：

- API 调用失败
- 业务逻辑错误（如生成失败、搜索无结果）
- 外部服务不可用
- 超时或网络错误

### 2. Execute 函数设计

为 `execute` 函数声明明确的返回类型，确保类型安全和一致的响应格式：

```typescript
// 定义专用的返回类型
type ExampleResult = SomeDataType | { error: string }

// 在 execute 函数中使用
execute: async (context): Promise<ExampleResult> => {
  // 实现逻辑
}
```

### 3. 错误处理模式

```typescript
type ExampleResult = SomeDataType | { error: string }

export const exampleTool = createTool({
  id: 'example-tool',
  description: 'Tool description',
  inputSchema: z.object({
    /* ... */
  }),
  execute: async (context): Promise<ExampleResult> => {
    const { context: input, threadId } = context

    // 硬错误：缺少必需的运行时依赖
    if (!threadId) {
      throw new Error('threadId is required for example-tool')
    }

    try {
      // 执行工具逻辑
      const result = await performOperation(input)

      if (!result) {
        // 软错误：操作失败，返回错误信息给 LLM
        return {
          error: 'Operation failed: no result returned',
        }
      }

      return result // 直接返回数据
    } catch (error) {
      // 软错误：捕获异常，返回错误信息给 LLM
      return {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  },
})
```

## 参考实现

### 良好示例：Google Search Tool

参考 `@src/mastra/tools/google-search-tool.ts`：

- 声明了明确的返回类型 `GoogleSearchToolResult`
- 处理了"无结果"的情况，返回友好的消息
- 不会因为搜索失败而抛出异常

### 长任务工具示例

参考 `@src/tasks/convex/tool-execution-plan.md` 中的 Midjourney 实现：

- 硬错误：缺少 `threadId` 时抛出异常
- 软错误：生成失败时返回错误信息
- 包含任务追踪和进度更新

## 工具返回格式模式

### 基础 OR 类型模式

```typescript
// 泛型定义
type ToolResult<T> = T | { error: string }

// 具体应用示例
type FileContent = string
type ReadFileResult = FileContent | { error: string }

type ImageData = Array<{ url: string; size: number }>
type GenerateImageResult = ImageData | { error: string }
```

### 复杂数据结构

为返回复杂信息的工具设计结构化数据：

```typescript
// 搜索工具示例：返回完整的搜索结果
type SearchResult =
  | {
      llmContent: string // 提供给 LLM 的详细内容
      returnDisplay: string // 简短的状态消息
      sources: any[] // 数据源信息
    }
  | { error: string } // 失败时返回错误描述

// LLM 通过结构识别：存在 error 字段即为失败情况
```

## 最佳实践

1. **类型安全**：为 `execute` 函数声明明确的返回类型
2. **错误信息**：编写清晰且有帮助的错误描述
3. **一致性**：在同类工具中采用统一的返回格式
4. **LLM 友好**：使用自然语言描述，便于 LLM 理解和处理
5. **资源管理**：确保在所有执行路径中正确清理资源

## 工具分类

### 1. 即时工具（Instant Tools）

- 执行时间短（< 5秒）
- 例如：搜索、文件操作
- 不需要进度追踪

### 2. 长任务工具（Long-running Tools）

- 执行时间长（> 5秒）
- 例如：图片生成、视频处理
- 需要实现进度追踪（参考 Convex tasks 集成）

### 3. 流式工具（Streaming Tools）

- 返回流式数据
- 需要特殊的错误处理和进度报告
- 考虑使用 RxJS 进行流处理
