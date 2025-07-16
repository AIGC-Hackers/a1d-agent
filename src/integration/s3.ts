import { env } from '@/lib/env'
import { lazy } from '@/lib/lazy'
import { S3Client } from '@aws-sdk/client-s3'

export namespace S3 {
  const client$ = lazy(() => {
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

  export const client = () => client$.value

  /**
   * @deprecated
   */
  export function createPublicUrl(opts: { bucket: string; key: string }) {
    return `https://pub-ccb4d18cb7504fdca75fba79f847927b.r2.dev/${opts.key}`

    return `https://${opts.bucket}.r2.cloudflarestorage.com/${opts.key}`
  }
}
