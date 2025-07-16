import type { Observable } from 'rxjs'
import { finalize, from, retry, switchMap, takeWhile, tap, timer } from 'rxjs'

export namespace MidjourneyProxy {
  export type ImagineInput = {
    prompt: string
    aspectRatio: '1:2' | '16:9' | '9:16' | '4:3' | '3:4' | '1:1'
  }

  export type ImagineState = {
    progress: number
  } & (
    | {
        status: 'completed'
        imageUrl: string
      }
    | {
        status: 'processing'
        imageUrl?: string
      }
    | {
        status: 'failed'
        error: Error
      }
  )

  const DEFAULT_POLL_INTERVAL = 3000

  export abstract class ImagineTaskBase {
    constructor(
      readonly id: string,
      readonly input: ImagineInput,
    ) {}

    abstract poll(): Promise<ImagineState>

    abstract cancel(): Promise<void>

    watch(props: { interval?: number }): Observable<ImagineState> {
      let lastState: ImagineState | null = null
      return timer(0, props.interval ?? DEFAULT_POLL_INTERVAL).pipe(
        switchMap(() => {
          return from(this.poll()).pipe(
            retry({
              delay: 1000,
              count: 3,
            }),
          )
        }),
        takeWhile((state) => state.status !== 'completed', true),
        tap((state) => {
          lastState = state
        }),
        finalize(() => {
          if (lastState?.status !== 'completed') {
            this.cancel()
          }
        }),
      )
    }
  }

  export abstract class ClientBase {
    constructor(
      readonly provider: string,
      readonly baseUrl: string,
    ) {}

    abstract imagine(input: ImagineInput): Promise<ImagineTaskBase>
  }
}
