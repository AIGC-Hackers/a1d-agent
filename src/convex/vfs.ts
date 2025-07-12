import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

// 读取文件
export const readFile = query({
  args: {
    threadId: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query('file')
      .withIndex('by_path_and_thread', (q) =>
        q.eq('threadId', args.threadId).eq('path', args.path),
      )
      .first()

    if (!file) {
      return null
    }

    return file
  },
})

// 写入文件（目前只支持小文件直接存储）
export const writeFile = mutation({
  args: {
    threadId: v.string(),
    path: v.string(),
    content: v.string(),
    contentType: v.optional(v.string()),
    description: v.optional(v.string()),
    metadata: v.optional(v.any()),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const { threadId, path, content, size, ...rest } = args

    // 检查是否已存在
    const existing = await ctx.db
      .query('file')
      .withIndex('by_path_and_thread', (q) =>
        q.eq('threadId', threadId).eq('path', path),
      )
      .first()

    const fileData = {
      path,
      threadId,
      content,
      size,
      lastModified: Date.now(),
      ...rest,
    }

    if (existing) {
      await ctx.db.patch(existing._id, fileData)
      return existing._id
    } else {
      return await ctx.db.insert('file', fileData)
    }
  },
})

// 删除文件
export const deleteFile = mutation({
  args: {
    threadId: v.string(),
    path: v.string(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query('file')
      .withIndex('by_path_and_thread', (q) =>
        q.eq('threadId', args.threadId).eq('path', args.path),
      )
      .first()

    if (!file) {
      return false
    }

    await ctx.db.delete(file._id)
    return true
  },
})

// 列出目录下的文件
export const listFiles = query({
  args: {
    threadId: v.string(),
    prefix: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('file')
      .withIndex('by_thread', (q) => q.eq('threadId', args.threadId))

    const files = await query.collect()

    // 如果指定了前缀，过滤结果
    if (args.prefix) {
      return files.filter((file) => file.path.startsWith(args.prefix!))
    }

    return files
  },
})
