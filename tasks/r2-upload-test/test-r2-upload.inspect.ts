#!/usr/bin/env bun
import { readFile } from 'fs/promises'
import { join } from 'path'
import { api } from '@/convex/_generated'
import { env } from '@/lib/env'
import { ConvexClient } from 'convex/browser'

async function testR2Upload() {
  console.log('🧪 Testing R2 Upload Integration...\n')

  // 初始化 Convex 客户端
  const convexUrl = env.value.CONVEX_URL
  if (!convexUrl) {
    console.error('❌ CONVEX_URL environment variable is not set')
    return
  }

  const client = new ConvexClient(convexUrl)

  // 定义要上传的图片文件
  const imageFiles = ['p1.jpg', 'p2.jpg', 'p3.jpg']
  const assetsDir = join(process.cwd(), 'assets', 'images')

  console.log('📁 Assets directory:', assetsDir)

  // 首先，我们需要创建一个 Convex action 来处理文件上传
  // 因为 components.r2.store 是 internal action，不能直接从客户端调用
  console.log('\n⚠️  Note: Direct R2 upload requires a custom Convex action')
  console.log('We need to create an action in convex/ directory that:')
  console.log('1. Receives file data as base64 or buffer')
  console.log('2. Calls components.r2.store internally')
  console.log('3. Returns the uploaded file URL\n')

  // 检查图片文件是否存在
  console.log('🔍 Checking image files...')
  for (const filename of imageFiles) {
    const filepath = join(assetsDir, filename)
    try {
      const stats = await readFile(filepath)
      console.log(`✅ Found ${filename} (${stats.byteLength} bytes)`)
    } catch (error) {
      console.error(`❌ File not found: ${filepath}`)
    }
  }

  console.log('\n📝 Suggested implementation:')
  console.log(`
// In convex/r2Upload.ts
import { v } from 'convex/values'
import { action } from './_generated/server'
import { components } from './_generated/api'

export const uploadImage = action({
  args: {
    filename: v.string(),
    contentType: v.string(),
    data: v.bytes(), // or v.string() for base64
  },
  handler: async (ctx, args) => {
    const { filename, contentType, data } = args

    // Convert data if needed
    const uint8Array = data instanceof Uint8Array ? data : new Uint8Array(data)

    // Upload to R2
    const key = await components.r2.store(ctx, uint8Array, {
      key: \`images/\${filename}\`,
      type: contentType,
    })

    // Get public URL
    const url = await components.r2.getUrl(ctx, key)

    return {
      key,
      url,
      size: uint8Array.byteLength,
    }
  },
})
`)

  console.log('\n✨ Test plan completed!')
  console.log('Next steps:')
  console.log('1. Create the Convex action as shown above')
  console.log('2. Run this script again to test the actual upload')
}

// 运行测试
if (import.meta.main) {
  testR2Upload().catch(console.error)
}
