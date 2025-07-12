// 建议的 Convex action 实现
// 将此文件内容复制到 src/convex/r2Upload.ts

import { v } from 'convex/values'

import { components } from '../../../src/convex/_generated/api'
import { action } from '../../../src/convex/_generated/server'

export const uploadImage = action({
  args: {
    filename: v.string(),
    contentType: v.string(),
    data: v.bytes(), // 文件内容作为字节数组
  },
  handler: async (ctx, args) => {
    const { filename, contentType, data } = args

    // 生成唯一的 key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const customKey = `test-images/${timestamp}/${filename}`

    try {
      // 上传到 R2（与 speedpaint.ts 中的用法一致）
      const key = await components.r2.store(ctx, data, {
        key: customKey,
        type: contentType,
      })

      // 获取公开访问 URL（有效期 7 天）
      const url = await components.r2.getUrl(ctx, key, {
        expiresIn: 60 * 60 * 24 * 7, // 7 天（秒为单位）
      })

      return {
        success: true,
        key,
        url,
        size: data.byteLength,
        contentType,
        filename,
        uploadedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('R2 upload failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        filename,
      }
    }
  },
})

// 批量上传多个图片
export const uploadImages = action({
  args: {
    images: v.array(
      v.object({
        filename: v.string(),
        contentType: v.string(),
        data: v.bytes(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all(
      args.images.map((image) => uploadImage(ctx, image)),
    )

    return {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    }
  },
})
