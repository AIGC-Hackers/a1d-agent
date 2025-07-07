/**
 * Result pattern for operations that can fail.
 * Provides explicit success/failure states without throwing exceptions.
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Utility functions for working with Results.
 */
export namespace Result {
  export function ok<T, E = Error>(data: T): Result<T, E> {
    return { success: true, data }
  }

  export function err<T, E = Error>(error: E): Result<never, E> {
    return { success: false, error }
  }

  export function fromPromise<T>(promise: Promise<T>): Promise<Result<T, Error>>
  export function fromPromise<T, E>(
    promise: Promise<T>,
    errorMapper: (error: unknown) => E,
  ): Promise<Result<T, E>>
  export function fromPromise<T, E = Error>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E,
  ): Promise<Result<T, E | Error>> {
    return promise
      .then((data) => ok(data))
      .catch((error) => {
        if (errorMapper) {
          return err(errorMapper(error))
        }
        if (error instanceof Error) {
          return err(error)
        }
        return err(new Error(String(error)))
      })
  }

  export function isOk<T, E>(
    result: Result<T, E>,
  ): result is { success: true; data: T } {
    return result.success
  }

  export function isErr<T, E>(
    result: Result<T, E>,
  ): result is { success: false; error: E } {
    return !result.success
  }
}
