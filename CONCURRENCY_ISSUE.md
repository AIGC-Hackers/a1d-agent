# Agent 并发控制架构问题与解决方案

## 问题描述

当前 a1d-agent 系统存在严重的并发控制问题：

### 核心问题
1. **异步 Agent 执行缺乏控制**: Agent 可以异步运行，但系统缺乏对并发任务数量的限制
2. **用户会话管理不完善**: 用户可以关闭项目或新开 thread，但后台 Agent 仍在运行，导致资源浪费
3. **并发限制暴露**: 当多个用户同时使用系统时，缺乏有效的并发控制机制
4. **孤儿任务问题**: 用户断开连接后，相关任务可能成为孤儿进程继续消耗资源

### 当前架构分析

基于代码分析，当前系统架构如下：

```typescript
// 当前任务状态管理 (src/convex/schema.ts)
export const taskStatus = v.union(
  v.literal('started'),
  v.literal('generating'), 
  v.literal('completed'),
  v.literal('failed'),
)

// 任务表结构
task: defineTable({
  threadId: v.string(),        // 线程隔离
  resourceId: v.string(),
  status: taskStatus,
  progress: v.number(),
  // ... 缺乏并发控制字段
})
```

**问题点**:
- 没有用户级别的并发限制
- 缺乏任务优先级管理
- 没有资源使用监控
- 缺乏任务生命周期管理

## 架构改进建议

### 1. 任务管理系统增强

#### 1.1 扩展数据库 Schema

```typescript
// 新增用户并发控制表
user_concurrency: defineTable({
  userId: v.string(),
  activeTaskCount: v.number(),
  maxConcurrentTasks: v.number(),
  lastActivityTime: v.number(),
})
  .index('by_user', ['userId']),

// 扩展任务表
task: defineTable({
  // ... 现有字段
  userId: v.string(),           // 用户标识
  priority: v.number(),         // 任务优先级 (1-10)
  maxExecutionTime: v.number(), // 最大执行时间 (毫秒)
  createdAt: v.number(),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  resourceUsage: v.optional(v.object({
    cpuTime: v.number(),
    memoryUsage: v.number(),
    apiCalls: v.number(),
  })),
})
  .index('by_user_status', ['userId', 'status'])
  .index('by_priority', ['priority'])
  .index('by_created_time', ['createdAt']),
```

#### 1.2 并发控制服务

```typescript
// src/convex/concurrency.ts
export const checkConcurrencyLimit = mutation({
  args: {
    userId: v.string(),
    taskType: v.string(),
  },
  handler: async (ctx, args) => {
    const userConcurrency = await ctx.db
      .query('user_concurrency')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .first()

    if (!userConcurrency) {
      // 创建默认并发配置
      await ctx.db.insert('user_concurrency', {
        userId: args.userId,
        activeTaskCount: 0,
        maxConcurrentTasks: 3, // 默认限制
        lastActivityTime: Date.now(),
      })
      return { allowed: true }
    }

    // 检查并发限制
    if (userConcurrency.activeTaskCount >= userConcurrency.maxConcurrentTasks) {
      return { 
        allowed: false, 
        reason: 'CONCURRENCY_LIMIT_EXCEEDED',
        currentCount: userConcurrency.activeTaskCount,
        maxAllowed: userConcurrency.maxConcurrentTasks
      }
    }

    return { allowed: true }
  }
})
```

### 2. 任务生命周期管理

#### 2.1 任务调度器

```typescript
// src/convex/scheduler.ts
export const taskScheduler = internalMutation({
  handler: async (ctx) => {
    // 1. 清理超时任务
    await cleanupTimeoutTasks(ctx)
    
    // 2. 清理孤儿任务
    await cleanupOrphanTasks(ctx)
    
    // 3. 处理任务队列
    await processTaskQueue(ctx)
  }
})

async function cleanupTimeoutTasks(ctx: MutationCtx) {
  const timeoutTasks = await ctx.db
    .query('task')
    .withIndex('by_status', q => q.eq('status', 'generating'))
    .filter(q => q.lt(
      q.add(q.field('startedAt'), q.field('maxExecutionTime')),
      Date.now()
    ))
    .collect()

  for (const task of timeoutTasks) {
    await ctx.db.patch(task._id, {
      status: 'failed',
      error: 'Task execution timeout',
      completedAt: Date.now(),
    })
    
    // 减少用户并发计数
    await decrementUserConcurrency(ctx, task.userId)
  }
}
```

#### 2.2 孤儿任务检测

```typescript
async function cleanupOrphanTasks(ctx: MutationCtx) {
  const ORPHAN_THRESHOLD = 30 * 60 * 1000 // 30分钟

  const potentialOrphans = await ctx.db
    .query('task')
    .withIndex('by_status', q => q.eq('status', 'generating'))
    .filter(q => q.lt(
      q.field('startedAt'),
      Date.now() - ORPHAN_THRESHOLD
    ))
    .collect()

  for (const task of potentialOrphans) {
    // 检查用户最后活动时间
    const userActivity = await ctx.db
      .query('user_concurrency')
      .withIndex('by_user', q => q.eq('userId', task.userId))
      .first()

    if (userActivity && 
        userActivity.lastActivityTime < Date.now() - ORPHAN_THRESHOLD) {
      // 标记为孤儿任务并清理
      await ctx.db.patch(task._id, {
        status: 'failed',
        error: 'Orphaned task - user disconnected',
        completedAt: Date.now(),
      })
      
      await decrementUserConcurrency(ctx, task.userId)
    }
  }
}
```

### 3. 资源监控与限流

#### 3.1 Rate Limiting 实现

```typescript
// src/convex/rateLimiting.ts
export const rateLimiter = {
  // 每用户每分钟最大请求数
  userRequestLimit: 60,
  
  // 每用户每小时最大任务数
  userTaskLimit: 100,
  
  // 系统全局并发限制
  globalConcurrencyLimit: 50,
}

export const checkRateLimit = mutation({
  args: {
    userId: v.string(),
    action: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const windowStart = now - 60 * 1000 // 1分钟窗口

    const recentRequests = await ctx.db
      .query('user_activity')
      .withIndex('by_user_time', q => 
        q.eq('userId', args.userId)
         .gte('timestamp', windowStart)
      )
      .collect()

    if (recentRequests.length >= rateLimiter.userRequestLimit) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60 - Math.floor((now - windowStart) / 1000)
      }
    }

    // 记录请求
    await ctx.db.insert('user_activity', {
      userId: args.userId,
      action: args.action,
      timestamp: now,
    })

    return { allowed: true }
  }
})
```

### 4. Agent 工作流集成

#### 4.1 增强 DrawOut Agent

```typescript
// src/mastra/agents/drawout-agent-enhanced.ts
export const drawOutAgentEnhanced = new Agent({
  name: 'Drawout.ai Enhanced',
  description: 'Draw out the story with concurrency control',
  
  // 添加并发控制中间件
  middleware: [
    concurrencyControlMiddleware,
    resourceMonitoringMiddleware,
    taskTimeoutMiddleware,
  ],
  
  // ... 其他配置
})

const concurrencyControlMiddleware = async (context: AgentContext, next: Function) => {
  const { userId, taskType } = context
  
  // 检查并发限制
  const concurrencyCheck = await checkConcurrencyLimit({ userId, taskType })
  if (!concurrencyCheck.allowed) {
    throw new Error(`Concurrency limit exceeded: ${concurrencyCheck.reason}`)
  }
  
  // 增加并发计数
  await incrementUserConcurrency(userId)
  
  try {
    return await next()
  } finally {
    // 减少并发计数
    await decrementUserConcurrency(userId)
  }
}
```

### 5. 前端集成建议

#### 5.1 任务状态监控

```typescript
// 前端任务监控组件
export function TaskMonitor({ userId }: { userId: string }) {
  const { data: userConcurrency } = useQuery(api.concurrency.getUserConcurrency, { userId })
  const { data: activeTasks } = useQuery(api.tasks.getActiveTasks, { userId })

  return (
    <div className="task-monitor">
      <div>活跃任务: {userConcurrency?.activeTaskCount || 0}</div>
      <div>并发限制: {userConcurrency?.maxConcurrentTasks || 0}</div>
      <div>任务队列: {activeTasks?.length || 0}</div>
    </div>
  )
}
```

### 6. 部署和监控

#### 6.1 定时任务配置

```typescript
// convex/crons.ts
export default cronJobs.register({
  // 每分钟清理超时和孤儿任务
  taskCleanup: {
    schedule: "* * * * *", // 每分钟
    handler: taskScheduler,
  },
  
  // 每小时生成资源使用报告
  resourceReport: {
    schedule: "0 * * * *", // 每小时
    handler: generateResourceReport,
  },
})
```

## 实施优先级

### Phase 1 (高优先级)
1. 实现基础并发控制 (user_concurrency 表)
2. 添加任务超时机制
3. 实现孤儿任务清理

### Phase 2 (中优先级)  
1. 添加 Rate Limiting
2. 实现任务优先级队列
3. 资源使用监控

### Phase 3 (低优先级)
1. 高级调度算法
2. 动态并发限制调整
3. 详细的性能分析

## 预期效果

实施这些改进后，系统将具备：

1. **可控的并发**: 每用户最大并发任务限制
2. **资源保护**: 防止资源耗尽和系统过载
3. **任务可靠性**: 自动清理超时和孤儿任务
4. **用户体验**: 更好的任务状态反馈和错误处理
5. **系统稳定性**: 更强的容错能力和恢复机制

这个架构改进将显著提升系统的并发处理能力和稳定性，解决当前暴露的并发问题。
