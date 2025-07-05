import { env } from '@/lib/env'
import { GenerateContentResponse, GoogleGenAI } from '@google/genai'

export const enum GeminiModel {
  GEMINI_25_PRO = 'gemini-2.5-pro',

  GEMINI_25_FLASH = 'gemini-2.5-flash',

  GEMINI_25_FLASH_LITE = 'gemini-2.5-flash-lite-preview-06-17',
}

export function createGoogleGenAIClient() {
  const genai = new GoogleGenAI({ apiKey: env.value.GEMINI_API_KEY })

  return genai
}

export const geminiCliHttpOptions = () => ({
  headers: {
    'User-Agent': `GeminiCLI/${process.version} (${process.platform}; ${process.arch})`,
  },
})

export function getResponseText(
  response: GenerateContentResponse,
): string | undefined {
  const parts = response.candidates?.[0]?.content?.parts
  if (!parts) {
    return undefined
  }
  const textSegments = parts
    .map((part) => part.text)
    .filter((text): text is string => typeof text === 'string')

  if (textSegments.length === 0) {
    return undefined
  }
  return textSegments.join('')
}
