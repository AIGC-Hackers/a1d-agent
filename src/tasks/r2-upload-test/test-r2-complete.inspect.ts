#!/usr/bin/env bun
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

async function testR2UploadComplete() {
  console.log('🧪 R2 Upload Test - Complete Version\n')

  // 定义要上传的图片文件
  const imageFiles = ['p1.jpg', 'p2.jpg', 'p3.jpg']
  const assetsDir = join(process.cwd(), 'assets', 'images')

  console.log('📁 Assets directory:', assetsDir)
  console.log('📋 Testing files:', imageFiles.join(', '))

  // Step 1: 验证文件存在
  console.log('\n1️⃣ Verifying image files...')
  const filesToUpload: Array<{
    filename: string
    path: string
    data?: Buffer
    size?: number
  }> = []

  for (const filename of imageFiles) {
    const filepath = join(assetsDir, filename)
    if (existsSync(filepath)) {
      try {
        const data = await readFile(filepath)
        filesToUpload.push({
          filename,
          path: filepath,
          data,
          size: data.byteLength,
        })
        console.log(
          `✅ ${filename} - ${(data.byteLength / 1024).toFixed(2)} KB`,
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

  // Step 2: 准备上传数据
  console.log('\n2️⃣ Preparing upload data...')
  const uploadData = filesToUpload.map((file) => ({
    filename: file.filename,
    contentType: 'image/jpeg',
    size: file.size!,
    dataPreview: file.data
      ? `${file.data.slice(0, 20).toString('hex')}...`
      : 'N/A',
  }))

  console.table(uploadData)

  // Step 3: 显示 Convex 集成步骤
  console.log('\n3️⃣ Convex Integration Steps:')
  console.log(`
📌 To complete the R2 upload test:

1. Copy the action code from 'r2-upload-action.ts' to 'src/convex/r2Upload.ts'

2. Deploy to Convex:
   $ npx convex dev

3. Create a test script that calls the action:
   
   import { ConvexClient } from 'convex/browser'
   import { api } from '@/convex/_generated/api'
   
   const client = new ConvexClient(process.env.CONVEX_URL!)
   
   // Upload single image
   const result = await client.action(api.r2Upload.uploadImage, {
     filename: 'p1.jpg',
     contentType: 'image/jpeg',
     data: new Uint8Array(fileBuffer),
   })

4. Verify upload by checking the returned URL
`)

  // Step 4: 环境变量检查
  console.log('\n4️⃣ Environment Variables Check:')
  const requiredEnvVars = [
    'CONVEX_URL',
    'CLOUDFLARE_R2_BUCKET_NAME',
    // R2 credentials are usually set in Convex dashboard
  ]

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar]
    console.log(`${envVar}: ${value ? '✅ Set' : '❌ Not set'}`)
  }

  // Step 5: 示例测试代码
  console.log('\n5️⃣ Example Test Implementation:')
  console.log(`
// test-upload.ts
import { ConvexClient } from 'convex/browser'
import { api } from '@/convex/_generated/api'
import { readFile } from 'fs/promises'

async function uploadTestImages() {
  const client = new ConvexClient(process.env.CONVEX_URL!)
  
  // Read and upload each image
  for (const file of ${JSON.stringify(filesToUpload.map((f) => f.filename))}) {
    const data = await readFile(\`assets/images/\${file}\`)
    const result = await client.action(api.r2Upload.uploadImage, {
      filename: file,
      contentType: 'image/jpeg',
      data: new Uint8Array(data),
    })
    
    console.log(\`Uploaded \${file}:\`, result)
  }
}
`)

  console.log('\n✨ Test preparation completed!')
  console.log('\n📝 Summary:')
  console.log(`- Found ${filesToUpload.length} files ready for upload`)
  console.log(
    `- Total size: ${(filesToUpload.reduce((sum, f) => sum + f.size!, 0) / 1024).toFixed(2)} KB`,
  )
  console.log('- Next: Implement the Convex action and run the upload test')
}

// 运行测试
if (import.meta.main) {
  testR2UploadComplete().catch(console.error)
}
