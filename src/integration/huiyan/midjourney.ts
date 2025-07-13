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

import type { HuiyanContext } from './config'
import { Midjourney as Midjourney302 } from '../302/midjourney'
import { switchMapResponseToJson } from '../utils'

const baseUrl = 'https://api.huiyan-ai.cn'

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
    properties: {
      discordChannelId: string
      discordInstanceId: string
    }
    result: string
  }

  export class Client {
    constructor(private readonly ctx: HuiyanContext) {}

    submitImagine(input: SubmitImagineInput) {
      return submitImagine(input, this.ctx)
    }

    pollStream(
      jobId: string,
      opts?: {
        pollInterval?: number
        timeout?: number
      },
    ): Observable<Midjourney302.MidjourneyImageJob> {
      let isCompleted = false
      return timer(0, opts?.pollInterval ?? 1000 * 10).pipe(
        switchMap(() => this.getJob(jobId)),
        distinctUntilChanged((a, b) => a.progress === b.progress),
        map((job) => job),
        takeWhile((job) => {
          const pstr = String(job.progress) ?? ''
          let progress = 0
          if (pstr !== '') {
            progress = Number(pstr.replace('%', ''))
          }
          return progress !== 100
        }),
        timeout(opts?.timeout ?? 1000 * 60 * 10),
        tap((job) => {
          const pstr = String(job.progress) ?? ''
          let progress = 0
          if (pstr !== '') {
            progress = Number(pstr.replace('%', ''))
          }
          if (progress === 100) {
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

  export const client = new Client({
    apiKey: env.value.HUIYAN_C_API_KEY,
  })

  function submitImagine(input: SubmitImagineInput, ctx: HuiyanContext) {
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

  function getJob(id: string, ctx: HuiyanContext) {
    return fromFetch(`${baseUrl}/mj/task/${id}/fetch`, {
      method: 'GET',
      headers: {
        'mj-api-secret': ctx.apiKey,
        'Content-Type': 'application/json',
      },
    }).pipe(switchMapResponseToJson<Midjourney302.MidjourneyImageJob>())
  }

  function cancelJob(input: { jobId: string }, ctx: HuiyanContext) {
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
