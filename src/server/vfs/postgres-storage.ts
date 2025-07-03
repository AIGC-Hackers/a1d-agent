import { and, eq } from 'drizzle-orm'

import { db, t } from '../db'
import { type FileInfo, type Storage, type VFile } from './types'

export class PostgresStorage implements Storage {
  constructor(private readonly projectId: string) {}

  async read(path: string): Promise<VFile | null> {
    const result = await db.value.query.vfs.findFirst({
      where: and(eq(t.vfs.path, path), eq(t.vfs.project_id, this.projectId)),
    })

    if (!result) {
      return null
    }

    return {
      path: result.path,
      description: result.description,
      contentType: result.content_type,
      content: result.content,
    }
  }

  async write(file: VFile): Promise<void> {
    await db.value
      .insert(t.vfs)
      .values({
        path: file.path,
        description: file.description,
        content_type: file.contentType,
        content: file.content,
        project_id: this.projectId,
      })
      .onConflictDoUpdate({
        target: t.vfs.path,
        set: {
          description: file.description,
          content_type: file.contentType,
          content: file.content,
          updated_at: new Date(),
        },
      })
  }

  async delete(path: string): Promise<void> {
    await db.value
      .delete(t.vfs)
      .where(and(eq(t.vfs.path, path), eq(t.vfs.project_id, this.projectId)))
  }

  async list(): Promise<FileInfo[]> {
    const results = await db.value.query.vfs.findMany({
      where: eq(t.vfs.project_id, this.projectId),
      columns: {
        path: true,
        description: true,
      },
    })

    return results
  }
}
