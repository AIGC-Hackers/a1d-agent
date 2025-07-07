import { Result } from '@/lib/result'

import type { FileInfo, Storage, VFile } from './types'
import { VFSError, VFSErrorCode } from './types'

export class MemoryStorage implements Storage {
  private static readonly projects = new Map<string, Map<string, VFile>>()

  constructor(private readonly projectId: string) {}

  async read(path: string): Promise<Result<VFile | null, VFSError>> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    return Result.ok(projectFiles?.get(path) || null)
  }

  async write(file: VFile): Promise<Result<void, VFSError>> {
    let projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      projectFiles = new Map<string, VFile>()
      MemoryStorage.projects.set(this.projectId, projectFiles)
    }
    projectFiles.set(file.path, { ...file })
    return Result.ok(undefined)
  }

  async delete(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<Result<void, VFSError>> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      return Result.ok(undefined)
    }

    if (options?.recursive) {
      const pathsToDelete: string[] = []
      const normalizedPath = path.endsWith('/') ? path : path + '/'

      for (const filePath of projectFiles.keys()) {
        if (filePath === path || filePath.startsWith(normalizedPath)) {
          pathsToDelete.push(filePath)
        }
      }

      for (const pathToDelete of pathsToDelete) {
        projectFiles.delete(pathToDelete)
      }
    } else {
      projectFiles.delete(path)
    }
    return Result.ok(undefined)
  }

  async list(): Promise<Result<FileInfo[], VFSError>> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      return Result.ok([])
    }

    const results: FileInfo[] = []
    for (const file of projectFiles.values()) {
      results.push({
        path: file.path,
        size: file.content.length,
        lastModified: new Date(),
        contentType: file.contentType,
        description: file.description,
        metadata: file.metadata,
      })
    }
    return Result.ok(results)
  }

  async moveFile(
    fromPath: string,
    toPath: string,
  ): Promise<Result<void, VFSError>> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      return Result.err(
        new VFSError(
          'Project not found',
          VFSErrorCode.OPERATION_FAILED,
          fromPath,
        ),
      )
    }

    const file = projectFiles.get(fromPath)
    if (!file) {
      return Result.err(
        new VFSError('File not found', VFSErrorCode.FILE_NOT_FOUND, fromPath),
      )
    }

    projectFiles.delete(fromPath)
    projectFiles.set(toPath, { ...file, path: toPath })
    return Result.ok(undefined)
  }

  async copyFile(
    fromPath: string,
    toPath: string,
  ): Promise<Result<void, VFSError>> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      return Result.err(
        new VFSError(
          'Project not found',
          VFSErrorCode.OPERATION_FAILED,
          fromPath,
        ),
      )
    }

    const file = projectFiles.get(fromPath)
    if (!file) {
      return Result.err(
        new VFSError('File not found', VFSErrorCode.FILE_NOT_FOUND, fromPath),
      )
    }

    projectFiles.set(toPath, { ...file, path: toPath })
    return Result.ok(undefined)
  }

  clear(): void {
    MemoryStorage.projects.delete(this.projectId)
  }

  static clearAll(): void {
    MemoryStorage.projects.clear()
  }
}
