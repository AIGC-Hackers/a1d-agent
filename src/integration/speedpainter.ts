import { env } from '@/lib/env'
import { events } from 'fetch-event-stream'
import { isEqual } from 'lodash-es'

export namespace Speedpainter {
  export type AppType = 'iu' | 'sp' | 'vu'

  export const DEFAULT_HAND_TITLE = 'no hand'
  export const DEFAULT_CANVAS_TITLE = 'white board'
  export const DEFAULT_FPS = 24

  const baseUrl = 'https://api.a1d.ai'

  function calculateProgress(status: TaskStatus['status']): number {
    if (status === 'INIT' || status === 'WAITING') {
      return 10
    } else if (status === 'PROCESSING') {
      return 50
    } else if (status === 'FINISHED') {
      return 100
    } else if (status === 'ERROR') {
      return 0
    }
    return 0
  }

  export async function createTask(
    request: GenerateInput,
  ): Promise<{ taskId: string }> {
    const {
      imageUrl,
      mimeType,
      sketchDuration,
      source = 'api',
      colorFillDuration,
      needCanvas,
      canvasTitle = DEFAULT_CANVAS_TITLE,
      needHand,
      handTitle = DEFAULT_HAND_TITLE,
      needFadeout = false,
      fps = DEFAULT_FPS,
    } = request

    const response = await fetch(`${baseUrl}/api/speedpainter`, {
      method: 'POST',
      headers: {
        // Authorization: `Bearer ${token}`,
        Authorization: `KEY ${env.value.SPEEDPAINTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageUrl,
        mimeType,
        sketchDuration,
        source,
        colorFillDuration,
        needCanvas,
        canvasTitle,
        needHand,
        handTitle,
        needFadeout,
        fps,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to create speed painter task')
    }

    return response.json()
  }

  export type TaskStatus = {
    taskId: string
    progress: number
  } & (
    | {
        status: 'WAITING'
      }
    | {
        status: 'PROCESSING'
      }
    | {
        status: 'INIT'
      }
    | {
        status: 'UNKNOWN'
      }
    | {
        status: 'FINISHED'
        videoUrl: string
        sketchImageUrl: string
      }
    | {
        status: 'ERROR'
        error: string
      }
  )

  export async function getTaskStatus(input: {
    taskId: string
    signal?: AbortSignal
  }): Promise<TaskStatus> {
    const url = new URL(`${baseUrl}/api/task/${input.taskId}`)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `KEY ${env.value.SPEEDPAINTER_API_KEY}`,
      },
      signal: input.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to get task status')
    }

    const result = (await response.json()) as Omit<TaskStatus, 'progress'>

    return {
      ...result,
      progress: calculateProgress(result.status),
    } as TaskStatus
  }

  export async function* getTaskStatusStream(input: {
    taskId: string
    signal?: AbortSignal
  }): AsyncGenerator<TaskStatus> {
    const url = new URL(`${baseUrl}/api/task/${input.taskId}/sse`)
    url.searchParams.set('app', 'sp')
    url.searchParams.set('source', 'api')

    const response = await fetch(url.toString(), {
      signal: input.signal,
      headers: {
        Authorization: `KEY ${env.value.SPEEDPAINTER_API_KEY}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText || 'Failed to get task status stream')
    }

    let lastEvent: TaskStatus | null = null

    for await (const event of events(response)) {
      if (lastEvent) {
        if (isEqual(lastEvent, event)) {
          // skip duplicate event
          continue
        }
      }

      if (event.data) {
        const payload = JSON.parse(event.data) as Omit<TaskStatus, 'progress'>

        yield {
          ...payload,
          progress: calculateProgress(payload.status),
        } as TaskStatus
      }
    }
  }

  export type GenerateInput = {
    imageUrl: string
    mimeType: string
    sketchDuration: number
    source?: SourceType
    colorFillDuration: number
    needCanvas: boolean
    canvasTitle?: string
    needHand: boolean
    handTitle?: string
    needFadeout: boolean
    fps?: number
  }

  export type TaskResult = {
    sketchImageUrl: string
    videoUrl: string
    taskId: string
  }

  export type SourceType = 'framer' | 'api' | 'web' | 'canva'
}
