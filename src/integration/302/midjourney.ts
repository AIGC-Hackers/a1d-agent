import type { Observable } from 'rxjs'
import { env } from '@/lib/env'
import {
  distinctUntilChanged,
  finalize,
  map,
  switchMap,
  takeWhile,
  tap,
  timeout,
  timer,
} from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import type { X302Context } from './config'
import { switchMapResponseToJson } from '../utils'
import { baseUrl } from './config'

export namespace Midjourney {
  export const provider = '302'

  export type BotType = 'MID_JOURNEY' | 'NIJI_JOURNEY'

  export type SubmitImagineInput = {
    base64Array?: string[]
    botType?: BotType
    notifyHook?: string
    prompt: string
    state?: string
  }

  export type SubmitImagineOutput = {
    code: number
    description: string
    properties: Record<string, unknown>
    result: string
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
    progress: number
    prompt: string
    promptEn: string
    properties: Record<string, unknown>
    startTime: number
    state: string
    status: string
    submitTime: number
  }

  export class Client {
    constructor(private readonly ctx: X302Context) {}

    submitImagine(input: SubmitImagineInput) {
      return submitImagine(input, this.ctx)
    }

    pollStream(
      jobId: string,
      opts?: {
        pollInterval?: number
        timeout?: number
      },
    ): Observable<MidjourneyImageJob> {
      let isCompleted = false
      return timer(0, opts?.pollInterval ?? 1000 * 10).pipe(
        switchMap(() => this.getJob(jobId)),
        distinctUntilChanged((a, b) => a.progress === b.progress),
        map((job) => ({ ...job, progress: Number(job.progress) })),
        takeWhile((job) => job.progress !== 100),
        timeout(opts?.timeout ?? 1000 * 60 * 10),
        tap((job) => {
          if (job.progress === 100) {
            isCompleted = true
          }
        }),
        finalize(() => {
          if (isCompleted) return
          this.cancelJob(jobId)
        }),
      )
    }

    getJob(id: string) {
      return getJob(id, this.ctx)
    }

    cancelJob(id: string) {
      return cancelJob({ jobId: id }, this.ctx)
    }
  }

  function submitImagine(input: SubmitImagineInput, ctx: X302Context) {
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

  function getJob(id: string, ctx: X302Context) {
    return fromFetch(`${baseUrl}/mj/task/${id}/fetch`, {
      method: 'GET',
      headers: {
        'mj-api-secret': ctx.apiKey,
        'Content-Type': 'application/json',
      },
    }).pipe(switchMapResponseToJson<MidjourneyImageJob>())
  }

  function cancelJob(input: { jobId: string }, ctx: X302Context) {
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

  /**
   * @deprecated
   */
  export function generateImageStream(
    props: {
      prompt: string
      botType?: BotType
      onSubmit?: (data: { jobId: string }) => void
      pollInterval?: number
      timeout?: number
    },
    ctx: X302Context,
  ) {
    const client = new Client(ctx)
    return client
      .submitImagine({
        prompt: props.prompt,
        botType: props.botType ?? 'MID_JOURNEY',
      })
      .pipe(
        switchMap((result) => {
          if (result.code !== 1 && result.code !== 200)
            throw new Error(result.description)
          const jobId = result.result
          if (props.onSubmit) props.onSubmit({ jobId })
          return client.pollStream(jobId, {
            pollInterval: props.pollInterval,
            timeout: props.timeout,
          })
        }),
      )
  }
}
