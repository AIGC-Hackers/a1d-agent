import {
  finalize,
  firstValueFrom,
  Observable,
  switchMap,
  takeWhile,
  tap,
  timeout,
  timer,
} from 'rxjs'

export const switchMapResponseToJson = <T = any>() =>
  switchMap((it: Response) => it.json() as Promise<T>)

type SubmitAndPollOptions<TSubmitResult, TPollResult> = {
  submit: () => Observable<TSubmitResult>
  extractJobId: (submitResult: TSubmitResult) => string
  poll: (jobId: string) => Observable<TPollResult>
  isCompleted: (pollResult: TPollResult) => boolean
  cancel?: (jobId: string) => Observable<any>
  onSubmit?: (data: { jobId: string }) => void
  pollInterval?: number
  timeout?: number
}

export function submitAndPoll<TSubmitResult, TPollResult>(
  options: SubmitAndPollOptions<TSubmitResult, TPollResult>,
): Observable<TPollResult> {
  let completed = false

  return options.submit().pipe(
    switchMap((submitResult) => {
      const jobId = options.extractJobId(submitResult)
      options.onSubmit?.({ jobId })

      return timer(0, options.pollInterval ?? 1000 * 10).pipe(
        switchMap(() => options.poll(jobId)),
        takeWhile((result) => !options.isCompleted(result), true),
        timeout(options.timeout ?? 1000 * 60 * 10),
        tap((result) => {
          if (options.isCompleted(result)) {
            completed = true
          }
        }),
        finalize(() => {
          if (completed || !options.cancel) return
          firstValueFrom(options.cancel(jobId))
        }),
      )
    }),
  )
}
