import { omit } from 'lodash-es'

import { Result } from '@/lib/result';
import type { FileInfo, Storage, VFile } from './types';
import { VFSError, VFSErrorCode } from './types';

export class VirtualFileSystem {
  constructor(private storage: Storage) {}

  private validatePath(path: string): Result<void, VFSError> {
    if (!path || typeof path !== 'string') {
      return Result.err(new VFSError('Path is required', VFSErrorCode.INVALID_PATH, path))
    }

    if (!path.startsWith('/')) {
      return Result.err(new VFSError(
        'Path must be absolute',
        VFSErrorCode.INVALID_PATH,
        path,
      ))
    }

    if (path.length > 1000) {
      return Result.err(new VFSError('Path too long', VFSErrorCode.INVALID_PATH, path))
    }

    return Result.ok(undefined)
  }

  async readFile(path: string): Promise<Result<Omit<VFile, 'description'>, VFSError>> {
    const pathValidation = this.validatePath(path)
    if (!pathValidation.success) {
      return pathValidation
    }

    const result = await this.storage.read(path)
    if (!result.success) {
      return result
    }

    if (result.data === null) {
      return Result.err(new VFSError(
        `File not found: ${path}`,
        VFSErrorCode.FILE_NOT_FOUND,
        path,
      ))
    }

    return Result.ok(omit(result.data, ['description']))
  }

  async writeFile(file: VFile): Promise<Result<void, VFSError>> {
    const pathValidation = this.validatePath(file.path)
    if (!pathValidation.success) {
      return pathValidation
    }

    return await this.storage.write(file)
  }

  async deleteFile(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<Result<void, VFSError>> {
    const pathValidation = this.validatePath(path)
    if (!pathValidation.success) {
      return pathValidation
    }

    return await this.storage.delete(path, options)
  }

  async listFiles(): Promise<Result<FileInfo[], VFSError>> {
    return await this.storage.list()
  }

  async moveFile(fromPath: string, toPath: string): Promise<Result<void, VFSError>> {
    const fromPathValidation = this.validatePath(fromPath)
    if (!fromPathValidation.success) {
      return fromPathValidation
    }

    const toPathValidation = this.validatePath(toPath)
    if (!toPathValidation.success) {
      return toPathValidation
    }

    if (!this.storage.moveFile) {
      return Result.err(new VFSError(
        'File move not supported',
        VFSErrorCode.OPERATION_FAILED,
        fromPath,
      ))
    }

    return await this.storage.moveFile(fromPath, toPath)
  }

  async copyFile(fromPath: string, toPath: string): Promise<Result<void, VFSError>> {
    const fromPathValidation = this.validatePath(fromPath)
    if (!fromPathValidation.success) {
      return fromPathValidation
    }

    const toPathValidation = this.validatePath(toPath)
    if (!toPathValidation.success) {
      return toPathValidation
    }

    if (!this.storage.copyFile) {
      return Result.err(new VFSError(
        'File copy not supported',
        VFSErrorCode.OPERATION_FAILED,
        fromPath,
      ))
    }

    return await this.storage.copyFile(fromPath, toPath)
  }
}
