import { switchMap } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

export type CloudflareContext = {
  apiToken: string
  accountId: string
  baseUrl?: string
}

export type QueueMessage = {
  body: unknown
  contentType?: string
  delaySeconds?: number
}

export type QueueMessageWithLease = {
  lease_id: string
  body?: unknown
  timestamp?: number
  attempts?: number
}

export type AckRetryInput = {
  acks?: string[]
  retries?: string[]
}

export type PullMessagesInput = {
  visibility_timeout?: number
  batch_size?: number
}

export type PushMessageInput = QueueMessage

export type PushMessageBatchInput = {
  messages: QueueMessage[]
}

export type CloudflareApiResponse<T = unknown> = {
  success: boolean
  errors?: Array<{
    code: number
    message: string
    documentation_url?: string
    source?: {
      pointer?: string
    }
  }>
  messages?: string[]
  result?: T
}

export type AckRetryOutput = {
  ackCount: number
  retryCount: number
  warnings?: string[]
}

export type PullMessagesOutput = {
  message_backlog_count: number
  messages: QueueMessageWithLease[]
}

const baseUrl = 'https://api.cloudflare.com/client/v4'

async function handleCloudflareResponse<T>(
  response: Response,
): Promise<CloudflareApiResponse<T>> {
  if (!response.ok) {
    if (import.meta.env.DEV) {
      const text = await response.text()
      console.error(
        `Cloudflare API request failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
      )
    }
    throw new Error(
      `Cloudflare API request failed: ${response.status} ${response.statusText}`,
    )
  }
  return response.json()
}

function makeCloudflareQueueRequest<T>(
  endpoint: string,
  body: unknown,
  context: CloudflareContext,
) {
  return fromFetch(
    `${context.baseUrl ?? baseUrl}/accounts/${context.accountId}/queues/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.apiToken}`,
      },
      body: JSON.stringify(body),
    },
  ).pipe(switchMap((response) => handleCloudflareResponse<T>(response)))
}

export function acknowledgeRetryMessages(
  queueId: string,
  input: AckRetryInput,
  context: CloudflareContext,
) {
  return makeCloudflareQueueRequest<AckRetryOutput>(
    `${queueId}/messages/ack`,
    input,
    context,
  )
}

export function pullMessages(
  queueId: string,
  input: PullMessagesInput,
  context: CloudflareContext,
) {
  return makeCloudflareQueueRequest<PullMessagesOutput>(
    `${queueId}/messages/pull`,
    input,
    context,
  )
}

export function pushMessage(
  queueId: string,
  input: PushMessageInput,
  context: CloudflareContext,
) {
  return makeCloudflareQueueRequest<void>(`${queueId}/messages`, input, context)
}

export function pushMessageBatch(
  queueId: string,
  input: PushMessageBatchInput,
  context: CloudflareContext,
) {
  return makeCloudflareQueueRequest<void>(
    `${queueId}/messages/batch`,
    input,
    context,
  )
}
