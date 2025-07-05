import { pushMessage } from '@/integration/cloudflare-queue'
import { env } from '@/lib/env'
import { logger } from '@/mastra/factory'
import { retry, timeout } from 'rxjs'

export function sendEvent(queue: string, message: unknown) {
  pushMessage(
    queue,
    {
      contentType: 'application/json',
      body: message,
    },
    {
      accountId: env.value.CLOUDFLARE_ACCOUNT_ID,
      apiToken: env.value.CLOUDFLARE_SECRET_KEY,
    },
  )
    .pipe(timeout(6000), retry({ count: 3 }))
    .subscribe({
      error: (error) => {
        logger.error('Failed to send event to queue', {
          queue,
          message,
          error: error instanceof Error ? error.message : String(error),
        })
      },
    })
}
