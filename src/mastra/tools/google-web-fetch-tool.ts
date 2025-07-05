import {
  createGoogleGenAIClient,
  GeminiModel,
  getResponseText,
} from '@/integration/google-genai'
import { sendEvent } from '@/server/event/publish'
import { createTool } from '@mastra/core'
import { z } from 'zod'

export type ToolResult = {
  success: boolean
  /**
   * Content meant to be included in LLM history.
   * This should represent the factual outcome of the tool execution.
   */
  llmContent: string

  /**
   * Markdown string for user display.
   * This provides a user-friendly summary or visualization of the result.
   * NOTE: This might also be considered UI-specific and could potentially be
   * removed or modified in a further refactor if the server becomes purely API-driven.
   * For now, we keep it as the core logic in ReadFileTool currently produces it.
   */
  returnDisplay: string
}
// Interfaces for grounding metadata (similar to web-search.ts)

type GroundingChunkWeb = {
  uri?: string
  title?: string
}

type GroundingChunkItem = {
  web?: GroundingChunkWeb
}
type GroundingSupportItem = {
  segment?: GroundingSupportSegment
  groundingChunkIndices?: number[]
}
type GroundingSupportSegment = {
  startIndex: number
  endIndex: number
  text?: string
}

export const googleWebFetchTool = createTool({
  id: 'google-web-fetch',
  description:
    "Processes content from URL(s), including local and private network addresses (e.g., localhost), embedded in a prompt. Include up to 20 URLs and instructions (e.g., summarize, extract specific data) directly in the 'prompt' parameter.",
  inputSchema: z.object({
    prompt: z
      .string()
      .describe(
        'A comprehensive prompt that includes the URL(s) (up to 20) to fetch and specific instructions on how to process their content (e.g., "Summarize https://example.com/article and extract key points from https://another.com/data"). Must contain as least one URL starting with http:// or https://.',
      ),
  }),
  execute: async ({ context: input, threadId, resourceId, runId }) => {
    const { prompt } = input
    if (threadId) {
      sendEvent('a1d-agent-toolcall', {
        threadId,
        resourceId,
        runId,
        toolId: 'google-web-fetch',
        toolInput: input,
      })
    }

    return fetchWebContent({ prompt })
  },
})

async function fetchWebContent(
  params: { prompt: string },
  signal?: AbortSignal,
): Promise<ToolResult> {
  const userPrompt = params.prompt
  const urls = extractUrls(userPrompt)
  const url = urls[0]
  const isPrivate = isPrivateIp(url)

  if (isPrivate) {
    return {
      success: false,
      llmContent: `Error: Private IP address detected`,
      returnDisplay: `Error: Private IP address detected`,
    }
  }

  const genai = createGoogleGenAIClient()

  try {
    const response = await genai.models.generateContent({
      model: GeminiModel.GEMINI_25_FLASH_LITE,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        tools: [{ urlContext: {} }],
        abortSignal: signal,
      },
    })

    console.debug(
      `[WebFetchTool] Full response for prompt "${userPrompt.substring(
        0,
        50,
      )}...":`,
      JSON.stringify(response, null, 2),
    )

    let responseText = getResponseText(response) || ''
    const urlContextMeta = response.candidates?.[0]?.urlContextMetadata
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata
    const sources = groundingMetadata?.groundingChunks as
      | GroundingChunkItem[]
      | undefined
    const groundingSupports = groundingMetadata?.groundingSupports as
      | GroundingSupportItem[]
      | undefined

    // Error Handling
    let processingError = false

    if (urlContextMeta?.urlMetadata && urlContextMeta.urlMetadata.length > 0) {
      const allStatuses = urlContextMeta.urlMetadata.map(
        (m) => m.urlRetrievalStatus,
      )
      if (allStatuses.every((s) => s !== 'URL_RETRIEVAL_STATUS_SUCCESS')) {
        processingError = true
      }
    } else if (!responseText.trim() && !sources?.length) {
      // No URL metadata and no content/sources
      processingError = true
    }

    if (
      !processingError &&
      !responseText.trim() &&
      (!sources || sources.length === 0)
    ) {
      // Successfully retrieved some URL (or no specific error from urlContextMeta), but no usable text or grounding data.
      processingError = true
    }

    if (processingError) {
      return {
        success: false,
        llmContent: `Error: Failed to fetch web content`,
        returnDisplay: `Error: Failed to fetch web content`,
      }
    }

    const sourceListFormatted: string[] = []
    if (sources && sources.length > 0) {
      sources.forEach((source: GroundingChunkItem, index: number) => {
        const title = source.web?.title || 'Untitled'
        const uri = source.web?.uri || 'Unknown URI' // Fallback if URI is missing
        sourceListFormatted.push(`[${index + 1}] ${title} (${uri})`)
      })

      if (groundingSupports && groundingSupports.length > 0) {
        const insertions: Array<{ index: number; marker: string }> = []
        groundingSupports.forEach((support: GroundingSupportItem) => {
          if (support.segment && support.groundingChunkIndices) {
            const citationMarker = support.groundingChunkIndices
              .map((chunkIndex: number) => `[${chunkIndex + 1}]`)
              .join('')
            insertions.push({
              index: support.segment.endIndex,
              marker: citationMarker,
            })
          }
        })

        insertions.sort((a, b) => b.index - a.index)
        const responseChars = responseText.split('')
        insertions.forEach((insertion) => {
          responseChars.splice(insertion.index, 0, insertion.marker)
        })
        responseText = responseChars.join('')
      }

      if (sourceListFormatted.length > 0) {
        responseText += `

Sources:
${sourceListFormatted.join('\n')}`
      }
    }

    const llmContent = responseText

    console.debug(
      `[WebFetchTool] Formatted tool response for prompt "${userPrompt}:\n\n":`,
      llmContent,
    )

    return {
      success: true,
      llmContent,
      returnDisplay: `Content processed from prompt.`,
    }
  } catch (error: unknown) {
    const errorMessage = `Error processing web content for prompt "${userPrompt.substring(
      0,
      50,
    )}...": ${getErrorMessage(error)}`
    console.error(errorMessage, error)
    return {
      success: false,
      llmContent: `Error: ${errorMessage}`,
      returnDisplay: `Error: ${errorMessage}`,
    }
  }
}

function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return text.match(urlRegex) || []
}

export function isPrivateIp(url: string): boolean {
  const PRIVATE_IP_RANGES = [
    /^10\./,
    /^127\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ]

  try {
    const hostname = new URL(url).hostname
    return PRIVATE_IP_RANGES.some((range) => range.test(hostname))
  } catch (_e) {
    return false
  }
}
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  try {
    return String(error)
  } catch {
    return 'Failed to get error details'
  }
}
