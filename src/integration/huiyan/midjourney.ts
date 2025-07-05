import { fromFetch } from 'rxjs/fetch'

import { submitAndPoll, switchMapResponseToJson } from '../utils'

type BotType = 'MID_JOURNEY' | 'NIJI_JOURNEY'

type SubmitImagineInput = {
  prompt: string
  apiKey: string
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
      'mj-api-secret': props.apiKey,
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

export function getJob(props: { jobId: string; apiKey: string }) {
  return fromFetch(`https://api.huiyan-ai.cn/mj/task/${props.jobId}/fetch`, {
    method: 'GET',
    headers: {
      'mj-api-secret': props.apiKey,
    },
  }).pipe(switchMapResponseToJson<MidjourneyImageJob>())
}

export function cancelMidjourneyImageJob(props: {
  jobId: string
  apiKey: string
}) {
  return fromFetch(`https://api.huiyan-ai.cn/mj/task/${props.jobId}/cancel`, {
    method: 'POST',
    headers: {
      'mj-api-secret': props.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
    redirect: 'follow',
  }).pipe(switchMapResponseToJson<{ code: number; description: string }>())
}

export function generateImageStream(props: {
  prompt: string
  apiKey: string
  onSubmit?: (data: { jobId: string }) => void
  webhookUrl?: string
  pollInterval?: number
  timeout?: number
}) {
  return submitAndPoll<MidjourneyImageJobOutput, MidjourneyImageJob>({
    submit: () =>
      submitImagine({
        prompt: props.prompt,
        apiKey: props.apiKey,
        webhookUrl: props.webhookUrl,
      }),
    extractJobId: (result) => {
      if (result.code !== 1) throw new Error(result.description)
      return result.result
    },
    poll: (jobId) => getJob({ jobId, apiKey: props.apiKey }),
    isCompleted: (job) => job.progress === '100',
    cancel: (jobId) =>
      cancelMidjourneyImageJob({ jobId, apiKey: props.apiKey }),
    onSubmit: props.onSubmit,
    pollInterval: props.pollInterval ?? 1000 * 60 * 10,
    timeout: props.timeout ?? 1000 * 60 * 10,
  })
}