import { join } from 'path'
import { api } from '@/convex/_generated/api'
import { s3 } from '@/integration/s3'
import { splitImageToQuadrantArray } from '@/lib/image'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { ConvexHttpClient } from 'convex/browser'
import { firstValueFrom, from, mergeMap, toArray } from 'rxjs'

import { FileSource } from '../../lib/file-source'

export async function saveFile(props: {
  convex: ConvexHttpClient
  resourceId?: string
  threadId: string
  path: string
  source: FileSource.Input
  bucket: string
  contentType?: string
  description?: string
}) {
  const key = join('/', props.threadId, props.path)

  const data = await FileSource.get(props.source)

  const inferredContentType =
    props.contentType || FileSource.inferContentType(props.path)

  const upload = await s3.value.send(
    new PutObjectCommand({
      Bucket: props.bucket,
      Key: key,
      Body: data.body,
      ContentType: inferredContentType,
      Metadata: {
        threadId: props.threadId,
        resourceId: props.resourceId ?? '<none>',
      },
    }),
  )

  const entityId = await props.convex.mutation(api.vfs.writeFile, {
    threadId: props.threadId,
    path: props.path,
    content: key,
    contentType: inferredContentType,
    description: props.description,
    size: data instanceof Uint8Array ? data.length : 0,
    metadata: upload,
  })

  return { key, upload, entityId, path: props.path }
}

// 保存四象限图片（专用于图片处理）
export async function saveQuadrantImage(props: {
  convex: ConvexHttpClient
  resourceId?: string
  threadId: string
  path: string
  imageUrl: string
  bucket: string
}) {
  const data = await FileSource.get({
    type: 'url',
    url: props.imageUrl,
  })

  const quadrants = await splitImageToQuadrantArray(await data.bytes())

  const upload$ = from(quadrants).pipe(
    mergeMap(async (quadrant, index) => {
      const filepath = join('/', props.path, `${index}.png`)
      return await saveFile({
        convex: props.convex,
        resourceId: props.resourceId,
        threadId: props.threadId,
        path: filepath,
        source: {
          type: 'base64',
          data: Buffer.from(quadrant).toString('base64'),
        },
        bucket: props.bucket,
        contentType: 'image/png',
      })
    }, 4),
    toArray(),
  )

  const uploadRecords = await firstValueFrom(upload$)

  return uploadRecords
}
