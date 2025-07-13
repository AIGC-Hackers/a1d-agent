import { type } from 'arktype'

/*
 * ARKTYPE PATTERN GUIDE - COMPREHENSIVE SCHEMA DEFINITION PATTERNS
 *
 * This file provides comprehensive patterns for defining schemas with arktype.
 * Each pattern includes a one-line example with detailed comments explaining
 * the syntax and behavior, specifically designed to teach AI assistants.
 *
 * KEY PRINCIPLE: OPTIONAL FIELDS vs DEFAULT VALUES
 * - Use 'field?' for truly optional fields (can be undefined)
 * - Use 'field = value' for fields with default values (becomes optional in input)
 * - NEVER use both 'field?' and '.default()' together
 *
 * CRITICAL: COMPARISON OPERATORS IN ARKTYPE
 * - Half-open: 'it cmp num' → 'number > 10', 'string > 5', 'array > 2'
 * - Full-open: 'num1 cmp it cmp num2' → '0 < number < 100', '5 < string < 500'
 * - NEVER use <= or >= in type expressions (not supported)
 * - Use < and > only for constraints
 * - AI MUST INTERNALIZE: Always use < and > operators, never <= or >=
 */

// =============================================================================
// BASIC TYPES
// =============================================================================

// String types
const stringSchema = type({
  name: 'string', // Required string field
  'description?': 'string', // Optional string field (can be undefined)
  title: 'string = "Untitled"', // String with default value (optional in input)
})

// Number types
const numberSchema = type({
  age: 'number', // Any number
  'score?': 'number', // Optional number
  rating: 'number = 5', // Number with default value
  count: 'number.integer', // Integer only
  'id?': 'number.integer', // Optional integer
})

// Boolean types
const booleanSchema = type({
  isActive: 'boolean', // Required boolean
  'isPublic?': 'boolean', // Optional boolean
  enabled: 'boolean = true', // Boolean with default value
})

// =============================================================================
// CONSTRAINED TYPES
// =============================================================================

// Number ranges
const numberRangeSchema = type({
  percentage: '0 < number < 100', // Number between 0 and 100 (exclusive)
  'priority?': '1 < number.integer < 10', // Optional integer between 1 and 10 (exclusive)
  temperature: 'number > -273.15', // Number with minimum value (half-open)
  score: 'number < 1000', // Number with maximum value (half-open)
  guidance: '1 < number < 30 = 7.5', // Constrained number with default
})

// String constraints
const stringConstraintSchema = type({
  username: 'string > 3', // Minimum length > 3 (half-open)
  password: 'string > 8', // Minimum length > 8 (half-open)
  tweet: 'string < 280', // Maximum length < 280 (half-open)
  description: '10 < string < 500', // Length between 10 and 500 (full-open)
  prompt: 'string < 2000 = "Default prompt"', // Constrained string with default
})

// =============================================================================
// LITERAL TYPES AND UNIONS
// =============================================================================

// String literals
const literalSchema = type({
  status: '"pending" | "completed" | "failed"', // Union of string literals
  'priority?': '"low" | "medium" | "high"', // Optional union
  level: '"easy" | "medium" | "hard" = "medium"', // Union with default
})

// Number literals
const numberLiteralSchema = type({
  duration: '5 | 10 | 15', // Union of number literals
  'version?': '1 | 2 | 3', // Optional number union
  format: '720 | 1080 | 4320 = 1080', // Number union with default
})

// Mixed literals
const mixedLiteralSchema = type({
  mode: '"auto" | "manual" | 1 | 2', // Mixed string and number literals
  'setting?': '"on" | "off" | 0 | 1', // Optional mixed union
})

// =============================================================================
// OBJECT TYPES
// =============================================================================

// Nested objects
const nestedObjectSchema = type({
  user: {
    id: 'number.integer',
    name: 'string >= 1',
    'email?': 'string',
  },
  'metadata?': {
    // Optional nested object
    'created_at?': 'string',
    'updated_at?': 'string',
  },
  settings: {
    // Required nested object with defaults
    theme: '"light" | "dark" = "light"',
    notifications: 'boolean = true',
  },
})

// Object with flexible keys
const flexibleObjectSchema = type({
  data: 'object', // Any object
  'config?': 'object', // Optional object
  headers: 'Record<string, string>', // String to string mapping
})

// =============================================================================
// ARRAY TYPES
// =============================================================================

// Array types
const arraySchema = type({
  tags: 'string[]', // Array of strings
  'scores?': 'number[]', // Optional array of numbers
  ids: 'number.integer[]', // Array of integers
  'statuses?': '("active" | "inactive")[]', // Array of literal unions
})

// Array with constraints
const constrainedArraySchema = type({
  items: 'string[] > 0', // Non-empty array (length > 0)
  'options?': 'string[] < 10', // Array with max length < 10
  values: '2 < number[] < 5', // Array length between 2 and 5 (full-open)
})

// Tuple types (fixed-length arrays)
const tupleSchema = type({
  coordinates: ['number', 'number'], // Exactly 2 numbers
  'rgb?': ['number', 'number', 'number'], // Optional RGB tuple
  point3d: ['number', 'number', 'number = 0'], // Tuple with default
})

// =============================================================================
// ADVANCED PATTERNS
// =============================================================================

// Conditional types with narrow()
const conditionalSchema = type({
  email: type('string').narrow(
    (it, ctx) => it.includes('@') || ctx.reject('must be valid email'),
  ),
  file: type('File').narrow(
    (it, ctx) =>
      it.size <= 10 * 1024 * 1024 || ctx.reject('file must be less than 10MB'),
  ),
})

// Complex combinations
const complexSchema = type({
  // API endpoint definition
  endpoint: 'string',
  method: '"GET" | "POST" | "PUT" | "DELETE" = "GET"',
  'headers?': 'Record<string, string>',
  'timeout?': '1000 <= number.integer <= 30000',
  retries: '0 <= number.integer <= 5 = 3',

  // File upload
  'files?': type('File[]').narrow(
    (files, ctx) =>
      files.every((f) => f.size <= 5 * 1024 * 1024) ||
      ctx.reject('all files must be less than 5MB'),
  ),

  // Nested configuration
  config: {
    'cache?': 'boolean',
    'compression?': '"gzip" | "deflate" | "br"',
    limits: {
      'maxRequests?': 'number.integer >= 1',
      'windowMs?': 'number.integer >= 1000',
    },
  },
})

// =============================================================================
// REAL-WORLD API PATTERNS
// =============================================================================

// Image generation API
const imageGenSchema = type({
  prompt: 'string <= 2000', // Required prompt with length limit
  'negative_prompt?': 'string <= 1000', // Optional negative prompt
  width: '256 <= number.integer <= 2048 = 1024', // Width with range and default
  height: '256 <= number.integer <= 2048 = 1024', // Height with range and default
  steps: '1 <= number.integer <= 150 = 50', // Inference steps with default
  guidance_scale: '1 <= number <= 30 = 7.5', // Guidance scale with default
  'seed?': 'number.integer', // Optional seed
  format: '"jpeg" | "png" = "jpeg"', // Output format with default
})

// Video generation API
const videoGenSchema = type({
  prompt: '10 < string < 2000', // Required prompt with min/max length
  'image?': 'string', // Optional image URL
  duration: '2 | 4 | 6 | 8 = 4', // Duration options with default
  aspect_ratio: '"16:9" | "9:16" | "1:1" = "16:9"', // Aspect ratio with default
  'movement_amplitude?': '"small" | "medium" | "large"', // Optional movement control
  fps: '12 < number.integer < 60 = 24', // FPS with range and default
  'seed?': '-1 < number.integer < 9999999999', // Optional seed with range
})

// Third-party service response
const serviceResponseSchema = type({
  success: 'boolean', // Required success flag
  message: 'string', // Required message
  data: {
    // Required data object
    id: 'string', // Task ID
    status: '"pending" | "processing" | "completed" | "failed"', // Task status
    'result_urls?': 'string[]', // Optional result URLs
    'error_message?': 'string', // Optional error message
    'metadata?': 'object', // Optional metadata
  },
  'request_id?': 'string', // Optional request ID
  'billing_info?': {
    // Optional billing info
    'cost?': 'number >= 0', // Optional cost
    'credits_used?': 'number.integer >= 0', // Optional credits used
  },
})

// =============================================================================
// EXPORT PATTERNS FOR REUSE
// =============================================================================

/*
 * TYPE INFERENCE PATTERNS:
 *
 * 1. t.infer vs t.inferIn vs t.inferOut
 *    - t.infer = alias for t.inferOut (default, most common)
 *    - t.inferOut = output type after schema validation & defaults applied
 *    - t.inferIn = input type before schema validation (raw input)
 *
 * 2. When to use which:
 *    - typeof schema.inferIn = for outermost layer (REST API body, form data, user input)
 *    - typeof schema.infer = for function parameters (after schema validation)
 *    - typeof schema.inferOut = explicit output type (same as .infer)
 *
 * 3. Real-world flow:
 *    - REST API receives data: inferIn type
 *    - Schema validates & transforms: inferIn → inferOut
 *    - Internal functions receive: inferOut type as parameters
 *    - Most function parameters use: typeof schema.infer (inferOut)
 */

// Export schema and inferred types
export const exampleSchema = imageGenSchema
export type ExampleInputRaw = typeof exampleSchema.inferIn // Raw user input (REST API body)
export type ExampleInput = typeof exampleSchema.inferOut // Validated data (function parameters)

// Generic model registry pattern
export const modelRegistry = {
  'text-to-image': {
    endpoint: '/api/v1/text-to-image',
    input: imageGenSchema,
    description: 'Generate images from text prompts',
  },
  'image-to-video': {
    endpoint: '/api/v1/image-to-video',
    input: videoGenSchema,
    description: 'Generate videos from images and prompts',
  },
} as const

export type ModelKey = keyof typeof modelRegistry
export type ModelInputRaw<T extends ModelKey> =
  (typeof modelRegistry)[T]['input']['inferIn'] // API body type
export type ModelInput<T extends ModelKey> =
  (typeof modelRegistry)[T]['input']['infer'] // Function parameter type

/*
 * KEY TAKEAWAYS FOR AI ASSISTANTS:
 *
 * 1. FIELD OPTIONALITY:
 *    - 'field?' = truly optional (can be undefined in input)
 *    - 'field = value' = has default (optional in input, never undefined in output)
 *    - NEVER use both 'field?' and '= value' together
 *
 * 2. STRING CONSTRAINTS:
 *    - 'string >= 5' = minimum length
 *    - 'string <= 100' = maximum length
 *    - 'string >= 5 & <= 100' = length range
 *
 * 3. NUMBER CONSTRAINTS:
 *    - '0 <= number <= 100' = range constraint
 *    - 'number.integer' = integers only
 *    - '1 <= number.integer <= 10' = integer range
 *
 * 4. UNIONS AND LITERALS:
 *    - '"a" | "b" | "c"' = string literal union
 *    - '1 | 2 | 3' = number literal union
 *    - '"auto" | 1 | true' = mixed type union
 *
 * 5. COMPLEX TYPES:
 *    - 'string[]' = array of strings
 *    - 'Record<string, number>' = object with string keys and number values
 *    - 'object' = any object
 *    - Use .narrow() for custom validation logic
 *
 * 6. DEFAULTS WITH TYPES:
 *    - 'number = 5' = number with default 5
 *    - '"a" | "b" = "a"' = union with default "a"
 *    - '1 <= number <= 10 = 5' = constrained number with default 5
 */

// =============================================================================
// TYPE SCOPE PATTERNS - MODULE CREATION & REUSABLE TYPE DEFINITIONS
// =============================================================================

/*
 * TYPE.SCOPE FUNDAMENTALS:
 *
 * type.scope() creates a type module with reusable type definitions.
 * It allows you to:
 * 1. Define shared types within a scope
 * 2. Reference types by name within the scope
 * 3. Export specific types for external use
 * 4. Create complex hierarchical type structures
 * 5. Avoid repetition and improve maintainability
 *
 * KEY PRINCIPLES:
 * - Define reusable types at the scope level
 * - Use PascalCase for type names (convention)
 * - Export types with $.export() to get inferred types
 * - Reference scope types by name in string literals
 * - Reference the root scope in Lambda to add more information to fields using chained syntax.
 */

// Media processing scope (real-world example)
const $ = type.scope({
  // Base constraints
  Dimension: '64 < number.integer < 4096',
  Duration: '1 < number < 300',
  Quality: '0.1 < number < 1.0',

  // Format enums
  ImageFormat: '"jpeg" | "png" | "webp" | "avif"',
  VideoFormat: '"mp4" | "webm" | "mov"',
  AudioFormat: '"mp3" | "wav" | "aac" | "flac"',

  // Aspect ratios
  AspectRatio: '"1:1" | "4:3" | "16:9" | "21:9" | "9:16"',

  // Processing configs
  ImageConfig: {
    width: 'Dimension = 1024',
    height: 'Dimension = 1024',
    format: 'ImageFormat = "jpeg"',
    quality: 'Quality = 0.8',
  },

  VideoConfig: {
    width: 'Dimension',
    height: 'Dimension',
    duration: 'Duration = 10',
    fps: '12 < number.integer < 60 = 24',
    format: 'VideoFormat = "mp4"',
    aspect_ratio: 'AspectRatio = "16:9"',
  },

  // Unified media request
  MediaRequest: {
    type: '"image" | "video" | "audio"',
    prompt: 'string > 10',
    'image_config?': 'ImageConfig',
    'video_config?': () => $.type('VideoConfig').describe('...'),
    'callback_url?': 'string',
  },
})

// Export patterns for external usage
const types = $.export()

export type MediaRequestInput = typeof types.MediaRequest.inferIn
export type MediaRequest = typeof types.MediaRequest.infer
export type ImageConfig = typeof types.ImageConfig.infer
export type VideoConfig = typeof types.VideoConfig.infer

/*
 * TYPE.SCOPE BEST PRACTICES FOR AI ASSISTANTS:
 *
 * 1. SCOPE ORGANIZATION:
 *    - Group related types in a single scope
 *    - Use descriptive scope names (apiScope, mediaScope, etc.)
 *    - Keep scopes focused on specific domains
 *
 * 2. TYPE NAMING CONVENTIONS:
 *    - PascalCase for type names (UserId, ImageFormat)
 *    - Descriptive names that indicate purpose
 *    - Suffix with 'Config', 'Request', 'Response' for clarity
 *
 * 3. TYPE REUSABILITY:
 *    - Define primitive constraints once (Dimension, Duration)
 *    - Create enum-like unions for repeated values
 *    - Build complex types from simpler ones
 *
 * 4. CONSTRAINT PATTERNS:
 *    - Use meaningful bounds (64 < width < 4096 for images)
 *    - Provide sensible defaults (quality = 0.8)
 *    - Document ranges in comments when not obvious
 *
 * 5. EXPORT STRATEGIES:
 *    - Export scope with .export() to get TypeScript types
 *    - Use .inferIn for raw input validation
 *    - Use .infer/.inferOut for processed data
 *
 * 6. REAL-WORLD INTEGRATION:
 *    - Create scopes for external API integrations
 *    - Mirror API documentation structure
 *    - Handle optional fields and defaults properly
 *
 * 7. COMMON SCOPE PATTERNS:
 *    ```typescript
 *    const $ = type.scope({
 *      // Primitive constraints
 *      Id: 'string',
 *      Count: 'number.integer > 0',
 *
 *      // Enums
 *      Status: '"active" | "inactive"',
 *
 *      // Complex types using primitives
 *      Entity: {
 *        id: 'Id',
 *        count: 'Count = 1',
 *        status: 'Status = "active"',
 *      }
 *    })
 *
 *    const types = $.export()
 *    export type EntityInput = typeof types.Entity.inferIn
 *    ```
 */
