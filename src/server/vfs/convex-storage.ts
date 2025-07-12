import { Result } from '@/lib/result'
import { ConvexClient } from 'convex/browser'

import { api } from '../../convex/_generated/api'
import { FileInfo, Storage, VFile, VFSError, VFSErrorCode } from './types'

export class ConvexStorage implements Storage {
  private client: ConvexClient
  private threadId: string

  constructor(convexUrl: string, threadId: string) {
    this.client = new ConvexClient(convexUrl)
    this.threadId = threadId
  }

  async read(path: string): Promise<Result<VFile | null, VFSError>> {
    try {
      const file = await this.client.query(api.vfs.readFile, {
        threadId: this.threadId,
        path,
      })

      if (!file) {
        return Result.ok(null)
      }

      return Result.ok({
        path: file.path,
        content: file.content,
        contentType: file.contentType,
        description: file.description,
        metadata: file.metadata,
      })
    } catch (error) {
      return Result.err(
        new VFSError(
          `Failed to read file: ${error}`,
          VFSErrorCode.OPERATION_FAILED,
          path,
          error as Error,
        ),
      )
    }
  }

  async write(file: VFile): Promise<Result<void, VFSError>> {
    try {
      const size = new TextEncoder().encode(file.content).length

      await this.client.mutation(api.vfs.writeFile, {
        threadId: this.threadId,
        path: file.path,
        content: file.content,
        contentType: file.contentType,
        description: file.description,
        metadata: file.metadata,
        size,
      })

      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new VFSError(
          `Failed to write file: ${error}`,
          VFSErrorCode.OPERATION_FAILED,
          file.path,
          error as Error,
        ),
      )
    }
  }

  async delete(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<Result<void, VFSError>> {
    try {
      if (options?.recursive) {
        // 递归删除：先获取所有子文件
        const files = await this.client.query(api.vfs.listFiles, {
          threadId: this.threadId,
          prefix: path,
        })

        // 删除所有匹配的文件
        for (const file of files) {
          await this.client.mutation(api.vfs.deleteFile, {
            threadId: this.threadId,
            path: file.path,
          })
        }
      } else {
        // 单文件删除
        const deleted = await this.client.mutation(api.vfs.deleteFile, {
          threadId: this.threadId,
          path,
        })

        if (!deleted) {
          return Result.err(
            new VFSError('File not found', VFSErrorCode.FILE_NOT_FOUND, path),
          )
        }
      }

      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new VFSError(
          `Failed to delete file: ${error}`,
          VFSErrorCode.OPERATION_FAILED,
          path,
          error as Error,
        ),
      )
    }
  }

  async list(): Promise<Result<FileInfo[], VFSError>> {
    try {
      const files = await this.client.query(api.vfs.listFiles, {
        threadId: this.threadId,
      })

      const fileInfos: FileInfo[] = files.map((file) => ({
        path: file.path,
        size: file.size,
        lastModified: new Date(file.lastModified),
        contentType: file.contentType,
        description: file.description,
        metadata: file.metadata,
      }))

      return Result.ok(fileInfos)
    } catch (error) {
      return Result.err(
        new VFSError(
          `Failed to list files: ${error}`,
          VFSErrorCode.OPERATION_FAILED,
          undefined,
          error as Error,
        ),
      )
    }
  }

  async moveFile(
    fromPath: string,
    toPath: string,
  ): Promise<Result<void, VFSError>> {
    try {
      // 1. 读取原文件
      const readResult = await this.read(fromPath)
      if (!readResult.success) {
        return readResult as Result<void, VFSError>
      }

      const file = readResult.data
      if (!file) {
        return Result.err(
          new VFSError(
            'Source file not found',
            VFSErrorCode.FILE_NOT_FOUND,
            fromPath,
          ),
        )
      }

      // 2. 写入新位置
      const writeResult = await this.write({
        ...file,
        path: toPath,
      })
      if (!writeResult.success) {
        return writeResult
      }

      // 3. 删除原文件
      return await this.delete(fromPath)
    } catch (error) {
      return Result.err(
        new VFSError(
          `Failed to move file: ${error}`,
          VFSErrorCode.OPERATION_FAILED,
          fromPath,
          error as Error,
        ),
      )
    }
  }

  async copyFile(
    fromPath: string,
    toPath: string,
  ): Promise<Result<void, VFSError>> {
    try {
      // 1. 读取原文件
      const readResult = await this.read(fromPath)
      if (!readResult.success) {
        return readResult as Result<void, VFSError>
      }

      const file = readResult.data
      if (!file) {
        return Result.err(
          new VFSError(
            'Source file not found',
            VFSErrorCode.FILE_NOT_FOUND,
            fromPath,
          ),
        )
      }

      // 2. 写入新位置
      return await this.write({
        ...file,
        path: toPath,
      })
    } catch (error) {
      return Result.err(
        new VFSError(
          `Failed to copy file: ${error}`,
          VFSErrorCode.OPERATION_FAILED,
          fromPath,
          error as Error,
        ),
      )
    }
  }
}
