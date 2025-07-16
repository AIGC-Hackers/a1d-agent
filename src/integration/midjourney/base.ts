import type { Result } from '@/lib/result'
import type { Observable } from 'rxjs'
import {
  distinctUntilChanged,
  finalize,
  from,
  retry,
  switchMap,
  takeWhile,
  tap,
  timeout,
  timer,
} from 'rxjs'

/**
 * Parse progress value from various formats
 * Handles: number (50), string number ("50"), percentage ("50%"), null/undefined
 */
export function parseProgress(progress: any): number {
  if (progress === null || progress === undefined) {
    return 0
  }

  if (typeof progress === 'number') {
    return Math.min(100, Math.max(0, progress))
  }

  if (typeof progress === 'string') {
    // Remove percentage sign and any whitespace
    const cleaned = progress.replace(/[%\s]/g, '')
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) {
      return Math.min(100, Math.max(0, parsed))
    }
  }

  return 0
}

export type ImagineInput = {
  prompt: string
  aspectRatio: '1:2' | '16:9' | '9:16' | '4:3' | '3:4' | '1:1'

  // TODO image refs
}

export type ImagineState = {
  progress: number
  payload: any
} & (
  | {
      status: 'completed'
      imageUrl: string
    }
  | {
      status: 'processing'
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

  stream(props: {
    interval?: number
    timeout?: number
  }): Observable<ImagineState> {
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
      distinctUntilChanged((a, b) => a.progress === b.progress),
      tap((state) => {
        lastState = state
      }),
      timeout(props.timeout ?? 1000 * 60 * 10),
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

  abstract imagine(input: ImagineInput): Promise<Result<ImagineTaskBase>>
}
