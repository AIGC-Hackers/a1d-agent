#!/usr/bin/env bun
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { api } from '@/convex/_generated/api'
import { env } from '@/lib/env'
import { ConvexClient } from 'convex/browser'

async function testR2UploadFinal() {
  console.log('🧪 R2 Upload Test - Final Version\n')

  // 初始化 Convex 客户端
  const convexUrl = env.value.CONVEX_URL
  if (!convexUrl) {
    console.error('❌ CONVEX_URL environment variable is not set')
    return
  }

  console.log('📡 Convex URL:', convexUrl)
  const client = new ConvexClient(convexUrl)

  // 定义要上传的图片文件
  const imageFiles = ['p1.jpg', 'p2.jpg', 'p3.jpg']
  const assetsDir = join(process.cwd(), 'assets', 'images')

  console.log('📁 Assets directory:', assetsDir)

  // Step 1: 验证文件并读取内容
  console.log('\n1️⃣ Loading image files...')
  const filesToUpload: Array<{
    filename: string
    contentType: string
    data: Uint8Array
  }> = []

  for (const filename of imageFiles) {
    const filepath = join(assetsDir, filename)
    if (existsSync(filepath)) {
      try {
        const buffer = await readFile(filepath)
        const uint8Array = new Uint8Array(buffer)
        filesToUpload.push({
          filename,
          contentType: 'image/jpeg',
          data: uint8Array,
        })
        console.log(
          `✅ ${filename} - ${(buffer.byteLength / 1024).toFixed(2)} KB`,
        )
      } catch (error) {
        console.error(`❌ Failed to read ${filename}:`, error)
      }
    } else {
      console.error(`❌ File not found: ${filepath}`)
    }
  }

  if (filesToUpload.length === 0) {
    console.error('\n❌ No files found to upload!')
    return
  }

  // Step 2: 检查是否有 r2Upload action
  console.log('\n2️⃣ Checking for r2Upload action...')
  if (!api.r2Upload?.uploadImage) {
    console.error('❌ r2Upload.uploadImage action not found!')
    console.log(
      '\n📝 Please create src/convex/r2Upload.ts with the following code:',
    )
    console.log(
      '\n' +
        (await readFile(
          join(process.cwd(), 'tasks/r2-upload-test/r2-upload-action.ts'),
          'utf-8',
        )),
    )
    return
  }

  // Step 3: 上传图片
  console.log('\n3️⃣ Uploading images to R2...')
  for (const file of filesToUpload) {
    console.log(`\n📤 Uploading ${file.filename}...`)
    try {
      const result = await client.action(api.r2Upload.uploadImage, {
        filename: file.filename,
        contentType: file.contentType,
        data: file.data,
      })

      if (result.success) {
        console.log(`✅ Upload successful!`)
        console.log(`   Key: ${result.key}`)
        console.log(`   URL: ${result.url}`)
        console.log(`   Size: ${(result.size / 1024).toFixed(2)} KB`)
      } else {
        console.error(`❌ Upload failed: ${result.error}`)
      }
    } catch (error) {
      console.error(`❌ Error uploading ${file.filename}:`, error)
    }
  }

  // Step 4: 测试批量上传（如果存在）
  if (api.r2Upload?.uploadImages) {
    console.log('\n4️⃣ Testing batch upload...')
    try {
      const batchResult = await client.action(api.r2Upload.uploadImages, {
        images: filesToUpload,
      })
      console.log(`✅ Batch upload completed:`)
      console.log(`   Total: ${batchResult.total}`)
      console.log(`   Successful: ${batchResult.successful}`)
      console.log(`   Failed: ${batchResult.failed}`)
    } catch (error) {
      console.error('❌ Batch upload failed:', error)
    }
  }

  console.log('\n✨ Test completed!')
}

// 运行测试
if (import.meta.main) {
  testR2UploadFinal().catch(console.error)
}
