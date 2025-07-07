import { Observable, switchMap, timer, takeWhile } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import type { MinimaxContext } from './config'
import { getMinimaxHeaders } from './config'

// Pattern: Use TypeScript types for API contracts
export type VideoGenerationInput = {
  prompt: string // Text description for video generation
  model?: 'video-01' | 'video-02' // Model version
  first_frame_image?: string // Base64 or URL of first frame (for video extension)
  prompt_optimizer?: boolean // Enable prompt optimization
}

export type VideoGenerationOutput = {
  task_id: string
  status: 'submitted' | 'processing' | 'completed' | 'failed'
  created_at: number
  video_url?: string
  cover_image_url?: string
  error?: {
    code: string
    message: string
  }
}

// Submit video generation task
export function generateVideo(
  input: VideoGenerationInput,
  context: MinimaxContext,
): Observable<VideoGenerationOutput> {
  const url = `${context.baseUrl}/video_generation`

  return fromFetch(url, {
    method: 'POST',
    headers: getMinimaxHeaders(context),
    body: JSON.stringify({
      ...input,
      group_id: context.groupId,
    }),
  }).pipe(
    switchMap(async (response) => {
      if (!response.ok) {
        const text = await response.text()
        if (import.meta.env.DEV) {
          console.error(
            `Video generation failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
          )
        }
        throw new Error(
          `Video generation failed: ${response.status} ${response.statusText}`,
        )
      }
      return response.json() as Promise<VideoGenerationOutput>
    }),
  )
}

// Pattern: Polling for video generation status
export type VideoTaskStatus = {
  task_id: string
  status: 'processing' | 'completed' | 'failed'
  progress?: number // 0-100
  video_url?: string
  cover_image_url?: string
  duration?: number // Video duration in seconds
  resolution?: {
    width: number
    height: number
  }
  error?: {
    code: string
    message: string
  }
}

export function pollVideoTask(
  params: {
    taskId: string
    pollInterval?: number
  },
  context: MinimaxContext,
): Observable<VideoTaskStatus> {
  const { taskId, pollInterval = 5000 } = params
  const url = `${context.baseUrl}/query/video_generation/${taskId}`

  return timer(0, pollInterval).pipe(
    switchMap(() =>
      fromFetch(url, {
        method: 'GET',
        headers: getMinimaxHeaders(context),
      }).pipe(
        switchMap(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Query video task failed: ${response.status} ${response.statusText}`,
            )
          }
          return response.json() as Promise<VideoTaskStatus>
        }),
      ),
    ),
    takeWhile(
      (task) => task.status === 'processing',
      true, // Emit final state
    ),
  )
}

// Higher-level function that combines submission and polling
export function generateVideoStream(
  input: VideoGenerationInput,
  context: MinimaxContext,
  options?: {
    pollInterval?: number
    onProgress?: (progress: number) => void
  },
): Observable<VideoGenerationOutput | VideoTaskStatus> {
  return generateVideo(input, context).pipe(
    switchMap((result) => {
      if (result.status === 'failed') {
        return [result]
      }

      // Poll for completion
      return pollVideoTask(
        { 
          taskId: result.task_id, 
          pollInterval: options?.pollInterval 
        },
        context,
      ).pipe(
        switchMap((status) => {
          // Call progress callback if provided
          if (options?.onProgress && status.progress !== undefined) {
            options.onProgress(status.progress)
          }
          return [status]
        }),
      )
    }),
  )
}