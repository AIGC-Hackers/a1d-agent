import { env } from '@/lib/env'
import { createOpenAI } from '@ai-sdk/openai'

const baseUrl = 'https://api.302.ai/v1'

const create = (model: X302Model) =>
  createOpenAI({
    baseURL: baseUrl,
    apiKey: env.value.X_302_API_KEY,
  })(model)

export const enum X302Model {
  OPENAI_GPT_4_PLUS = 'gpt-4-plus',
  OPENAI_GPT_4O_IMAGE_GENERATION = 'gpt-4o-image-generation',

  OPENAI_O4_MINI_DEEP_RESEARCH = 'o4-mini-deep-research',
  OPENAI_O3_DEEP_RESEARCH = 'o3-deep-research',

  ANTHROPIC_CLAUDE_SONNET_4 = 'claude-sonnet-4-20250514',
  ANTHROPIC_CLAUDE_OPUS_4 = 'claude-opus-4-20250514',
}

export const x302 = (modelId: X302Model) => create(modelId)

type RecraftStyles =
  | 'digital_illustration/pixel_art'
  | 'digital_illustration/hand_drawn'
  | 'digital_illustration/grain'
  | 'digital_illustration/infantile_sketch'
  | 'digital_illustration/2d_art_poster'
  | 'digital_illustration/handmade_3d'
  | 'digital_illustration/hand_drawn_outline'
  | 'digital_illustration/engraving_color'
  | 'digital_illustration/2d_art_poster_2'
  | 'vector_illustration/engraving'
  | 'vector_illustration/line_art'
  | 'vector_illustration/line_circuit'
  | 'vector_illustration/linocut'

export const generateImage = {
  createMidjourneyJob: (
    input: {},
    ctx: {
      token: string
    },
  ) =>
    fetch(`https://api.302.ai/mj/submit/imagine`, {
      method: 'POST',
      headers: {
        'mj-api-secret': ctx.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    }).then((it) => it.json()),
  getMidjourneyJob: (id: string, ctx: { token: string }) =>
    fetch(`https://api.302.ai/mj/task/${id}/fetch`, {
      method: 'GET',
      headers: {
        'mj-api-secret': ctx.token,
        'Content-Type': 'application/json',
      },
    }).then((it) => it.json()),
  recraft: (
    input: {
      style: RecraftStyles
    },
    ctx: {
      token: string
    },
  ) =>
    fetch('https://api.302.ai/302/submit/recraft-v3', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.token}`,
      },
      body: JSON.stringify(input),
    }).then((it) => it.json()),
}
