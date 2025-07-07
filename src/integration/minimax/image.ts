import { Observable, switchMap, takeWhile, timer } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

import type { MinimaxContext } from './config'
import { getMinimaxHeaders } from './config'

export type SubjectReference = {
  type: 'character'
  image_file: string // Base64 encoded string or a public URL
}

// Pattern: Use TypeScript types for API contracts
export type ImageGenerationInput = {
  prompt: string // Please provide a description for the image you want to generate. (Note: The description should not exceed 1500 characters.)
  model: string // model ID you can choose. e.g. image-01
  subject_reference?: SubjectReference[] // The model will generate a image based on the subject uploaded through this parameter. Currently, only a single subject reference is supported (array length is 1).
  aspect_ratio?:
    | '1:1'
    | '16:9'
    | '4:3'
    | '3:2'
    | '2:3'
    | '3:4'
    | '9:16'
    | '21:9' // Controls the aspect ratio of the generated image. Default: 1:1
  width?: number // Specifies the generated image width in pixels. Valid range: [512, 2048].
  height?: number // Specifies the generated height width in pixels. Valid range: [512, 2048].
  response_format?: 'url' | 'base64' // Controls the output format of the generated image. Default: url.
  seed?: number // Random Seed.
  n?: number // Controls the number of images generated per single request. Value range: [1, 9]. Default value: 1.
  prompt_optimizer?: boolean // Controls whether to enable automatic prompt optimization. Default: false.
}

export type ImageGenerationOutput = {
  task_id?: string // For async generation
  status: 'submitted' | 'processing' | 'completed' | 'failed'
  images?: Array<{
    url: string
    revised_prompt?: string // Optimized prompt if enabled
  }>
  error?: {
    code: string
    message: string
  }
}

// Submit image generation task
export function generateImage(
  input: ImageGenerationInput,
  context: MinimaxContext,
): Observable<ImageGenerationOutput> {
  const url = `${context.baseUrl}/text_to_image`

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
            `Image generation failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
          )
        }
        throw new Error(
          `Image generation failed: ${response.status} ${response.statusText}`,
        )
      }
      return response.json() as Promise<ImageGenerationOutput>
    }),
  )
}

// Pattern: Polling for image generation status (if async)
export type ImageTaskStatus = {
  task_id: string
  status: 'processing' | 'completed' | 'failed'
  progress?: number // 0-100
  images?: Array<{
    url: string
    revised_prompt?: string
  }>
  error?: {
    code: string
    message: string
  }
}

export function pollImageTask(
  params: {
    taskId: string
    pollInterval?: number
  },
  context: MinimaxContext,
): Observable<ImageTaskStatus> {
  const { taskId, pollInterval = 3000 } = params
  const url = `${context.baseUrl}/query/text_to_image/${taskId}`

  return timer(0, pollInterval).pipe(
    switchMap(() =>
      fromFetch(url, {
        method: 'GET',
        headers: getMinimaxHeaders(context),
      }).pipe(
        switchMap(async (response) => {
          if (!response.ok) {
            throw new Error(
              `Query image task failed: ${response.status} ${response.statusText}`,
            )
          }
          return response.json() as Promise<ImageTaskStatus>
        }),
      ),
    ),
    takeWhile(
      (task) => task.status === 'processing',
      true, // Emit final state
    ),
  )
}

// Higher-level function that handles both sync and async responses
export function generateImageStream(
  input: ImageGenerationInput,
  context: MinimaxContext,
  options?: {
    pollInterval?: number
    onProgress?: (progress: number) => void
  },
): Observable<ImageGenerationOutput | ImageTaskStatus> {
  return generateImage(input, context).pipe(
    switchMap((result) => {
      // If we got images directly, we're done
      if (result.images && result.images.length > 0) {
        return [result]
      }

      // If failed immediately
      if (result.status === 'failed') {
        return [result]
      }

      // Otherwise poll for completion
      if (result.task_id) {
        return pollImageTask(
          {
            taskId: result.task_id,
            pollInterval: options?.pollInterval,
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
      }

      throw new Error('No images or task ID in response')
    }),
  )
}
