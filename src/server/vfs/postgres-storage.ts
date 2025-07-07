import { Result } from '@/lib/result'
import { and, eq, like, or } from 'drizzle-orm'

import type { FileInfo, Storage, VFile } from './types'
import { db, t } from '../db'
import { VFSError, VFSErrorCode } from './types'

export class PostgresStorage implements Storage {
  constructor(private readonly projectId: string) {}

  async read(path: string): Promise<Result<VFile | null, VFSError>> {
    try {
      const result = await db.value.query.vfs.findFirst({
        where: and(eq(t.vfs.path, path), eq(t.vfs.project_id, this.projectId)),
      })

      if (!result) {
        return Result.ok(null)
      }

      return Result.ok({
        path: result.path,
        description: result.description ?? undefined,
        contentType: result.content_type ?? undefined,
        content: result.content,
      })
    } catch (error) {
      return Result.err(
        new VFSError(
          `Error reading file: ${path}`,
          VFSErrorCode.OPERATION_FAILED,
          path,
          error instanceof Error ? error : new Error(String(error)),
        ),
      )
    }
  }

  async write(file: VFile): Promise<Result<void, VFSError>> {
    try {
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
          target: [t.vfs.path, t.vfs.project_id],
          set: {
            description: file.description,
            content_type: file.contentType,
            content: file.content,
            updated_at: new Date(),
          },
        })

      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new VFSError(
          `Error writing file: ${file.path}`,
          VFSErrorCode.OPERATION_FAILED,
          file.path,
          error instanceof Error ? error : new Error(String(error)),
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
          .where(
            and(eq(t.vfs.path, path), eq(t.vfs.project_id, this.projectId)),
          )
      }

      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new VFSError(
          `Error deleting file: ${path}`,
          VFSErrorCode.OPERATION_FAILED,
          path,
          error instanceof Error ? error : new Error(String(error)),
        ),
      )
    }
  }

  async list(): Promise<Result<FileInfo[], VFSError>> {
    try {
      const results = await db.value.query.vfs.findMany({
        where: eq(t.vfs.project_id, this.projectId),
        columns: {
          path: true,
          description: true,
          content: true,
          content_type: true,
          updated_at: true,
        },
      })

      return Result.ok(
        results.map((result) => ({
          path: result.path,
          size: result.content.length,
          lastModified: result.updated_at || new Date(),
          contentType: result.content_type ?? undefined,
          description: result.description ?? undefined,
        })),
      )
    } catch (error) {
      return Result.err(
        new VFSError(
          `Error listing files`,
          VFSErrorCode.OPERATION_FAILED,
          undefined,
          error instanceof Error ? error : new Error(String(error)),
        ),
      )
    }
  }

  async moveFile(
    fromPath: string,
    toPath: string,
  ): Promise<Result<void, VFSError>> {
    try {
      // Check if source file exists
      const sourceFile = await db.value
        .select()
        .from(t.vfs)
        .where(
          and(eq(t.vfs.path, fromPath), eq(t.vfs.project_id, this.projectId)),
        )
        .limit(1)

      if (sourceFile.length === 0) {
        return Result.err(
          new VFSError(
            `Source file not found: ${fromPath}`,
            VFSErrorCode.FILE_NOT_FOUND,
            fromPath,
          ),
        )
      }

      // Check if destination path is already taken
      const destinationExists = await db.value
        .select()
        .from(t.vfs)
        .where(
          and(eq(t.vfs.path, toPath), eq(t.vfs.project_id, this.projectId)),
        )
        .limit(1)

      if (destinationExists.length > 0) {
        return Result.err(
          new VFSError(
            `Destination path already exists: ${toPath}`,
            VFSErrorCode.OPERATION_FAILED,
            toPath,
          ),
        )
      }

      // Perform the update
      await db.value
        .update(t.vfs)
        .set({
          path: toPath,
          updated_at: new Date(),
        })
        .where(
          and(eq(t.vfs.path, fromPath), eq(t.vfs.project_id, this.projectId)),
        )
        .execute()

      // Verify the move was successful by checking if the file exists at the new path
      const movedFile = await db.value
        .select()
        .from(t.vfs)
        .where(
          and(eq(t.vfs.path, toPath), eq(t.vfs.project_id, this.projectId)),
        )
        .limit(1)

      if (movedFile.length === 0) {
        return Result.err(
          new VFSError(
            `Failed to move file from ${fromPath} to ${toPath}`,
            VFSErrorCode.OPERATION_FAILED,
            fromPath,
          ),
        )
      }

      return Result.ok(undefined)
    } catch (error) {
      return Result.err(
        new VFSError(
          `Error moving file from ${fromPath} to ${toPath}`,
          VFSErrorCode.OPERATION_FAILED,
          fromPath,
          error instanceof Error ? error : new Error(String(error)),
        ),
      )
    }
  }

  async copyFile(
    fromPath: string,
    toPath: string,
  ): Promise<Result<void, VFSError>> {
    try {
      const readResult = await this.read(fromPath)
      if (!readResult.success) {
        return readResult
      }

      if (!readResult.data) {
        return Result.err(
          new VFSError(
            `Source file not found: ${fromPath}`,
            VFSErrorCode.FILE_NOT_FOUND,
            fromPath,
          ),
        )
      }

      const writeResult = await this.write({
        ...readResult.data,
        path: toPath,
      })

      return writeResult
    } catch (error) {
      return Result.err(
        new VFSError(
          `Error copying file from ${fromPath} to ${toPath}`,
          VFSErrorCode.OPERATION_FAILED,
          fromPath,
          error instanceof Error ? error : new Error(String(error)),
        ),
      )
    }
  }
}
