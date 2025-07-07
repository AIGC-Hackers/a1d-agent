import type { Observable } from 'rxjs'
import { env } from '@/lib/env'
import { map } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import { submitAndPoll, switchMapResponseToJson } from '../utils'

type BotType = 'MID_JOURNEY' | 'NIJI_JOURNEY'

type SubmitImagineInput = {
  prompt: string
  botType?: BotType
  notifyHook?: string
  webhookUrl?: string
}

type MidjourneyImageJobOutput = {
  code: number
  description: string
  result: string
  properties: {
    discordChannelId: string
    discordInstanceId: string
  }
}

export type MidjourneyImageJob = {
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

export function submitImagine(props: SubmitImagineInput) {
  return fromFetch('https://api.huiyan-ai.cn/mj/submit/imagine', {
    method: 'POST',
    headers: {
      'mj-api-secret': env.value.HUIYAN_MJ_API_KEY,
      'Content-Type': 'application/json',
    },
    redirect: 'follow',
    body: JSON.stringify({
      prompt: props.prompt,
      botType: props.botType ?? 'MID_JOURNEY',
      notifyHook: props.notifyHook ?? props.webhookUrl,
    }),
  }).pipe(switchMapResponseToJson<MidjourneyImageJobOutput>())
}
type MidjourneyImageJobProgress = {
  id: string
  progress: number
  imageUrl?: string
}

type MidjourneyImageJobCompleted = {
  id: string
  imageUrl: string
}

export function getJobProgress(props: {
  jobId: string
}): Observable<MidjourneyImageJobProgress> {
  return fromFetch(`https://api.huiyan-ai.cn/mj/task/${props.jobId}/fetch`, {
    method: 'GET',
    headers: {
      'mj-api-secret': env.value.HUIYAN_MJ_API_KEY,
    },
  }).pipe(
    switchMapResponseToJson<MidjourneyImageJob>(),
    map((it) => {
      const pstr = String(it.progress) ?? ''
      let progress = 0

      if (pstr !== '') {
        progress = Number(pstr.replace('%', ''))
      }

      return {
        id: it.id,
        progress,
        imageUrl: it.imageUrl,
      }
    }),
  )
}

export function cancelMidjourneyImageJob(props: { jobId: string }) {
  return fromFetch(`https://api.huiyan-ai.cn/mj/task/${props.jobId}/cancel`, {
    method: 'POST',
    headers: {
      'mj-api-secret': env.value.HUIYAN_MJ_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    redirect: 'follow',
  }).pipe(switchMapResponseToJson<{ code: number; description: string }>())
}

export function generateImageStream(props: {
  prompt: string
  onSubmit?: (data: { jobId: string }) => void
  webhookUrl?: string
  pollInterval?: number
  timeout?: number
}) {
  return submitAndPoll<MidjourneyImageJobOutput, MidjourneyImageJobProgress>({
    submit: () =>
      submitImagine({
        prompt: props.prompt,
        webhookUrl: props.webhookUrl,
      }),
    extractJobId: (result) => {
      console.log('='.repeat(100))
      console.log(result)
      console.log('='.repeat(100))

      if (result.code !== 1) throw new Error(result.description)
      return result.result
    },
    poll: (jobId) => getJobProgress({ jobId }),
    isCompleted: (job) => job.progress === 100,
    cancel: (jobId) => cancelMidjourneyImageJob({ jobId }),
    onSubmit: props.onSubmit,
    pollInterval: props.pollInterval ?? 1000 * 60 * 10,
    timeout: props.timeout ?? 1000 * 60 * 10,
  })
}
