# Convex 前端项目集成指南

## 概述

适用于非 monorepo 多项目场景，在独立前端工程中集成已有的 Convex 后端服务。

## 前置条件

- 已有运行的 Convex 后端项目
- 前端项目使用现代构建工具（Vite、webpack 等）

## 集成步骤

### 1. 生成 API 规范文件

在 **Convex 后端项目** 中执行：

```bash
npx convex-helpers ts-api-spec
```

此命令会生成包含类型安全函数引用的 `api.ts` 文件。

### 2. 安装依赖

在 **前端项目** 中安装 Convex 客户端：

```bash
pnpm add convex
```

### 3. 复制 API 文件

将后端生成的 `api.ts` 文件复制到前端项目的合适位置（如 `src/convex/`）。

### 4. 配置客户端连接

#### 环境变量配置

在前端项目中设置 Convex 部署 URL：

```bash
# .env
VITE_CONVEX_URL=https://your-convex-deployment.convex.cloud
```

#### 客户端初始化

```typescript
// src/lib/convex.ts
import { ConvexReactClient } from 'convex/react'

const convexUrl = import.meta.env.VITE_CONVEX_URL
if (!convexUrl) {
  throw new Error('VITE_CONVEX_URL environment variable is required')
}

export const convexClient = new ConvexReactClient(convexUrl)
```

#### React 应用包装

```typescript
// src/main.tsx
import { ConvexProvider } from "convex/react"
import { convexClient } from "./lib/convex"

function App() {
  return (
    <ConvexProvider client={convexClient}>
      {/* 你的应用组件 */}
    </ConvexProvider>
  )
}
```

### 5. 使用 Convex 功能

```typescript
// src/components/TaskList.tsx
import { useQuery, useMutation } from "convex/react"
import { api } from "../convex/api"

export function TaskList() {
  // 查询数据
  const tasks = useQuery(api.tasks.getActiveTasks, { threadId: "main" })

  // 变更数据
  const createTask = useMutation(api.tasks.createTask)

  const handleCreateTask = () => {
    createTask({
      threadId: "main",
      resourceId: "resource-1",
      runId: "run-1",
      toolId: "tool-1",
      assetType: "image",
      provider: "openai",
      input: { prompt: "Generate an image" }
    })
  }

  return (
    <div>
      {tasks?.map(task => (
        <div key={task._id}>
          {task.status} - {task.progress}%
        </div>
      ))}
      <button onClick={handleCreateTask}>创建任务</button>
    </div>
  )
}
```

## 维护同步

### API 更新流程

1. 后端更新函数后，重新生成 API 文件：

   ```bash
   npx convex-helpers ts-api-spec
   ```

2. 将更新的 `api.ts` 文件同步到前端项目

3. 前端项目自动获得类型安全的更新

### 最佳实践

- **使用验证器**：后端函数使用 `v.string()`、`v.object()` 等验证器以获得最佳类型生成
- **版本管理**：建议将 `api.ts` 文件纳入版本控制
- **自动化同步**：可配置 CI/CD 自动同步 API 文件
- **环境区分**：为不同环境配置不同的 Convex 部署 URL

## 项目结构示例

```
frontend-project/
├── src/
│   ├── convex/
│   │   └── api.ts          # 从后端复制的 API 文件
│   ├── lib/
│   │   └── convex.ts       # 客户端配置
│   └── components/
│       └── TaskList.tsx    # 使用 Convex 的组件
├── .env                    # 环境变量
└── package.json
```

## 适用场景

- 前后端分离的独立仓库
- 与外部开发者协作
- 多个前端应用共享同一后端
- 需要类型安全的跨仓库通信

通过此方式，可以在保持前后端代码库独立的同时，享受 Convex 提供的实时数据同步和类型安全特性。
