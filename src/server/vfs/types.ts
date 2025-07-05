export type FileInfo = {
  path: string
  description?: string
  metadata?: Record<string, unknown>
}

export type FileListItem = {
  path: string
  description?: string
  metadata?: Record<string, unknown>
}

export type VFile = FileInfo & {
  contentType?: string
  content: string
}

export type Storage = {
  read(path: string): Promise<VFile | null>
  write(file: VFile): Promise<void>
  delete(path: string, options?: { recursive?: boolean }): Promise<void>
  list(): Promise<FileInfo[]>
}
