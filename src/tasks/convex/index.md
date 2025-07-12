# Convex 集成项目计划

## 项目概述

将 a1d-agent 项目逐步集成 Convex 作为统一的后端存储和事件处理平台，分三个阶段实施：

1. **阶段一**：VFS 迁移到 Convex
2. **阶段二**：工具调用事件总线集成
3. **阶段三**：Mastra Storage 接口适配

## 当前架构分析

### 现有 VFS 架构

- **接口定义**：`src/server/vfs/types.ts` - Storage 接口
- **实现类**：
  - `MemoryStorage` - 内存存储（开发环境）
  - `PostgresStorage` - PostgreSQL 存储
- **核心类型**：`VFile`, `FileInfo`, `Storage`
- **使用场景**：系统工具中的文件读写操作

### 现有工具调用架构

- **工具定义**：`src/mastra/tools/` 目录下各种工具
- **调用流程**：通过 Mastra 框架执行
- **当前问题**：缺乏中间事件的持久化和监控

### 现有 Mastra 存储架构

- **存储接口**：`MastraStorage` - 统一存储接口
- **当前实现**：使用 `@mastra/pg` PostgresStore
- **配置位置**：`src/mastra/factory.ts`
- **存储内容**：
  - `threads` - 对话线程
  - `messages` - 消息内容（V2格式，兼容AI SDK UIMessage）
  - `resources` - 用户资源数据
  - `workflows` - 工作流状态快照
  - `eval_datasets` - 评估数据集
  - `traces` - OpenTelemetry 追踪数据

### Convex 特性分析

- **实时响应式**：自动订阅数据变化，适合事件总线
- **TypeScript 原生**：端到端类型安全
- **无服务器**：适合 Cloudflare Workers 部署
- **文档限制**：单文档 1MB 限制（单条消息/单个文件元数据不会超限）
- **事务支持**：原子操作保证数据一致性
- **文件存储服务**：内置文件存储，支持大文件处理
- **R2 集成**：可通过 Cloudflare R2 组件扩展存储能力

### 当前文件存储现状

- **VFS 存储**：小的元数据和文本数据
- **外部存储**：AI 生成的图像、视频等存储在 S3
- **问题**：存储方案分散，管理复杂
- **目标**：统一使用 Convex 生态系统

## 阶段一：VFS 迁移到 Convex

### 目标

将虚拟文件系统从当前的 Memory/PostgreSQL 存储迁移到 Convex

### 技术细节需确认

参见 @tasks/convex/qa.md 中的"阶段一：VFS 迁移相关问题"章节

### 实施步骤

#### 1.1 环境配置与依赖安装

- [ ] 安装 Convex CLI: `npm install -g convex`
- [ ] 项目中添加 Convex 依赖: `pnpm add convex`
- [ ] 初始化 Convex 项目: `npx convex dev`
- [ ] 配置环境变量（CONVEX_URL, CONVEX_DEPLOY_KEY）

#### 1.2 定义 Convex Schema

参见 @tasks/convex/schema.md 中的"VFS 文件存储 Schema"章节

#### 1.3 实现 Convex VFS Storage

- [ ] 创建 `src/server/vfs/convex-storage.ts`
- [ ] 实现 Storage 接口的所有方法
- [ ] 实现智能存储策略（参见 @tasks/convex/schema.md）
- [ ] 处理 Convex 的异步特性和错误处理
- [ ] 实现文件路径的规范化和验证

#### 1.4 数据迁移与测试

- [ ] 设计 S3 → Convex 生态的迁移脚本
- [ ] 扩展现有测试用例支持 ConvexStorage
- [ ] 性能对比测试（vs Memory/PostgreSQL）
- [ ] 并发操作测试
- [ ] 大文件存储测试（Convex File Storage vs R2）

### 存储策略优势

- **统一管理**：所有文件都在 Convex 生态系统内
- **成本优化**：根据文件大小选择最优存储方案
- **性能优化**：小文件快速访问，大文件高效存储
- **简化架构**：消除多个存储服务的复杂性

## 阶段二：工具调用事件总线集成

### 目标

在工具调用过程中利用 Convex 作为持久化事件总线，发布和消费中间事件

### 资产生成工作流分析

参见 @tasks/convex/schema.md 中的"资产生成工作流代码"章节

### 统一数据模型设计目标

- 所有资产生成任务使用相同的事件模型
- 支持不同类型的资产（图片、视频、音频）
- 统一的进度追踪和状态管理
- 一套代码处理所有资产生成工具

### 核心需求明确

- ✅ **事件消费者**：前端 UI，用于实时显示生成过程
- ✅ **关键场景**：LLM 调用 MJ 生图等长任务，需要 UI 逐步显示进度，避免几十秒无响应
- ✅ **产品价值**：完整的 agent 对话和生成过程回放，作为产品 showcase 的核心功能
- ✅ **架构简化**：移除 PartySocket，Convex 作为更理想的 BaaS 解决方案
- ✅ **事件持久化**：事件作为 Convex 表中的行，永久存储

### 统一资产生成事件模型

参见 @tasks/convex/schema.md 中的"资产生成事件 Schema"章节

### 实施步骤

#### 2.1 统一资产生成框架设计

- [ ] 分析现有资产生成工具的共同模式
- [ ] 设计通用的资产生成基类/接口
- [ ] 定义标准的事件发布点和数据格式

#### 2.2 实现 Convex 事件存储

- [ ] 实现资产生成任务的 CRUD 操作
- [ ] 实现进度事件的批量写入
- [ ] 替换现有的 Cloudflare Queue 事件发布

#### 2.3 重构现有工具

- [ ] 重构 `midjourney-image-generate-tool.ts` 使用新的事件模型
- [ ] 实现 `speedpaint-video-generate-tool.ts` 和 `minimax-text-to-audio-tool.ts`
- [ ] 统一文件上传到 Convex R2 的逻辑

#### 2.4 前端实时订阅

- [ ] 实现 Convex 实时查询订阅任务进度
- [ ] 替换现有的事件消费逻辑
- [ ] 实现任务进度的 UI 组件

#### 2.5 集成测试与优化

- [ ] 端到端资产生成流程测试
- [ ] 多任务并发测试
- [ ] 性能优化和错误处理

## 阶段三：Mastra Storage 接口适配

### 目标

适配 Mastra storage 接口到 Convex，统一消息存储

### 技术细节需确认

参见 @tasks/convex/qa.md 中的"阶段三：Mastra Storage 相关问题"章节

### 实施步骤

#### 3.1 分析 Mastra Storage 接口

- [ ] 研究 `MastraStorage` 接口的完整定义
- [ ] 分析 6 种数据类型的存储模式和查询需求
- [ ] 识别 PostgreSQL 查询的性能瓶颈

#### 3.2 设计 Convex Mastra Schema

参见 @tasks/convex/schema.md 中的"Mastra Storage Schema"章节

#### 3.3 实现 Convex Mastra Adapter

- [ ] 创建 `ConvexMastraStore` 类实现 `MastraStorage` 接口
- [ ] 实现所有必需的方法（threads, messages, resources 等）
- [ ] 处理消息格式 V1/V2 的转换逻辑
- [ ] 实现批量操作和事务处理

#### 3.4 数据迁移与测试

- [ ] 设计 PostgreSQL → Convex 数据迁移脚本
- [ ] 实现增量同步机制
- [ ] 验证数据完整性和格式正确性
- [ ] 性能基准测试（查询延迟、吞吐量）

## 依赖关系图

```
阶段一 (VFS) → 阶段二 (Events) → 阶段三 (Mastra)
     ↓              ↓                ↓
   基础设施      事件基础设施      完整集成
```

## 风险评估

### 中风险

- [ ] 开发环境与生产环境配置差异
- [ ] 第三方依赖的版本兼容性
- [ ] 事件处理的延迟问题
  > 这里的事件其实是 convex table raw 的读写. 延迟问题取决于网络架构, 比如服务器和 convex 物理距离太远. 存储本身没什么影响

### 低风险

- [ ] 学习曲线和开发效率影响
  > 有计划就不怕, 在做之前会收集所有问题的解决方案
- [ ] 监控和调试工具的适配

## 成功标准

### 阶段一成功标准

- [ ] 所有现有 VFS 测试通过
- [ ] 性能不低于现有实现的 80%
- [ ] 支持开发和生产环境

### 阶段二成功标准

- [ ] 工具调用事件 100% 捕获
- [ ] 事件延迟 < 100ms
- [ ] 支持实时事件订阅

### 阶段三成功标准

- [ ] 数据迁移 100% 成功
  > 没有迁移工作
- [ ] 查询性能提升 > 20%
- [ ] 向后兼容性保持

## 核心决策确认 ✅

### 架构决策

- ✅ **存储选择**：二选一策略，选择 R2 组件（成本更低）
- ✅ **并发控制**：依赖 Convex 原生事务性，VFS 读写对应表行操作
- ✅ **实时方案**：移除 PartySocket，使用 Convex 实时订阅
- ✅ **查询复杂度**：无复杂查询需求，性能无忧
- ✅ **数据迁移**：当前 R2（S3 接口），未上线，无迁移成本
- ✅ **混合架构**：不保留 PostgreSQL，避免多系统复杂性

### 产品需求明确

- ✅ **核心场景**：长任务（如 MJ 生图）的实时进度显示
- ✅ **用户体验**：避免几十秒无响应，UI 逐步显示生成过程
- ✅ **产品价值**：完整的 agent 对话和生成过程回放功能
- ✅ **事件持久化**：事件永久存储在 Convex 表中

## 资产生成工具深度分析

### 现有工具分析

基于代码分析，当前的资产生成工具包括：

1. **midjourney-image-generate-tool.ts**：
   - ✅ 已实现，使用 `generateImageStream` 和 `uploadQuadrantImage`
   - ✅ 已有事件发布到 Cloudflare Queue
   - ✅ 已有文件上传到 S3 逻辑

2. **speedpaint-video-generate-tool.ts**：
   - ❌ 未实现（throw new Error）
   - 需要实现完整的视频生成流程

3. **minimax-text-to-audio-tool.ts**：
   - ❌ 未实现（throw new Error）
   - 需要实现音频生成流程

### 统一化改造计划

1. **抽象通用流程**：所有资产生成工具都遵循相同的 6 步流程
2. **统一事件模型**：替换 Cloudflare Queue，使用 Convex 事件存储
3. **统一文件存储**：从 S3 迁移到 Convex R2
4. **统一进度追踪**：前端可以实时显示任何资产生成的进度

### 技术债务清理

- 移除对 Cloudflare Queue 的依赖
- 统一文件上传逻辑
- 标准化错误处理和重试机制

## 待确认问题清单

参见 @tasks/convex/qa.md 获取完整的问题清单和用户回答

## 实施建议

### 优先级排序

1. **高优先级**：阶段一 VFS 迁移 - 统一文件存储，简化架构
2. **中优先级**：阶段二 事件总线 - 新功能，不影响现有系统
3. **低优先级**：阶段三 Mastra 存储 - 影响面大，需要充分测试

### 技术选型建议

- **开发环境**：使用 Convex 本地开发模式，便于调试
- **生产环境**：Convex Cloud + R2 组件，配合 Cloudflare Workers 部署
- **存储策略**：基于用户反馈，统一使用 Convex R2 组件处理所有文件存储
- **监控方案**：双层监控架构，Convex Dashboard + Mastra 应用层遥测

### 风险缓解策略

- **分阶段实施**：每个阶段独立验证，降低整体风险
- **功能开关**：使用环境变量控制 Convex 功能的启用/禁用
- **数据备份**：迁移前完整备份 PostgreSQL 数据
- **性能基准**：建立性能基线，持续监控关键指标

---

**文档组织**：

- 技术代码部分：@tasks/convex/schema.md
- 问答记录：@tasks/convex/qa.md

**下一步行动**：

1. 请逐一确认 @tasks/convex/qa.md 中的技术和业务问题
2. 确定项目的优先级和时间安排
3. 选择第一个阶段开始详细设计和实施

基于你的反馈，我们将进一步细化每个阶段的实施计划和技术方案。
