import { Result } from '@/lib/result'

import {
  ClientBase,
  ImagineInput,
  ImagineState,
  ImagineTaskBase,
  parseProgress,
} from './base'

export namespace HuiyanMidjourneyProxy {
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
    progress: number | string // Huiyan might return "50%" format
    prompt: string
    promptEn: string
    properties: {
      discordChannelId?: string
      discordInstanceId?: string
    }
    startTime: number
    state: string
    status: string
    submitTime: number
  }

  const baseUrl = 'https://api.huiyan-ai.cn'

  export class HuiyanImagineTask extends ImagineTaskBase {
    constructor(
      readonly id: string,
      readonly input: ImagineInput,
      private readonly apiKey: string,
    ) {
      super(id, input)
    }

    async poll(): Promise<ImagineState> {
      try {
        const response = await fetch(`${baseUrl}/mj/task/${this.id}/fetch`, {
          method: 'GET',
          headers: {
            'mj-api-secret': this.apiKey,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(
            `[Huiyan] Get job failed: ${response.status} ${response.statusText} - ${errorText}`,
          )
        }

        const responseData = await response.json()

        // Check if response has error structure
        if (
          responseData.code &&
          responseData.code !== 1 &&
          responseData.code !== 200
        ) {
          throw new Error(
            `[Huiyan] Job error: ${responseData.description || 'Unknown error'}`,
          )
        }

        // Parse as MidjourneyImageJob
        const job = responseData as MidjourneyImageJob
        const progress = parseProgress(job.progress)

        if (job.failReason) {
          return {
            status: 'failed',
            progress,
            error: new Error(`[Huiyan] Job failed: ${job.failReason}`),
            payload: job,
          }
        }

        return {
          status: progress === 100 ? 'completed' : 'processing',
          progress,
          imageUrl: job.imageUrl,
          payload: job,
        }
      } catch (error) {
        return {
          progress: 0,
          status: 'failed',
          error: error as Error,
          payload: {},
        }
      }
    }

    async cancel() {
      const response = await fetch(`${baseUrl}/mj/task/${this.id}/cancel`, {
        method: 'POST',
        headers: {
          'mj-api-secret': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        redirect: 'follow',
      })
      if (response.status !== 200) {
        console.warn(
          `[Huiyan] cancel job ${this.id} failed, status: ${response.status}`,
        )
      }
      return
    }
  }

  type BotType = 'MID_JOURNEY' | 'NIJI_JOURNEY'

  export type HuiyanImagineInput = {
    base64Array?: string[]
    botType?: BotType
    notifyHook?: string
    prompt: string
    state?: string
  }

  type HuiyanImagineOutput = {
    code: number
    description: string
    properties: {
      discordChannelId: string
      discordInstanceId: string
    }
    result: string
  }

  export class HuiyanClient extends ClientBase {
    constructor(protected readonly apiKey: string) {
      super('huiyan', baseUrl)
    }

    async imagine(input: ImagineInput): Promise<Result<ImagineTaskBase>> {
      try {
        const response = await fetch(`${this.baseUrl}/mj/submit/imagine`, {
          method: 'POST',
          headers: {
            'mj-api-secret': this.apiKey,
            'Content-Type': 'application/json',
          },
          redirect: 'follow',
          body: JSON.stringify(<HuiyanImagineInput>{
            base64Array: [],
            prompt: input.prompt + ` --ar ${input.aspectRatio}`,
            botType: 'MID_JOURNEY',
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          return Result.err(
            new Error(
              `[Huiyan] Submit imagine failed: ${response.status} ${response.statusText} - ${errorText}`,
            ),
          )
        }

        const responseData: HuiyanImagineOutput = await response.json()

        if (responseData.code !== 1 && responseData.code !== 200) {
          return Result.err(
            new Error(
              `[Huiyan] Submit imagine failed: ${responseData.description || 'Unknown error'}`,
            ),
          )
        }

        if (!responseData.result) {
          return Result.err(
            new Error('[Huiyan] Submit imagine failed: No job ID in response'),
          )
        }

        return Result.ok(
          new HuiyanImagineTask(responseData.result, input, this.apiKey),
        )
      } catch (error) {
        return Result.err(
          error instanceof Error
            ? error
            : new Error(`[Huiyan] Submit imagine failed: ${String(error)}`),
        )
      }
    }
  }
}
