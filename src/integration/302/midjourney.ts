import type { Observable } from 'rxjs'
import { env } from '@/lib/env'
import { isEqual } from 'lodash-es'
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
import { baseUrl } from '../openrouter'
import { switchMapResponseToJson } from '../utils'

export namespace Midjourney {
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
      return cancelMidjourneyImageJob({ jobId: id }, this.ctx)
    }
  }

  export const client = new Client({
    apiKey: env.value.X_302_API_KEY,
  })

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

  function cancelMidjourneyImageJob(
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
}
