import { fromFetch } from 'rxjs/fetch'

import { switchMapResponseToJson } from '../utils'
import { baseUrl } from './config'

export function request<T>(input: {
  path: string
  body: Record<string, unknown>
}) {
  return fromFetch(`${baseUrl}/${input.path}`, {
    method: 'POST',
    body: JSON.stringify(input.body),
  }).pipe(switchMapResponseToJson<T>())
}
