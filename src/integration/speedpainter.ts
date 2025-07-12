import { env } from '@/lib/env'
import { events } from 'fetch-event-stream'
import {
  catchError,
  from,
  map,
  Observable,
  of,
  switchMap,
  takeWhile,
} from 'rxjs'

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

// 成功结果类型
export type SpeedpainterSuccessResult = {
  taskId: string
  videoUrl: string
  sketchImageUrl: string
  progress: number
}

// 统一的任务结果类型（包含中间状态）
export type SpeedpainterJobResult = TaskStatus & {
  progress: number
}

/**
 * 生成 SpeedPainter 视频的流式接口
 * 返回一个 Observable，可以观察任务的进度和状态
 */
export function generateSpeedpainterVideoStream(
  params: Omit<GenerateRequest, 'baseUrl'> & {
    baseUrl?: string
    onSubmit?: (data: { taskId: string }) => void
  },
): Observable<SpeedpainterJobResult> {
  const baseUrl = params.baseUrl || 'https://speedpainter.302.ai'

  return from(
    createSpeedPainterTask({
      ...params,
      baseUrl,
    }),
  ).pipe(
    switchMap(({ taskId }) => {
      // 通知任务已提交
      params.onSubmit?.({ taskId })

      // 创建状态流
      return from(
        getTaskStatusStream({
          taskId,
          app: 'sp',
          source: params.source,
          baseUrl,
        }),
      ).pipe(
        switchMap((stream) => stream),
        map((status): SpeedpainterJobResult => {
          // 计算进度
          let progress = 0
          if (status.status === 'INIT' || status.status === 'WAITING') {
            progress = 10
          } else if (status.status === 'PROCESSING') {
            progress = 50
          } else if (status.status === 'FINISHED') {
            progress = 100
          } else if (status.status === 'ERROR') {
            progress = 0
          }

          return {
            ...status,
            progress,
          }
        }),
        takeWhile(
          (result) => result.status !== 'FINISHED' && result.status !== 'ERROR',
          true, // 包含最后一个值
        ),
      )
    }),
    catchError((error) =>
      of({
        taskId: '',
        status: 'ERROR' as const,
        error: error instanceof Error ? error.message : String(error),
        progress: 0,
      }),
    ),
  )
}
