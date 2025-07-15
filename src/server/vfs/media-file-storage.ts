import { join } from 'path'
import type { PutObjectCommandOutput } from '@aws-sdk/client-s3'
import { api } from '@/convex/_generated/api'
import { S3 } from '@/integration/s3'
import { splitImageToQuadrants } from '@/lib/image'
import { invariant } from '@/lib/invariant'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { type } from 'arktype'
import { ConvexHttpClient } from 'convex/browser'
import { firstValueFrom, from, mergeMap, toArray } from 'rxjs'

import { FileSource } from '../../lib/file-source'

export namespace MediaFileStorage {
  const $ = type.scope({
    Object: {
      key: 'string',
      upload: type.unknown.as<PutObjectCommandOutput>(),
    },
    ImageInput: {
      width: 'number',
      height: 'number',
    },
    ImageOutput: 'ImageInput & Object',

    VideoInput: {
      width: 'number',
      height: 'number',
      durationSeconds: 'number',
    },
    VideoOutput: 'VideoInput & Object',

    AudioInput: {
      durationSeconds: 'number',
    },
    AudioOutput: 'AudioInput & Object',
  })

  export const schemas = $.export()

  type AudioInput = typeof schemas.AudioInput.infer
  type AudioOutput = typeof schemas.AudioOutput.infer
  type ImageInput = typeof schemas.ImageInput.infer
  type ImageOutput = typeof schemas.ImageOutput.infer
  type VideoInput = typeof schemas.VideoInput.infer
  type VideoOutput = typeof schemas.VideoOutput.infer

  type TypeMap = {
    image: {
      input: ImageInput
      output: ImageOutput
    }
    audio: {
      input: AudioInput
      output: AudioOutput
    }
    video: {
      input: VideoInput
      output: VideoOutput
    }
  }

  export async function getFileInfo<
    T extends keyof TypeMap,
    Meta = TypeMap[T]['output'],
  >(
    type: T,
    opts: {
      convex: ConvexHttpClient
      threadId: string
      path: string
    },
  ): Promise<{
    metadata: Meta
  }> {
    const file = await opts.convex.query(api.vfs.readFile, {
      threadId: opts.threadId,
      path: opts.path,
    })
    invariant(
      file,
      `File not found, threadId: ${opts.threadId}, path: ${opts.path}`,
    )

    switch (type) {
      case 'image': {
        const metadata: ImageOutput = schemas.ImageOutput.assert(file.metadata)
        // @ts-ignore
        return { metadata }
      }
      case 'audio': {
        const metadata: AudioOutput = schemas.AudioOutput.assert(file.metadata)
        // @ts-ignore
        return { metadata }
      }
      case 'video': {
        const metadata: VideoOutput = schemas.VideoOutput.assert(file.metadata)
        // @ts-ignore
        return { metadata }
      }
    }
  }

  export async function saveFile<
    T extends keyof TypeMap,
    Meta = TypeMap[T]['input'],
  >(
    type: T,
    props: {
      convex: ConvexHttpClient
      resourceId?: string
      threadId: string
      path: string
      source: FileSource.Input
      bucket: string
      contentType?: string
      description?: string
      metadata: Meta
    },
  ) {
    const key = join(props.threadId, props.path).replace(/^\/+/, '') // Remove leading slashes

    // Handle different source types to avoid streaming issues
    let bodyData: Uint8Array
    let inferredContentType: string

    switch (props.source.type) {
      case 'hex': {
        bodyData = FileSource.decodeHexString(props.source.data)
        inferredContentType = props.contentType || props.source.contentType || FileSource.inferContentType(props.path)
        break
      }
      case 'base64': {
        const binaryString = atob(props.source.data)
        bodyData = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bodyData[i] = binaryString.charCodeAt(i)
        }
        inferredContentType = props.contentType || props.source.contentType || FileSource.inferContentType(props.path)
        break
      }
      case 'url': {
        // For URLs, we still need to use the streaming approach
        const data = await FileSource.get(props.source)
        bodyData = new Uint8Array(await data.arrayBuffer())
        inferredContentType = props.contentType || FileSource.inferContentType(props.path)
        break
      }
    }

    const upload: PutObjectCommandOutput = await S3.client().send(
      new PutObjectCommand({
        Bucket: props.bucket,
        Key: key,
        Body: bodyData,
        ContentType: inferredContentType,
        Metadata: {
          threadId: props.threadId,
          resourceId: props.resourceId ?? 'none',
        },
      }),
    )

    // Clean AWS response to avoid Convex reserved fields
    const uploadMetadata = {
      ETag: upload.ETag,
      VersionId: upload.VersionId,
      ServerSideEncryption: upload.ServerSideEncryption,
      // Remove $metadata and other AWS internal fields
    }

    const entityId = await props.convex.mutation(api.vfs.writeFile, {
      threadId: props.threadId,
      path: props.path,
      content: '',
      contentType: inferredContentType,
      description: props.description,
      size: bodyData.length,
      metadata: {
        key,
        upload: uploadMetadata,
        ...props.metadata,
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
        const filepath = join(props.path, `${index}.png`)
        return await saveFile('image', {
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
            width: quadrants.width,
            height: quadrants.height,
          },
        })
      }, 4),
      toArray(),
    )

    const uploadRecords = await firstValueFrom(upload$)

    return {
      ...uploadRecords,
      width: quadrants.width,
      height: quadrants.height,
    }
  }
}
