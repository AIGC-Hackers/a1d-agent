import { Result } from '@/lib/result'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { VFile } from '../types'
import { MemoryStorage } from '../memory-storage'
import { VFSError, VFSErrorCode } from '../types'
import { VirtualFileSystem } from '../virtual-file-system'

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem
  let storage: MemoryStorage
  const projectId = 'test-project'

  beforeEach(() => {
    storage = new MemoryStorage(projectId)
    vfs = new VirtualFileSystem(storage)
  })

  afterEach(() => {
    MemoryStorage.clearAll()
  })

  describe('Path validation', () => {
    it('should reject empty path', async () => {
      const result = await vfs.readFile('')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Path is required')
        expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        expect(result.error.path).toBe('')
      }
    })

    it('should reject non-string path', async () => {
      // @ts-expect-error Testing invalid input
      const result = await vfs.readFile(null)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Path is required')
        expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
      }
    })

    it('should reject relative path', async () => {
      const relativePath = 'relative/path.txt'
      const result = await vfs.readFile(relativePath)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Path must be absolute')
        expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        expect(result.error.path).toBe(relativePath)
      }
    })

    it('should reject path that is too long', async () => {
      const longPath = '/' + 'a'.repeat(1000)
      const result = await vfs.readFile(longPath)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('Path too long')
        expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        expect(result.error.path).toBe(longPath)
      }
    })

    it('should accept valid absolute path but return file not found', async () => {
      const validPath = '/valid/path.txt'
      const result = await vfs.readFile(validPath)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe(`File not found: ${validPath}`)
        expect(result.error.code).toBe(VFSErrorCode.FILE_NOT_FOUND)
        expect(result.error.path).toBe(validPath)
      }
    })
  })

  describe('File operations', () => {
    const testFile: VFile = {
      path: '/test.txt',
      content: 'Hello, World!',
      contentType: 'text/plain',
      description: 'Test file',
      metadata: { created: '2023-01-01' },
    }

    describe('writeFile', () => {
      it('should write a file successfully', async () => {
        const writeResult = await vfs.writeFile(testFile)
        expect(writeResult.success).toBe(true)

        // Verify file was written
        const readResult = await vfs.readFile(testFile.path)
        expect(readResult.success).toBe(true)
        if (readResult.success) {
          expect(readResult.data.path).toBe(testFile.path)
          expect(readResult.data.content).toBe(testFile.content)
          expect(readResult.data.contentType).toBe(testFile.contentType)
          expect(readResult.data.metadata).toEqual(testFile.metadata)
          expect(readResult.data).not.toHaveProperty('description')
        }
      })

      it('should overwrite existing file', async () => {
        const writeResult1 = await vfs.writeFile(testFile)
        expect(writeResult1.success).toBe(true)

        const updatedFile: VFile = {
          ...testFile,
          content: 'Updated content',
        }

        const writeResult2 = await vfs.writeFile(updatedFile)
        expect(writeResult2.success).toBe(true)

        const readResult = await vfs.readFile(testFile.path)
        expect(readResult.success).toBe(true)
        if (readResult.success) {
          expect(readResult.data.content).toBe('Updated content')
        }
      })

      it('should reject invalid path', async () => {
        const invalidFile: VFile = {
          ...testFile,
          path: 'invalid-path',
        }

        const result = await vfs.writeFile(invalidFile)
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(VFSError)
          expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        }
      })
    })

    describe('readFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should read existing file', async () => {
        const result = await vfs.readFile(testFile.path)
        expect(result.success).toBe(true)

        if (result.success) {
          expect(result.data.path).toBe(testFile.path)
          expect(result.data.content).toBe(testFile.content)
          expect(result.data.contentType).toBe(testFile.contentType)
          expect(result.data.metadata).toEqual(testFile.metadata)
          expect(result.data).not.toHaveProperty('description')
        }
      })

      it('should return error for non-existent file', async () => {
        const nonExistentPath = '/non-existent.txt'
        const result = await vfs.readFile(nonExistentPath)

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.message).toBe(
            `File not found: ${nonExistentPath}`,
          )
          expect(result.error.code).toBe(VFSErrorCode.FILE_NOT_FOUND)
          expect(result.error.path).toBe(nonExistentPath)
        }
      })
    })

    describe('deleteFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should delete existing file', async () => {
        const deleteResult = await vfs.deleteFile(testFile.path)
        expect(deleteResult.success).toBe(true)

        // Verify file was deleted
        const readResult = await vfs.readFile(testFile.path)
        expect(readResult.success).toBe(false)
        if (!readResult.success) {
          expect(readResult.error).toBeInstanceOf(VFSError)
        }
      })

      it('should handle deletion of non-existent file gracefully', async () => {
        const result = await vfs.deleteFile('/non-existent.txt')
        expect(result.success).toBe(true)
      })

      it('should delete files recursively', async () => {
        // Create multiple files with common prefix
        await vfs.writeFile({ ...testFile, path: '/folder/file1.txt' })
        await vfs.writeFile({ ...testFile, path: '/folder/file2.txt' })
        await vfs.writeFile({
          ...testFile,
          path: '/folder/subfolder/file3.txt',
        })
        await vfs.writeFile({ ...testFile, path: '/other.txt' })

        const deleteResult = await vfs.deleteFile('/folder', {
          recursive: true,
        })
        expect(deleteResult.success).toBe(true)

        // Verify recursive deletion
        const readResult1 = await vfs.readFile('/folder/file1.txt')
        expect(readResult1.success).toBe(false)

        const readResult2 = await vfs.readFile('/folder/file2.txt')
        expect(readResult2.success).toBe(false)

        const readResult3 = await vfs.readFile('/folder/subfolder/file3.txt')
        expect(readResult3.success).toBe(false)

        // Verify other files are not affected
        const otherFileResult = await vfs.readFile('/other.txt')
        expect(otherFileResult.success).toBe(true)
        if (otherFileResult.success) {
          expect(otherFileResult.data.path).toBe('/other.txt')
        }
      })
    })

    describe('listFiles', () => {
      it('should return empty array for empty storage', async () => {
        const result = await vfs.listFiles()
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data).toEqual([])
        }
      })

      it('should list all files', async () => {
        const file1: VFile = { ...testFile, path: '/file1.txt' }
        const file2: VFile = {
          ...testFile,
          path: '/file2.txt',
          content: 'Different content',
        }

        await vfs.writeFile(file1)
        await vfs.writeFile(file2)

        const result = await vfs.listFiles()
        expect(result.success).toBe(true)

        if (result.success) {
          expect(result.data).toHaveLength(2)
          expect(result.data.map((f) => f.path)).toContain('/file1.txt')
          expect(result.data.map((f) => f.path)).toContain('/file2.txt')

          const file1Info = result.data.find((f) => f.path === '/file1.txt')
          expect(file1Info).toMatchObject({
            path: '/file1.txt',
            size: file1.content.length,
            contentType: file1.contentType,
            description: file1.description,
            metadata: file1.metadata,
          })
          expect(file1Info?.lastModified).toBeInstanceOf(Date)
        }
      })
    })

    describe('moveFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should move file successfully', async () => {
        const newPath = '/moved.txt'

        const moveResult = await vfs.moveFile(testFile.path, newPath)
        expect(moveResult.success).toBe(true)

        // Verify old path doesn't exist
        const oldPathResult = await vfs.readFile(testFile.path)
        expect(oldPathResult.success).toBe(false)

        // Verify file exists at new path
        const newPathResult = await vfs.readFile(newPath)
        expect(newPathResult.success).toBe(true)
        if (newPathResult.success) {
          expect(newPathResult.data.path).toBe(newPath)
          expect(newPathResult.data.content).toBe(testFile.content)
        }
      })

      it('should reject invalid source path', async () => {
        const result = await vfs.moveFile('invalid-path', '/valid.txt')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(VFSError)
          expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        }
      })

      it('should reject invalid destination path', async () => {
        const result = await vfs.moveFile(testFile.path, 'invalid-path')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(VFSError)
          expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        }
      })

      it('should return error for non-existent source file', async () => {
        const result = await vfs.moveFile('/non-existent.txt', '/new.txt')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(VFSError)
        }
      })
    })

    describe('copyFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should copy file successfully', async () => {
        const copyPath = '/copy.txt'

        const copyResult = await vfs.copyFile(testFile.path, copyPath)
        expect(copyResult.success).toBe(true)

        // Verify original file still exists
        const originalResult = await vfs.readFile(testFile.path)
        expect(originalResult.success).toBe(true)
        if (originalResult.success) {
          expect(originalResult.data.content).toBe(testFile.content)
        }

        // Verify copy exists with same content
        const copyReadResult = await vfs.readFile(copyPath)
        expect(copyReadResult.success).toBe(true)
        if (copyReadResult.success) {
          expect(copyReadResult.data.path).toBe(copyPath)
          expect(copyReadResult.data.content).toBe(testFile.content)
          expect(copyReadResult.data.contentType).toBe(testFile.contentType)
        }
      })

      it('should reject invalid source path', async () => {
        const result = await vfs.copyFile('invalid-path', '/valid.txt')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(VFSError)
          expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        }
      })

      it('should reject invalid destination path', async () => {
        const result = await vfs.copyFile(testFile.path, 'invalid-path')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(VFSError)
          expect(result.error.code).toBe(VFSErrorCode.INVALID_PATH)
        }
      })

      it('should return error for non-existent source file', async () => {
        const result = await vfs.copyFile('/non-existent.txt', '/copy.txt')
        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error).toBeInstanceOf(VFSError)
        }
      })
    })
  })

  describe('Storage integration', () => {
    it('should work with multiple project instances', async () => {
      const storage1 = new MemoryStorage('project-1')
      const storage2 = new MemoryStorage('project-2')
      const vfs1 = new VirtualFileSystem(storage1)
      const vfs2 = new VirtualFileSystem(storage2)

      const baseFile: VFile = {
        path: '/shared.txt',
        content: 'Hello, World!',
        contentType: 'text/plain',
        description: 'Test file',
        metadata: { created: '2023-01-01' },
      }

      const file1: VFile = {
        ...baseFile,
        path: '/shared.txt',
        content: 'Project 1 content',
      }
      const file2: VFile = {
        ...baseFile,
        path: '/shared.txt',
        content: 'Project 2 content',
      }

      await vfs1.writeFile(file1)
      await vfs2.writeFile(file2)

      const readResult1 = await vfs1.readFile('/shared.txt')
      const readResult2 = await vfs2.readFile('/shared.txt')

      expect(readResult1.success).toBe(true)
      expect(readResult2.success).toBe(true)

      if (readResult1.success && readResult2.success) {
        expect(readResult1.data.content).toBe('Project 1 content')
        expect(readResult2.data.content).toBe('Project 2 content')
      }
    })

    it('should handle storage without move/copy operations', async () => {
      const limitedStorage = {
        read: () => Promise.resolve(Result.ok(null)),
        write: () => Promise.resolve(Result.ok(undefined)),
        delete: () => Promise.resolve(Result.ok(undefined)),
        list: () => Promise.resolve(Result.ok([])),
        // No moveFile or copyFile methods
      }

      const vfsLimited = new VirtualFileSystem(limitedStorage)

      const moveResult = await vfsLimited.moveFile('/from.txt', '/to.txt')
      expect(moveResult.success).toBe(false)
      if (!moveResult.success) {
        expect(moveResult.error.message).toBe('File move not supported')
        expect(moveResult.error.code).toBe(VFSErrorCode.OPERATION_FAILED)
        expect(moveResult.error.path).toBe('/from.txt')
      }

      const copyResult = await vfsLimited.copyFile('/from.txt', '/to.txt')
      expect(copyResult.success).toBe(false)
      if (!copyResult.success) {
        expect(copyResult.error.message).toBe('File copy not supported')
        expect(copyResult.error.code).toBe(VFSErrorCode.OPERATION_FAILED)
        expect(copyResult.error.path).toBe('/from.txt')
      }
    })
  })
})
