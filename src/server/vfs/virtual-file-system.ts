import { omit } from 'lodash-es'

import type { FileInfo, Storage, VFile } from './types'
import { VFSError, VFSErrorCode } from './types'

export class VirtualFileSystem {
  constructor(private storage: Storage) {}

  private validatePath(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new VFSError('Path is required', VFSErrorCode.INVALID_PATH, path)
    }

    if (!path.startsWith('/')) {
      throw new VFSError(
        'Path must be absolute',
        VFSErrorCode.INVALID_PATH,
        path,
      )
    }

    if (path.length > 1000) {
      throw new VFSError('Path too long', VFSErrorCode.INVALID_PATH, path)
    }
  }

  async readFile(path: string): Promise<Omit<VFile, 'description'>> {
    this.validatePath(path)

    try {
      const file = await this.storage.read(path)
      if (file === null) {
        throw new VFSError(
          `File not found: ${path}`,
          VFSErrorCode.FILE_NOT_FOUND,
          path,
        )
      }
      return omit(file, ['description'])
    } catch (error) {
      if (error instanceof VFSError) throw error
      throw new VFSError(
        'Failed to read file',
        VFSErrorCode.OPERATION_FAILED,
        path,
        error as Error,
      )
    }
  }

  async writeFile(file: VFile): Promise<void> {
    this.validatePath(file.path)

    try {
      await this.storage.write(file)
    } catch (error) {
      throw new VFSError(
        'Failed to write file',
        VFSErrorCode.OPERATION_FAILED,
        file.path,
        error as Error,
      )
    }
  }

  async deleteFile(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    this.validatePath(path)

    try {
      await this.storage.delete(path, options)
    } catch (error) {
      throw new VFSError(
        'Failed to delete file',
        VFSErrorCode.OPERATION_FAILED,
        path,
        error as Error,
      )
    }
  }

  async listFiles(): Promise<FileInfo[]> {
    try {
      return await this.storage.list()
    } catch (error) {
      throw new VFSError(
        'Failed to list files',
        VFSErrorCode.OPERATION_FAILED,
        undefined,
        error as Error,
      )
    }
  }

  async moveFile(fromPath: string, toPath: string): Promise<void> {
    this.validatePath(fromPath)
    this.validatePath(toPath)

    if (!this.storage.moveFile) {
      throw new VFSError(
        'File move not supported',
        VFSErrorCode.OPERATION_FAILED,
        fromPath,
      )
    }

    try {
      await this.storage.moveFile(fromPath, toPath)
    } catch (error) {
      throw new VFSError(
        'Failed to move file',
        VFSErrorCode.OPERATION_FAILED,
        fromPath,
        error as Error,
      )
    }
  }

  async copyFile(fromPath: string, toPath: string): Promise<void> {
    this.validatePath(fromPath)
    this.validatePath(toPath)

    if (!this.storage.copyFile) {
      throw new VFSError(
        'File copy not supported',
        VFSErrorCode.OPERATION_FAILED,
        fromPath,
      )
    }

    try {
      await this.storage.copyFile(fromPath, toPath)
    } catch (error) {
      throw new VFSError(
        'Failed to copy file',
        VFSErrorCode.OPERATION_FAILED,
        fromPath,
        error as Error,
      )
    }
  }
}
