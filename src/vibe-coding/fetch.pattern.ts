import { type } from 'arktype'
import { switchMap, takeWhile, timer } from 'rxjs'
import { fromFetch } from 'rxjs/fetch'

/*
 * CRITICAL AI GUIDANCE - READ BEFORE IMPLEMENTING ANY API INTEGRATION
 *
 * 1. NEVER ABSTRACT FETCH: Always use fromFetch directly with standard RequestInit
 *    - Different APIs need different body types (JSON, FormData, URLSearchParams)
 *    - Custom headers, auth methods, content types vary per endpoint
 *    - Generic request wrappers create more bugs than they solve
 *
 * 2. PARAMETER DESIGN: Separate context from business data
 *    - context: authentication, configuration (company-level, reusable)
 *    - input: business logic parameters (endpoint-specific)
 *    - NEVER mix auth tokens with business data in same object
 *
 * 3. SCHEMA vs TYPESCRIPT TYPES - MINIMAL SCHEMA APPROACH:
 *
 *    PREFER TYPESCRIPT TYPES FOR:
 *    - Internal function parameters (already type-safe)
 *    - Configuration objects (known at compile time)
 *    - Component props (React already validates)
 *    - Database models (ORM handles validation)
 *    - API response structures (trust the API contract)
 *    - Simple data structures without complex constraints
 *
 *    ONLY USE ARKTYPE SCHEMA FOR:
 *    - Cross-boundary validation (client/server communication)
 *    - User input with complex business rules (file size limits, number ranges)
 *    - Data transformation requirements (parsing, morphing)
 *    - Untrusted external data sources
 *
 *    RULE OF THUMB: Start with TypeScript types. Add schema only when runtime validation is essential.
 *
 * 4. ERROR HANDLING: Keep it simple and direct
 *    - Check response.ok, throw descriptive errors
 *    - Let errors bubble up, don't catch and re-throw
 *    - Use JSON.parse() for simple cases, schema.assert() only when validation needed
 *
 * 5. NAMING CONVENTIONS:
 *    - Types: {ServiceName}{Operation}Input / {ServiceName}{Operation}Output
 *    - Context: {ServiceName}Context (company-level, not operation-specific)
 *    - Functions: verb + noun (generateImage, uploadFile, pollFineTuningJob)
 *
 * 6. POLLING PATTERNS: Use timer + switchMap + takeWhile
 *    - timer(0, interval) for immediate start + regular polling
 *    - switchMap to cancel previous requests (prevents request buildup)
 *    - takeWhile(condition, true) to emit final completion state
 *
 * 7. REAL-WORLD CONSIDERATIONS:
 *    - Model actual API response structures accurately
 *    - Include optional fields, nested objects, union types
 *    - Use descriptive business domain names, not generic ones
 *    - Trust TypeScript for internal type safety, validate only at boundaries
 */

// Pattern: Use TypeScript types for API contracts - trust the API documentation
// AI guidance: Model the actual API response structure with good field comments
export type ImageGenerationInput = {
  prompt: string
  width?: number // 320-1024 pixels
  height?: number // 320-1024 pixels
  quality?: 'standard' | 'hd'
}

export type ImageGenerationOutput = {
  id: string
  url: string
  status: 'processing' | 'completed' | 'failed'
  metadata?: {
    width?: number
    height?: number
    created_at?: string
  }
}

// Pattern: Define context/config type for API client configuration
// AI guidance: Separate authentication and configuration from business logic parameters
export type OpenAIContext = {
  apiKey: string
  baseUrl?: string
}

const baseUrl = 'https://api.openai.com/v1'

// Pattern: Simple response handler - no schema validation for internal APIs
// AI guidance: Keep response handling simple, trust TypeScript types
async function handleJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (import.meta.env.DEV) {
      const text = await response.text()
      console.error(
        `API request failed: ${response.status} ${response.statusText}\n<response>\n${text}</response>`,
      )
    }
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    )
  }
  return response.json()
}

// Pattern: API client function with minimal validation
// AI guidance: Separate authentication config from request data, trust TypeScript types
export function generateImage(
  input: ImageGenerationInput,
  context: OpenAIContext,
) {
  return fromFetch(`${context.baseUrl ?? baseUrl}/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.apiKey}`,
    },
    body: JSON.stringify(input),
  }).pipe(
    switchMap((response) =>
      handleJsonResponse<ImageGenerationOutput>(response),
    ),
  )
}

// Pattern: Example with FormData - demonstrates why generic request wrappers are problematic
// AI guidance: Different content types require different body handling - stay explicit
// Only use schema validation for user input with business constraints
const fileUploadInputSchema = type({
  file: type('File').narrow(
    (it, ctx) =>
      it.size <= 1024 * 1024 * 10 || ctx.reject('file must be less than 10MB'),
  ),
  'purpose?': 'string',
})

export type FileUploadInput = typeof fileUploadInputSchema.infer

export type FileUploadOutput = {
  id: string
  filename: string
  bytes: number
  purpose: string
}

export function uploadFile(input: FileUploadInput, context: OpenAIContext) {
  // Validate user input with business rules (file size constraint)
  const validatedInput = fileUploadInputSchema.assert(input)

  const formData = new FormData()
  formData.append('file', validatedInput.file)
  if (validatedInput.purpose) {
    formData.append('purpose', validatedInput.purpose)
  }

  return fromFetch(`${context.baseUrl ?? baseUrl}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${context.apiKey}`,
    },
    body: formData,
  }).pipe(
    switchMap((response) => handleJsonResponse<FileUploadOutput>(response)),
  )
}

// Pattern: Polling API for long-running tasks - submit job then poll for completion
// AI guidance: Use timer + switchMap + takeWhile pattern for polling
export type FineTuningJobStatus = {
  id: string
  object: 'fine_tuning.job'
  model: string
  created_at: number
  finished_at: number | null
  fine_tuned_model: string | null
  status:
    | 'validating_files'
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
  trained_tokens: number | null
  error?: {
    code: string
    message: string
  }
}

export function pollFineTuningJob(
  params: {
    jobId: string
    pollInterval?: number // milliseconds between polls
  },
  context: OpenAIContext,
) {
  const { jobId, pollInterval = 5000 } = params

  return timer(0, pollInterval).pipe(
    switchMap(() =>
      fromFetch(`${context.baseUrl ?? baseUrl}/fine_tuning/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${context.apiKey}`,
        },
      }).pipe(
        switchMap((response) =>
          handleJsonResponse<FineTuningJobStatus>(response),
        ),
      ),
    ),
    takeWhile(
      (job) =>
        job.status === 'validating_files' ||
        job.status === 'queued' ||
        job.status === 'running',
      true,
    ),
  )
}
