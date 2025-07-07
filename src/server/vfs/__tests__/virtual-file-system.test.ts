import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VirtualFileSystem } from '../virtual-file-system'
import { MemoryStorage } from '../memory-storage'
import { VFSError, VFSErrorCode } from '../types'
import type { VFile } from '../types'

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
      await expect(vfs.readFile('')).rejects.toThrow(
        new VFSError('Path is required', VFSErrorCode.INVALID_PATH, '')
      )
    })

    it('should reject non-string path', async () => {
      // @ts-expect-error Testing invalid input
      await expect(vfs.readFile(null)).rejects.toThrow(
        new VFSError('Path is required', VFSErrorCode.INVALID_PATH, null)
      )
    })

    it('should reject relative path', async () => {
      const relativePath = 'relative/path.txt'
      await expect(vfs.readFile(relativePath)).rejects.toThrow(
        new VFSError('Path must be absolute', VFSErrorCode.INVALID_PATH, relativePath)
      )
    })

    it('should reject path that is too long', async () => {
      const longPath = '/' + 'a'.repeat(1000)
      await expect(vfs.readFile(longPath)).rejects.toThrow(
        new VFSError('Path too long', VFSErrorCode.INVALID_PATH, longPath)
      )
    })

    it('should accept valid absolute path', async () => {
      const validPath = '/valid/path.txt'
      // Should not throw during path validation, but will throw FILE_NOT_FOUND
      await expect(vfs.readFile(validPath)).rejects.toThrow(
        new VFSError(`File not found: ${validPath}`, VFSErrorCode.FILE_NOT_FOUND, validPath)
      )
    })
  })

  describe('File operations', () => {
    const testFile: VFile = {
      path: '/test.txt',
      content: 'Hello, World!',
      contentType: 'text/plain',
      description: 'Test file',
      metadata: { created: '2023-01-01' }
    }

    describe('writeFile', () => {
      it('should write a file successfully', async () => {
        await expect(vfs.writeFile(testFile)).resolves.toBeUndefined()
        
        // Verify file was written
        const readFile = await vfs.readFile(testFile.path)
        expect(readFile.path).toBe(testFile.path)
        expect(readFile.content).toBe(testFile.content)
        expect(readFile.contentType).toBe(testFile.contentType)
        expect(readFile.metadata).toEqual(testFile.metadata)
        expect(readFile).not.toHaveProperty('description')
      })

      it('should overwrite existing file', async () => {
        await vfs.writeFile(testFile)
        
        const updatedFile: VFile = {
          ...testFile,
          content: 'Updated content'
        }
        
        await vfs.writeFile(updatedFile)
        
        const readFile = await vfs.readFile(testFile.path)
        expect(readFile.content).toBe('Updated content')
      })

      it('should reject invalid path', async () => {
        const invalidFile: VFile = {
          ...testFile,
          path: 'invalid-path'
        }
        
        await expect(vfs.writeFile(invalidFile)).rejects.toThrow(VFSError)
      })
    })

    describe('readFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should read existing file', async () => {
        const readFile = await vfs.readFile(testFile.path)
        
        expect(readFile.path).toBe(testFile.path)
        expect(readFile.content).toBe(testFile.content)
        expect(readFile.contentType).toBe(testFile.contentType)
        expect(readFile.metadata).toEqual(testFile.metadata)
        expect(readFile).not.toHaveProperty('description')
      })

      it('should throw error for non-existent file', async () => {
        const nonExistentPath = '/non-existent.txt'
        
        await expect(vfs.readFile(nonExistentPath)).rejects.toThrow(
          new VFSError(`File not found: ${nonExistentPath}`, VFSErrorCode.FILE_NOT_FOUND, nonExistentPath)
        )
      })
    })

    describe('deleteFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should delete existing file', async () => {
        await expect(vfs.deleteFile(testFile.path)).resolves.toBeUndefined()
        
        // Verify file was deleted
        await expect(vfs.readFile(testFile.path)).rejects.toThrow(VFSError)
      })

      it('should handle deletion of non-existent file gracefully', async () => {
        await expect(vfs.deleteFile('/non-existent.txt')).resolves.toBeUndefined()
      })

      it('should delete files recursively', async () => {
        // Create multiple files with common prefix
        await vfs.writeFile({ ...testFile, path: '/folder/file1.txt' })
        await vfs.writeFile({ ...testFile, path: '/folder/file2.txt' })
        await vfs.writeFile({ ...testFile, path: '/folder/subfolder/file3.txt' })
        await vfs.writeFile({ ...testFile, path: '/other.txt' })
        
        await vfs.deleteFile('/folder', { recursive: true })
        
        // Verify recursive deletion
        await expect(vfs.readFile('/folder/file1.txt')).rejects.toThrow(VFSError)
        await expect(vfs.readFile('/folder/file2.txt')).rejects.toThrow(VFSError)
        await expect(vfs.readFile('/folder/subfolder/file3.txt')).rejects.toThrow(VFSError)
        
        // Verify other files are not affected
        const otherFile = await vfs.readFile('/other.txt')
        expect(otherFile.path).toBe('/other.txt')
      })
    })

    describe('listFiles', () => {
      it('should return empty array for empty storage', async () => {
        const files = await vfs.listFiles()
        expect(files).toEqual([])
      })

      it('should list all files', async () => {
        const file1: VFile = { ...testFile, path: '/file1.txt' }
        const file2: VFile = { ...testFile, path: '/file2.txt', content: 'Different content' }
        
        await vfs.writeFile(file1)
        await vfs.writeFile(file2)
        
        const files = await vfs.listFiles()
        
        expect(files).toHaveLength(2)
        expect(files.map(f => f.path)).toContain('/file1.txt')
        expect(files.map(f => f.path)).toContain('/file2.txt')
        
        const file1Info = files.find(f => f.path === '/file1.txt')
        expect(file1Info).toMatchObject({
          path: '/file1.txt',
          size: file1.content.length,
          contentType: file1.contentType,
          description: file1.description,
          metadata: file1.metadata
        })
        expect(file1Info?.lastModified).toBeInstanceOf(Date)
      })
    })

    describe('moveFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should move file successfully', async () => {
        const newPath = '/moved.txt'
        
        await vfs.moveFile(testFile.path, newPath)
        
        // Verify old path doesn't exist
        await expect(vfs.readFile(testFile.path)).rejects.toThrow(VFSError)
        
        // Verify file exists at new path
        const movedFile = await vfs.readFile(newPath)
        expect(movedFile.path).toBe(newPath)
        expect(movedFile.content).toBe(testFile.content)
      })

      it('should reject invalid source path', async () => {
        await expect(vfs.moveFile('invalid-path', '/valid.txt')).rejects.toThrow(VFSError)
      })

      it('should reject invalid destination path', async () => {
        await expect(vfs.moveFile(testFile.path, 'invalid-path')).rejects.toThrow(VFSError)
      })

      it('should throw error for non-existent source file', async () => {
        await expect(vfs.moveFile('/non-existent.txt', '/new.txt')).rejects.toThrow(VFSError)
      })
    })

    describe('copyFile', () => {
      beforeEach(async () => {
        await vfs.writeFile(testFile)
      })

      it('should copy file successfully', async () => {
        const copyPath = '/copy.txt'
        
        await vfs.copyFile(testFile.path, copyPath)
        
        // Verify original file still exists
        const originalFile = await vfs.readFile(testFile.path)
        expect(originalFile.content).toBe(testFile.content)
        
        // Verify copy exists with same content
        const copiedFile = await vfs.readFile(copyPath)
        expect(copiedFile.path).toBe(copyPath)
        expect(copiedFile.content).toBe(testFile.content)
        expect(copiedFile.contentType).toBe(testFile.contentType)
      })

      it('should reject invalid source path', async () => {
        await expect(vfs.copyFile('invalid-path', '/valid.txt')).rejects.toThrow(VFSError)
      })

      it('should reject invalid destination path', async () => {
        await expect(vfs.copyFile(testFile.path, 'invalid-path')).rejects.toThrow(VFSError)
      })

      it('should throw error for non-existent source file', async () => {
        await expect(vfs.copyFile('/non-existent.txt', '/copy.txt')).rejects.toThrow(VFSError)
      })
    })
  })

  describe('Error handling', () => {
    it('should preserve VFSError when thrown by storage', async () => {
      const errorPath = '/error.txt'
      const customError = new VFSError('Custom error', VFSErrorCode.FILE_NOT_FOUND, errorPath)
      
      // Mock storage to throw VFSError
      const mockStorage = {
        read: () => { throw customError },
        write: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        list: () => Promise.resolve([]),
        moveFile: () => Promise.resolve(),
        copyFile: () => Promise.resolve()
      }
      
      const vfsWithMockStorage = new VirtualFileSystem(mockStorage)
      
      await expect(vfsWithMockStorage.readFile(errorPath)).rejects.toThrow(customError)
    })

    it('should wrap generic errors in VFSError', async () => {
      const errorPath = '/error.txt'
      const genericError = new Error('Generic storage error')
      
      // Mock storage to throw generic error
      const mockStorage = {
        read: () => { throw genericError },
        write: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        list: () => Promise.resolve([]),
        moveFile: () => Promise.resolve(),
        copyFile: () => Promise.resolve()
      }
      
      const vfsWithMockStorage = new VirtualFileSystem(mockStorage)
      
      await expect(vfsWithMockStorage.readFile(errorPath)).rejects.toThrow(
        new VFSError('Failed to read file', VFSErrorCode.OPERATION_FAILED, errorPath, genericError)
      )
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
        metadata: { created: '2023-01-01' }
      }
      
      const file1: VFile = { ...baseFile, path: '/shared.txt', content: 'Project 1 content' }
      const file2: VFile = { ...baseFile, path: '/shared.txt', content: 'Project 2 content' }
      
      await vfs1.writeFile(file1)
      await vfs2.writeFile(file2)
      
      const readFile1 = await vfs1.readFile('/shared.txt')
      const readFile2 = await vfs2.readFile('/shared.txt')
      
      expect(readFile1.content).toBe('Project 1 content')
      expect(readFile2.content).toBe('Project 2 content')
    })

    it('should handle storage without move/copy operations', async () => {
      const limitedStorage = {
        read: () => Promise.resolve(null),
        write: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        list: () => Promise.resolve([])
        // No moveFile or copyFile methods
      }
      
      const vfsLimited = new VirtualFileSystem(limitedStorage)
      
      await expect(vfsLimited.moveFile('/from.txt', '/to.txt')).rejects.toThrow(
        new VFSError('File move not supported', VFSErrorCode.OPERATION_FAILED, '/from.txt')
      )
      
      await expect(vfsLimited.copyFile('/from.txt', '/to.txt')).rejects.toThrow(
        new VFSError('File copy not supported', VFSErrorCode.OPERATION_FAILED, '/from.txt')
      )
    })
  })
})