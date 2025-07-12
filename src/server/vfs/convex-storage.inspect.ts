#!/usr/bin/env bun
import { createVirtualFileSystem } from '@/mastra/factory'
import { ulid } from 'ulid'

async function testConvexVFS() {
  console.log('🧪 Testing Convex VFS Integration...\n')

  const projectId = ulid()
  const vfs = createVirtualFileSystem(projectId)

  console.log(`📁 Created VFS for project: ${projectId}`)

  // 测试1: 写入小文件
  console.log('\n1️⃣ Testing small file write...')
  const smallFile = {
    path: '/test/small.txt',
    content: 'Hello from Convex VFS!',
    contentType: 'text/plain',
    description: 'A small test file',
  }

  const writeResult = await vfs.writeFile(smallFile)
  if (writeResult.success) {
    console.log('✅ Small file written successfully')
  } else {
    console.error('❌ Failed to write small file:', writeResult.error)
    return
  }

  // 测试2: 读取文件
  console.log('\n2️⃣ Testing file read...')
  const readResult = await vfs.readFile(smallFile.path)
  if (readResult.success && readResult.data) {
    console.log('✅ File read successfully:')
    console.log('   Content:', readResult.data.content)
    console.log('   Type:', readResult.data.contentType)
  } else {
    console.error(
      '❌ Failed to read file:',
      readResult.success === false ? readResult.error : 'Unknown error',
    )
    return
  }

  // 测试3: 列出文件
  console.log('\n3️⃣ Testing file list...')
  const listResult = await vfs.listFiles()
  if (listResult.success) {
    console.log('✅ Files listed successfully:')
    listResult.data.forEach((file) => {
      console.log(`   - ${file.path} (${file.size} bytes)`)
    })
  } else {
    console.error('❌ Failed to list files:', listResult.error)
    return
  }

  // 测试4: 写入另一个小文件
  console.log('\n4️⃣ Testing another small file...')
  const anotherFile = {
    path: '/test/another.txt',
    content: 'Another test file content',
    contentType: 'text/plain',
    description: 'Another small test file',
  }

  const anotherWriteResult = await vfs.writeFile(anotherFile)
  if (anotherWriteResult.success) {
    console.log('✅ Another file written successfully')
  } else {
    console.error('❌ Failed to write another file:', anotherWriteResult.error)
    return
  }

  // 测试5: 复制文件
  console.log('\n5️⃣ Testing file copy...')
  const copyResult = await vfs.copyFile(smallFile.path, '/test/small-copy.txt')
  if (copyResult.success) {
    console.log('✅ File copied successfully')
  } else {
    console.error('❌ Failed to copy file:', copyResult.error)
  }

  // 测试6: 移动文件
  console.log('\n6️⃣ Testing file move...')
  const moveResult = await vfs.moveFile(
    '/test/small-copy.txt',
    '/test/small-moved.txt',
  )
  if (moveResult.success) {
    console.log('✅ File moved successfully')
  } else {
    console.error('❌ Failed to move file:', moveResult.error)
  }

  // 测试7: 删除文件
  console.log('\n7️⃣ Testing file delete...')
  const deleteResult = await vfs.deleteFile('/test/small-moved.txt')
  if (deleteResult.success) {
    console.log('✅ File deleted successfully')
  } else {
    console.error('❌ Failed to delete file:', deleteResult.error)
  }

  // 测试8: 递归删除
  console.log('\n8️⃣ Testing recursive delete...')
  const recursiveDeleteResult = await vfs.deleteFile('/test', {
    recursive: true,
  })
  if (recursiveDeleteResult.success) {
    console.log('✅ Directory deleted recursively')
  } else {
    console.error('❌ Failed to delete directory:', recursiveDeleteResult.error)
  }

  console.log('\n✨ All tests completed!')
}

// 运行测试
if (import.meta.main) {
  testConvexVFS().catch(console.error)
}
