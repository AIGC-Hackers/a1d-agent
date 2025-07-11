import {
  createGoogleGenAIClient,
  GeminiModel,
  getResponseText,
} from '@/integration/google-genai'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

type GroundingChunkWeb = {
  uri?: string
  title?: string
}

type GroundingChunkItem = {
  web?: GroundingChunkWeb
}

type GroundingSupportSegment = {
  startIndex: number
  endIndex: number
  text?: string
}

type GroundingSupportItem = {
  segment?: GroundingSupportSegment
  groundingChunkIndices?: number[]
  confidenceScores?: number[]
}

type GoogleSearchToolResult = {
  llmContent: string
  returnDisplay: string
  sources: GroundingChunkItem[]
}

export const googleSearchTool = createTool({
  id: 'google-search',
  description:
    'Instructs Gemini model to perform deep web search and return comprehensive results. Supports complex queries and multi-question searches.',
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        'Search query content, can be complex instructions or multiple related questions.',
      ),
  }),
  execute: async ({ context: input }): Promise<GoogleSearchToolResult> => {
    const genai = createGoogleGenAIClient()

    const response = await genai.models.generateContent({
      model: GeminiModel.GEMINI_25_FLASH_LITE,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: input.query,
            },
          ],
        },
      ],
      config: {
        tools: [
          {
            googleSearch: {},
          },
        ],
      },
    })

    const responseText = getResponseText(response)?.trim() ?? ''

    const notFound = {
      llmContent: `No search results or information found for query: "${input.query}"`,
      returnDisplay: 'No information found.',
      sources: [],
    }

    if (!responseText) {
      return notFound
    }

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata
    const sources = groundingMetadata?.groundingChunks as
      | GroundingChunkItem[]
      | undefined
    const groundingSupports = groundingMetadata?.groundingSupports as
      | GroundingSupportItem[]
      | undefined

    let modifiedResponseText = responseText
    const sourceListFormatted: string[] = []

    if (sources && sources.length > 0) {
      sources.forEach((source: GroundingChunkItem, index: number) => {
        const title = source.web?.title || 'Untitled'
        const uri = source.web?.uri || 'No URI'
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

        // Sort insertions by index in descending order to avoid shifting subsequent indices
        insertions.sort((a, b) => b.index - a.index)

        const responseChars = modifiedResponseText.split('') // Use new variable
        insertions.forEach((insertion) => {
          // Fixed arrow function syntax
          responseChars.splice(insertion.index, 0, insertion.marker)
        })
        modifiedResponseText = responseChars.join('') // Assign back to modifiedResponseText
      }

      if (sourceListFormatted.length > 0) {
        modifiedResponseText +=
          '\n\nSources:\n' + sourceListFormatted.join('\n') // Fixed string concatenation
      }

      return {
        llmContent: `Web search results for "${input.query}":\n\n${modifiedResponseText}`,
        returnDisplay: 'Done.',
        sources,
      }
    }

    return notFound
  },
})
