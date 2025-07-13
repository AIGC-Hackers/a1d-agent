import { type } from 'arktype'

// TODO rewrite as arktype
type JinaHeaders = {
  'X-Timeout'?: number
  'X-Token-Budget'?: number
  'X-With-Generated-Alt'?: boolean
  'X-Set-Cookie'?: string
  'X-Respond-With'?: 'readerlm-v2'
} & Record<string, string>

export async function fetchJinaApiContent(args: {
  url: string
  apiKey: string
  signal?: AbortSignal
  headers?: JinaHeaders
}): Promise<Response> {
  const { url, apiKey, signal, headers = {} } = args
  const endpoint = `https://r.jina.ai/${url}`

  const requestHeaders: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    ...Object.fromEntries(
      Object.entries(headers)
        .map(([k, v]) => [k, v.toString()])
        .filter(([_, v]) => v !== undefined),
    ),
  }

  if (headers['X-Respond-With'] === 'readerlm-v2') {
    requestHeaders.Accept = 'text/event-stream'
  }

  throw new Error('Not implemented')

  return fetch(endpoint, {
    method: 'GET',
    headers: requestHeaders,
    signal,
  })
}
