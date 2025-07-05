import { type FileInfo, type Storage, type VFile } from './types'

export class MemoryStorage implements Storage {
  private static readonly projects = new Map<string, Map<string, VFile>>()

  constructor(private readonly projectId: string) {}

  async read(path: string): Promise<VFile | null> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    return projectFiles?.get(path) || null
  }

  async write(file: VFile): Promise<void> {
    let projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      projectFiles = new Map<string, VFile>()
      MemoryStorage.projects.set(this.projectId, projectFiles)
    }
    projectFiles.set(file.path, { ...file })
  }

  async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      return
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
  }

  async list(): Promise<FileInfo[]> {
    const projectFiles = MemoryStorage.projects.get(this.projectId)
    if (!projectFiles) {
      return []
    }

    const results: FileInfo[] = []
    for (const file of projectFiles.values()) {
      results.push({
        path: file.path,
        description: file.description,
      })
    }
    return results
  }

  clear(): void {
    MemoryStorage.projects.delete(this.projectId)
  }

  static clearAll(): void {
    MemoryStorage.projects.clear()
  }
}
