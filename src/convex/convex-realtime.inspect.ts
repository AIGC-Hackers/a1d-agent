#!/usr/bin/env bun
import { api } from '@/convex/_generated/api'
import { env } from '@/lib/env'
import { ConvexClient } from 'convex/browser'

async function testConvexRealtime() {
  console.log('🔄 Testing Convex Real-time Subscriptions...\n')

  const convexClient = new ConvexClient(env.value.CONVEX_URL)

  // 监听所有活跃任务
  const unsubscribe = convexClient.onUpdate(
    api.tasks.getActiveTasks,
    { threadId: 'test-thread' },
    (activeTasks) => {
      console.log(`📊 Active tasks count: ${activeTasks?.length || 0}`)

      if (activeTasks && activeTasks.length > 0) {
        activeTasks.forEach((task) => {
          console.log(
            `  📋 Task ${task._id}: ${task.progress}% - ${task.status}`,
          )
        })
      }
    },
  )

  // 创建一个测试任务
  console.log('🚀 Creating a test task...')
  const taskId = await convexClient.mutation(api.tasks.createTask, {
    threadId: 'test-thread',
    resourceId: 'test-resource',
    runId: 'test-run',
    toolId: 'test-tool',
    assetType: 'image',
    provider: 'test-provider',
    input: { prompt: 'test prompt' },
  })

  console.log(`✅ Created task: ${taskId}`)

  // 模拟进度更新
  const progressSteps = [25, 50, 75, 100]
  for (const progress of progressSteps) {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await convexClient.mutation(api.tasks.updateTaskProgress, {
      taskId,
      progress,
      status: progress < 100 ? 'generating' : 'completed',
    })

    await convexClient.mutation(api.tasks.addTaskEvent, {
      taskId,
      eventType: progress < 100 ? 'progress_update' : 'task_completed',
      progress,
      data: { description: `Progress: ${progress}%` },
    })

    console.log(`📈 Updated progress to ${progress}%`)
  }

  // 等待一下再清理
  await new Promise((resolve) => setTimeout(resolve, 2000))

  console.log('\n🧹 Cleaning up...')
  unsubscribe()
  console.log('✅ Test completed!')
}

// 运行测试
if (import.meta.main) {
  testConvexRealtime().catch(console.error)
}
