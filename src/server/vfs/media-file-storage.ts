import { join } from 'path'
import type { PutObjectCommandOutput } from '@aws-sdk/client-s3'
import { api } from '@/convex/_generated/api'
import { s3 } from '@/integration/s3'
import { splitImageToQuadrants } from '@/lib/image'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { type } from 'arktype'
import { ConvexHttpClient } from 'convex/browser'
import { firstValueFrom, from, mergeMap, toArray } from 'rxjs'

import { FileSource } from '../../lib/file-source'

export namespace MediaFileStorage {
  export namespace Schema {
    export const S3Object = type({
      key: 'string',
      _upload: type.unknown.as<PutObjectCommandOutput>(),
    })

    export const ImageInfo = type({
      width: 'number',
      height: 'number',
    })

    export const AudioInfo = type({
      durationSeconds: 'number',
    })

    export const VideoInfo = ImageInfo.and(AudioInfo)

    export type ImageInfo = typeof ImageInfo.infer
    export type AudioInfo = typeof AudioInfo.infer
    export type VideoInfo = typeof VideoInfo.infer

    export const ImageObject = ImageInfo.and(S3Object)
    export const AudioObject = AudioInfo.and(S3Object)
    export const VideoObject = VideoInfo.and(S3Object)

    export type ImageObject = typeof ImageObject.infer
    export type AudioObject = typeof AudioObject.infer
    export type VideoObject = typeof VideoObject.infer
  }

  export async function saveFile(props: {
    convex: ConvexHttpClient
    resourceId?: string
    threadId: string
    path: string
    source: FileSource.Input
    bucket: string
    contentType?: string
    description?: string
    metadata: Schema.ImageInfo | Schema.AudioInfo | Schema.VideoInfo
  }) {
    const key = join('/', props.threadId, props.path)

    const data = await FileSource.get(props.source)

    const inferredContentType =
      props.contentType || FileSource.inferContentType(props.path)

    const upload: PutObjectCommandOutput = await s3.value.send(
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
      content: '',
      contentType: inferredContentType,
      description: props.description,
      size: data instanceof Uint8Array ? data.length : 0,
      metadata: {
        _upload: upload,
        ...props.metadata,
        key,
      },
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
    metadata: Schema.ImageInfo
  }) {
    const data = await FileSource.get({
      type: 'url',
      url: props.imageUrl,
    })

    const quadrants = await splitImageToQuadrants(await data.bytes())

    const upload$ = from([
      quadrants.topLeft,
      quadrants.topRight,
      quadrants.bottomLeft,
      quadrants.bottomRight,
    ]).pipe(
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
          metadata: {
            ...props.metadata,
          },
        })
      }, 4),
      toArray(),
    )

    const uploadRecords = await firstValueFrom(upload$)

    return uploadRecords
  }
}
