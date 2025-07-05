import { and, eq, like, or } from 'drizzle-orm'

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
      description: result.description ?? undefined,
      contentType: result.content_type ?? undefined,
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

  async delete(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (options?.recursive) {
      const normalizedPath = path.endsWith('/') ? path : path + '/'
      await db.value
        .delete(t.vfs)
        .where(
          and(
            eq(t.vfs.project_id, this.projectId),
            or(eq(t.vfs.path, path), like(t.vfs.path, `${normalizedPath}%`)),
          ),
        )
    } else {
      await db.value
        .delete(t.vfs)
        .where(and(eq(t.vfs.path, path), eq(t.vfs.project_id, this.projectId)))
    }
  }

  async list(): Promise<FileInfo[]> {
    const results = await db.value.query.vfs.findMany({
      where: eq(t.vfs.project_id, this.projectId),
      columns: {
        path: true,
        description: true,
      },
    })

    return results.map((result) => ({
      path: result.path,
      description: result.description ?? undefined,
    }))
  }
}
