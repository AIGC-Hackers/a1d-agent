import { generateText } from 'ai'
import { describe, expect, it } from 'vitest'

import { huiyan, LanguageModel } from './llm'

describe('Huiyan LLM Integration', () => {
  describe('API Integration', () => {
    it('should work with GPT-4o-mini', async () => {
      const model = huiyan(LanguageModel.GPT_4O_MINI)

      const result = await generateText({
        model,
        prompt: 'Respond with just "OK"',
        maxTokens: 10,
      })

      expect(result.text).toBeTruthy()
      console.log(`${LanguageModel.GPT_4O_MINI} response:`, result.text)
    }, 10000)
  })
})
