import { omit } from 'lodash-es'

import { type FileInfo, type Storage, type VFile } from './types'

export class VirtualFileSystem {
  constructor(private storage: Storage) {}

  async readFile(path: string): Promise<Omit<VFile, 'description'>> {
    const file = await this.storage.read(path)
    if (file === null) {
      return {
        path,
        contentType: 'text/plain',
        content: `Error: File not found: ${path}`,
      }
    }
    return omit(file, 'description')
  }

  async writeFile(file: VFile): Promise<void> {
    await this.storage.write(file)
  }

  async deleteFile(
    path: string,
    options?: { recursive?: boolean },
  ): Promise<void> {
    await this.storage.delete(path, options)
  }

  async listFiles(): Promise<FileInfo[]> {
    return await this.storage.list()
  }
}
