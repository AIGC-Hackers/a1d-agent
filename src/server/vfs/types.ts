import { Result } from '@/lib/result'

export class VFSError extends Error {
  constructor(
    message: string,
    public code: string,
    public path?: string,
    public cause?: Error,
  ) {
    super(message)
    this.name = 'VFSError'
  }
}

export enum VFSErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  INVALID_PATH = 'INVALID_PATH',
  OPERATION_FAILED = 'OPERATION_FAILED',
}

export interface FileInfo {
  path: string
  size: number
  lastModified: Date
  contentType?: string
  description?: string
  metadata?: Record<string, unknown>
}

export type VFile = {
  path: string
  content: string
  contentType?: string
  description?: string
  metadata?: Record<string, unknown>
}

export type Storage = {
  read(path: string): Promise<Result<VFile | null, VFSError>>
  write(file: VFile): Promise<Result<void, VFSError>>
  delete(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<Result<void, VFSError>>
  list(): Promise<Result<FileInfo[], VFSError>>
  moveFile?(fromPath: string, toPath: string): Promise<Result<void, VFSError>>
  copyFile?(fromPath: string, toPath: string): Promise<Result<void, VFSError>>
}
