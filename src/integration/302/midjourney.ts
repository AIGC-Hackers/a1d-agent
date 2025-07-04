import { fromFetch } from 'rxjs/fetch'

import type { X302Context } from './config'
import { baseUrl } from '../openrouter'
import { submitAndPoll, switchMapResponseToJson } from '../utils'

export type BotType = 'MID_JOURNEY' | 'NIJI_JOURNEY'

type SubmitImagineInput = {
  base64Array?: string[]
  botType?: BotType
  notifyHook?: string
  prompt: string
  state?: string
}

type SubmitImagineOutput = {
  code: number
  description: string
  properties: Record<string, unknown>
  result: string
}

type MidjourneyImageJob = {
  action: string
  buttons: Array<{
    customId: string
    emoji: string
    label: string
    style: number
    type: number
  }>
  description: string
  failReason: string
  finishTime: number
  id: string
  imageUrl: string
  progress: string
  prompt: string
  promptEn: string
  properties: Record<string, unknown>
  startTime: number
  state: string
  status: string
  submitTime: number
}

export function submitImagine(input: SubmitImagineInput, ctx: X302Context) {
  return fromFetch(`${baseUrl}/mj/submit/imagine`, {
    method: 'POST',
    headers: {
      'mj-api-secret': ctx.apiKey,
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
    body: JSON.stringify(input),
  }).pipe(switchMapResponseToJson<SubmitImagineOutput>())
}

export function getJob(id: string, ctx: X302Context) {
  return fromFetch(`${baseUrl}/mj/task/${id}/fetch`, {
    method: 'GET',
    headers: {
      'mj-api-secret': ctx.apiKey,
      'Content-Type': 'application/json',
    },
  }).pipe(switchMapResponseToJson())
}

export function cancelMidjourneyImageJob(
  input: { jobId: string },
  ctx: X302Context,
) {
  return fromFetch(`${baseUrl}/mj/task/${input.jobId}/cancel`, {
    method: 'POST',
    headers: {
      'mj-api-secret': ctx.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    redirect: 'follow',
  }).pipe(switchMapResponseToJson<{ code: number; description: string }>())
}

export function generateImageStream(
  props: {
    prompt: string
    botType?: BotType
    base64Array?: string[]
    notifyHook?: string
    state?: string
    onSubmit?: (data: { jobId: string }) => void
    pollInterval?: number
    timeout?: number
  },
  ctx: X302Context,
) {
  return submitAndPoll<SubmitImagineOutput, MidjourneyImageJob>({
    submit: () =>
      submitImagine(
        {
          prompt: props.prompt,
          botType: props.botType,
          base64Array: props.base64Array,
          notifyHook: props.notifyHook,
          state: props.state,
        },
        ctx,
      ),
    extractJobId: (result) => {
      if (result.code !== 1) throw new Error(result.description)
      return result.result
    },
    poll: (jobId) => getJob(jobId, ctx),
    isCompleted: (job) => job.progress === '100',
    cancel: (jobId) => cancelMidjourneyImageJob({ jobId }, ctx),
    onSubmit: props.onSubmit,
    pollInterval: props.pollInterval,
    timeout: props.timeout,
  })
}
