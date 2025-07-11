import { Observable, switchMap, takeWhile, timer } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import type { MinimaxContext } from './config'
import { getMinimaxHeaders } from './config'

// Pattern: Use TypeScript types for API contracts based on official documentation

export type VideoGenerationInput = {
  model: 'MiniMax-Hailuo-02' // Only support MiniMax-Hailuo-02
  prompt: string // Text description for video generation (max 2000 chars)
  prompt_optimizer?: boolean // Default: true
  duration?: 6 | 10 // Video duration in seconds
  resolution?: '768P' | '1080P' // Video resolution
  first_frame_image?: string // Base64 or URL of first frame (optional for MiniMax-Hailuo-02)
  callback_url?: string // Optional callback URL for status updates
}

export type VideoBaseResp = {
  status_code: number
  status_msg: string
}

export type VideoGenerationOutput = {
  task_id: string
  base_resp: VideoBaseResp
}

// Submit video generation task
export function createVideoGenerationTask(
  input: VideoGenerationInput,
  context: MinimaxContext,
): Observable<VideoGenerationOutput> {
  const url = `${context.baseUrl}/v1/video_generation`

  return fromFetch(url, {
    method: 'POST',
    headers: {
      ...getMinimaxHeaders(context),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
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
  status: 'Queueing' | 'Preparing' | 'Processing' | 'Success' | 'Fail'
  file_id?: string // Available when status is 'Success'
  video_width?: number
  video_height?: number
  base_resp: VideoBaseResp
}

export function pollVideoTask(
  params: {
    taskId: string
    pollInterval?: number
  },
  context: MinimaxContext,
): Observable<VideoTaskStatus> {
  const { taskId, pollInterval = 5000 } = params
  const url = `${context.baseUrl}/v1/query/video_generation?task_id=${taskId}`

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
      (task) =>
        task.status === 'Processing' ||
        task.status === 'Preparing' ||
        task.status === 'Queueing',
      true, // Emit final state
    ),
  )
}

// File retrieval types
export type FileInfo = {
  file_id: number
  bytes: number
  created_at: number
  filename: string
  purpose: string
  download_url: string
}

export type FileRetrievalOutput = {
  file: FileInfo
  base_resp: VideoBaseResp
}

// Retrieve video file download URL
export function retrieveVideoFile(
  fileId: string,
  context: MinimaxContext,
): Observable<FileRetrievalOutput> {
  const url = `${context.baseUrl}/v1/files/retrieve?GroupId=${context.groupId}&file_id=${fileId}`

  return fromFetch(url, {
    method: 'GET',
    headers: {
      ...getMinimaxHeaders(context),
      'Content-Type': 'application/json',
    },
  }).pipe(
    switchMap(async (response) => {
      if (!response.ok) {
        throw new Error(
          `File retrieval failed: ${response.status} ${response.statusText}`,
        )
      }
      return response.json() as Promise<FileRetrievalOutput>
    }),
  )
}

// Higher-level function that combines submission and polling
export function generateVideoStream(
  input: VideoGenerationInput,
  context: MinimaxContext,
  options?: {
    pollInterval?: number
    onProgress?: (status: VideoTaskStatus) => void
  },
): Observable<VideoTaskStatus> {
  return createVideoGenerationTask(input, context).pipe(
    switchMap((result) => {
      if (result.base_resp.status_code !== 0) {
        throw new Error(
          `Video generation failed: ${result.base_resp.status_msg}`,
        )
      }

      // Poll for completion
      return pollVideoTask(
        {
          taskId: result.task_id,
          pollInterval: options?.pollInterval,
        },
        context,
      ).pipe(
        switchMap((status) => {
          // Call progress callback if provided
          if (options?.onProgress) {
            options.onProgress(status)
          }
          return [status]
        }),
      )
    }),
  )
}
