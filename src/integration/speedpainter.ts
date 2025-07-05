import { env } from '@/lib/env'
import { events } from 'fetch-event-stream'

export type AppType = 'iu' | 'sp' | 'vu'

export const DEFAULT_HAND_TITLE = 'no hand'
export const DEFAULT_CANVAS_TITLE = 'white board'

export async function createSpeedPainterTask(
  request: GenerateRequest,
): Promise<{ taskId: string }> {
  const {
    baseUrl,
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
  baseUrl: string
  signal?: AbortSignal
}): Promise<TaskStatus> {
  const url = new URL(`${input.baseUrl}/api/task/${input.taskId}`)

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

  return response.json() as Promise<TaskStatus>
}

export async function* getTaskStatusStream(input: {
  taskId: string
  app: AppType
  source?: SourceType
  signal?: AbortSignal
  // token: string
  baseUrl: string
}): AsyncGenerator<TaskStatus> {
  const url = new URL(`${input.baseUrl}/api/task/${input.taskId}/sse`)
  url.searchParams.set('app', input.app)
  if (input.source) {
    url.searchParams.set('source', input.source)
  }

  const response = await fetch(url.toString(), {
    signal: input.signal,
    headers: {
      // Authorization: `Bearer ${input.token}`,
      Authorization: `KEY ${env.value.SPEEDPAINTER_API_KEY}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'Failed to get task status')
  }

  for await (const event of events(response)) {
    if (event.data) {
      const payload = JSON.parse(event.data) as TaskStatus
      yield payload
    }
  }
}

export type GenerateData = {
  imageUrl: string
  mimeType: string
  sketchDuration: number
  source: SourceType
  colorFillDuration: number
  needCanvas: boolean
  canvasTitle: string
  needHand: boolean
  handTitle: string
  needFadeout: boolean
  fps: number
}

export type GenerateRequest = GenerateData & {
  // token: string
  baseUrl: string
}

export type TaskResult = {
  sketchImageUrl: string
  videoUrl: string
  taskId: string
}

export type SourceType = 'framer' | 'api' | 'web' | 'canva'
