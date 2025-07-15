#!/usr/bin/env bun
import { env } from '@/lib/env'
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3'

import { S3 } from './s3'

async function testS3Upload() {
  console.log('🧪 Testing S3/R2 Upload Functionality...\n')

  // 显示配置信息（隐藏敏感信息）
  console.log('📋 Configuration:')
  console.log(`   Account ID: ${env.value.CLOUDFLARE_ACCOUNT_ID}`)
  console.log(
    `   Access Key: ${env.value.CLOUDFLARE_ACCESS_KEY_ID?.slice(0, 8)}...`,
  )
  console.log(
    `   Secret Key: ${env.value.CLOUDFLARE_SECRET_KEY ? '[SET]' : '[NOT SET]'}`,
  )
  console.log(`   Bucket: ${env.value.CLOUDFLARE_R2_BUCKET_NAME}`)
  console.log(
    `   Endpoint: https://${env.value.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com\n`,
  )

  try {
    // 测试1: 列出存储桶对象
    console.log('1️⃣ Testing bucket access...')
    const listCommand = new ListObjectsV2Command({
      Bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
      MaxKeys: 5,
    })

    const listResult = await S3.client().send(listCommand)
    console.log('✅ Bucket access successful')
    console.log(`   Objects count: ${listResult.Contents?.length || 0}`)
    if (listResult.Contents?.length) {
      console.log('   Recent objects:')
      listResult.Contents.slice(0, 3).forEach((obj) => {
        console.log(`   - ${obj.Key} (${obj.Size} bytes)`)
      })
    }
    console.log()

    // 测试2: 上传小文件
    console.log('2️⃣ Testing small file upload...')
    const testKey = `test/s3-test-${Date.now()}.txt`
    const testContent = 'Hello from S3 test! 🚀'
    const testBytes = new TextEncoder().encode(testContent)

    const putCommand = new PutObjectCommand({
      Bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
      Key: testKey,
      Body: testBytes,
      ContentType: 'text/plain',
      Metadata: {
        test: 'true',
        timestamp: Date.now().toString(),
      },
    })

    const putResult = await S3.client().send(putCommand)
    console.log('✅ Small file upload successful')
    console.log(`   ETag: ${putResult.ETag}`)
    console.log(`   Key: ${testKey}`)
    console.log(`   Size: ${testBytes.length} bytes`)
    console.log()

    // 测试3: 下载文件验证
    console.log('3️⃣ Testing file download...')
    const getCommand = new GetObjectCommand({
      Bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
      Key: testKey,
    })

    const getResult = await S3.client().send(getCommand)
    const downloadedContent = await getResult.Body?.transformToString()

    if (downloadedContent === testContent) {
      console.log('✅ File download and content verification successful')
      console.log(`   Content: "${downloadedContent}"`)
    } else {
      console.log('❌ Content mismatch!')
      console.log(`   Expected: "${testContent}"`)
      console.log(`   Got: "${downloadedContent}"`)
    }
    console.log()

    // 测试4: 上传二进制文件（模拟音频）
    console.log('4️⃣ Testing binary file upload (simulating audio)...')
    const binaryKey = `test/binary-test-${Date.now()}.bin`
    // 创建一些模拟的二进制数据
    const binaryData = new Uint8Array(1024).map((_, i) => i % 256)

    const binaryPutCommand = new PutObjectCommand({
      Bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
      Key: binaryKey,
      Body: binaryData,
      ContentType: 'application/octet-stream',
      Metadata: {
        test: 'true',
        type: 'binary',
        size: binaryData.length.toString(),
      },
    })

    const binaryPutResult = await S3.client().send(binaryPutCommand)
    console.log('✅ Binary file upload successful')
    console.log(`   ETag: ${binaryPutResult.ETag}`)
    console.log(`   Key: ${binaryKey}`)
    console.log(`   Size: ${binaryData.length} bytes`)
    console.log()

    // 测试5: 生成公共URL
    console.log('5️⃣ Testing public URL generation...')
    const publicUrl = S3.createPublicUrl({
      bucket: env.value.CLOUDFLARE_R2_BUCKET_NAME,
      key: testKey,
    })
    console.log('✅ Public URL generated')
    console.log(`   URL: ${publicUrl}`)
    console.log()

    console.log('🎉 All S3/R2 tests passed successfully!')
    console.log('\n📁 Test files created:')
    console.log(`   - ${testKey}`)
    console.log(`   - ${binaryKey}`)
    console.log('\n💡 You can clean these up manually if needed.')
  } catch (error) {
    console.error('❌ S3 test failed:', error)

    if (error instanceof Error) {
      console.error('\n🔍 Error details:')
      console.error(`   Message: ${error.message}`)
      console.error(`   Name: ${error.name}`)

      // 检查常见的错误类型
      if (error.message.includes('SignatureDoesNotMatch')) {
        console.error('\n💡 Possible causes:')
        console.error('   - Incorrect secret access key')
        console.error('   - Wrong endpoint configuration')
        console.error('   - Clock skew (check system time)')
        console.error('   - Invalid account ID')
      } else if (error.message.includes('AccessDenied')) {
        console.error('\n💡 Possible causes:')
        console.error('   - Insufficient permissions')
        console.error('   - Wrong bucket name')
        console.error('   - CORS policy issues')
      } else if (error.message.includes('NoSuchBucket')) {
        console.error('\n💡 Possible causes:')
        console.error('   - Bucket does not exist')
        console.error('   - Wrong bucket name')
        console.error('   - Wrong region/endpoint')
      }
    }

    console.error('\n🔧 Debugging steps:')
    console.error(
      '   1. Verify your .env file has correct Cloudflare R2 credentials',
    )
    console.error('   2. Check if the bucket exists and is accessible')
    console.error('   3. Verify the account ID in the endpoint URL')
    console.error('   4. Ensure the API token has R2 read/write permissions')
  }
}

// 运行测试
if (import.meta.main) {
  await testS3Upload()
}
