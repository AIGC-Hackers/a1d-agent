import { invariant } from '@/lib/invariant'
import { SetNonNullable } from 'type-fest'

export namespace FileSource {
  export type UrlInput = {
    type: 'url'
    url: string
  }
  export type Base64Input = {
    type: 'base64'
    contentType?: string
    data: string
  }
  export type HexInput = {
    type: 'hex'
    contentType?: string
    data: string
  }

  export type Input = UrlInput | Base64Input | HexInput

  export type ResponseData = SetNonNullable<Response, 'body'>

  export async function get(input: Input): Promise<ResponseData> {
    switch (input.type) {
      case 'url': {
        const response = await fetch(input.url)
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${input.url}: ${response.statusText}`,
          )
        }

        invariant(response.body, 'response body is required')

        return response as ResponseData
      }
      case 'base64': {
        const binaryString = atob(input.data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const blob = new Blob([bytes])
        const response = new Response(blob, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': input.contentType ?? 'application/octet-stream',
            'Content-Length': bytes.length.toString(),
          },
        })

        return response as ResponseData
      }
      case 'hex': {
        const bytes = decodeHexString(input.data)
        const blob = new Blob([bytes])
        const response = new Response(blob, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': input.contentType ?? 'application/octet-stream',
            'Content-Length': bytes.length.toString(),
          },
        })

        return response as ResponseData
      }
    }
  }

  export function decodeHexString(hexString: string): Uint8Array {
    const bytes = new Uint8Array(hexString.length / 2)
    for (let i = 0; i < hexString.length; i += 2) {
      bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
    }
    return bytes
  }

  export function inferContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase()

    const mimeTypes: Record<string, string> = {
      // 图片
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      bmp: 'image/bmp',
      ico: 'image/x-icon',

      // 视频
      mp4: 'video/mp4',
      webm: 'video/webm',
      avi: 'video/x-msvideo',
      mov: 'video/quicktime',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
      mkv: 'video/x-matroska',

      // 音频
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      aac: 'audio/aac',
      flac: 'audio/flac',
      m4a: 'audio/mp4',

      // 文档
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // 文本
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      csv: 'text/csv',

      // 压缩文件
      zip: 'application/zip',
      rar: 'application/x-rar-compressed',
      '7z': 'application/x-7z-compressed',
      tar: 'application/x-tar',
      gz: 'application/gzip',
    }

    return mimeTypes[ext || ''] || 'application/octet-stream'
  }
}
