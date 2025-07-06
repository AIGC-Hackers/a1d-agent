import { s3 } from '@/integration/s3'
import { splitImageToQuadrantArray } from '@/lib/image'
import { PutObjectCommand } from '@aws-sdk/client-s3'

import { db } from './db'
import { upload } from './db/schema'

export async function uploadQuadrantImage(props: {
  resourceId?: string
  jobId: string
  imageUrl: string
  bucket: string
}) {
  const response = await fetch(props.imageUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`)
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer())

  const quadrants = await splitImageToQuadrantArray(imageBuffer)

  const uploadPromises = quadrants.map(async (quadrant, index) => {
    const key = `/${props.jobId}/${index}.png`

    await s3.value.send(
      new PutObjectCommand({
        Bucket: props.bucket,
        Key: key,
        Body: quadrant,
        ContentType: 'image/png',
      }),
    )

    return {
      content_type: 'image/png',
      file_name: `${index}.png`,
      file_size: quadrant.length,
      key: key,
    }
  })

  const uploadRecords = await Promise.all(uploadPromises)

  const insertedRecords = await db.value
    .insert(upload)
    .values(
      uploadRecords.map((it) => ({
        ...it,
        job_id: props.jobId,
        resource_id: props.resourceId,
      })),
    )
    .returning()

  return insertedRecords
}
