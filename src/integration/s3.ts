import { env } from '@/lib/env'
import { lazy } from '@/lib/lazy'
import { S3Client } from '@aws-sdk/client-s3'

export const s3 = lazy(() => {
  const vars = env.value
  return new S3Client({
    region: 'auto',

    // Cloudflare R2: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
    // `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`
    endpoint: `https://${vars.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: vars.CLOUDFLARE_ACCESS_KEY_ID,
      secretAccessKey: vars.CLOUDFLARE_SECRET_KEY,
    },
  })
})

export function createCloudflareR2Url(opts: { bucket: string; key: string }) {
  return `https://${opts.bucket}.r2.cloudflarestorage.com/${opts.key}`
}
