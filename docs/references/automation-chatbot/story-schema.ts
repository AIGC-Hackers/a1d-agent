import { z } from 'zod'

export const sceneSchema = z.object({
  scene_id: z
    .string()
    .describe(
      'A unique, sequential identifier for the scene, starting from "1". This dictates the order of the story, so it must be strictly incremental. Think of it as the scene number in a screenplay.',
    ),

  title: z
    .string()
    .describe(
      'A very short, descriptive title for this scene (2-4 words maximum). This should capture the essence of what happens in this scene, such as "Problem Introduction", "Solution Overview", or "Call to Action". Keep it concise and clear.',
    ),

  // scene_type: z
  //   .enum([
  //     'intro',
  //     'problem',
  //     'solution',
  //     'explanation',
  //     'demonstration',
  //     'conclusion',
  //     'call_to_action',
  //   ])
  //   .describe(
  //     'The narrative purpose of this scene. This helps maintain story structure and guides the visual style. intro: opening scene, problem: presenting challenges, solution: offering answers, explanation: detailed breakdown, demonstration: showing how something works, conclusion: wrapping up, call_to_action: prompting viewer action.',
  //   ),

  scene_duration: z
    .number()
    .describe(
      'Estimated duration for this scene in seconds. This should align with the narration length and visual complexity. Typically ranges from 8-20 seconds per scene.',
    ),

  // key_message: z
  //   .string()
  //   .describe(
  //     'The core message or takeaway this scene should convey. This ensures focus and helps validate that the narration and visuals align with the intended communication goal.',
  //   ),

  narration_text: z
    .string()
    .describe(
      'The voiceover script for this specific scene. It should be conversational, clear, and concise, as if explaining the concept to a friend. Each sentence should build upon the last and directly relate to the visual concept. Avoid jargon and complex sentence structures.',
    ),

  visual_concept_prompt: z
    .string()
    .describe(
      "A detailed, Midjourney-optimized prompt for image generation. Structure your prompt following Midjourney best practices: [Subject] + [Style] + [Composition] + [Lighting]. Include specific artistic styles (e.g., 'minimalist line art', 'hand-drawn illustration', 'whiteboard sketch style'), composition details (e.g., 'centered composition', 'dynamic angle'), and lighting descriptions (e.g., 'soft lighting', 'clean white background'). IMPORTANT: Do NOT include any Midjourney parameters (like --ar, --style, --v, etc.) in the prompt. Only provide the descriptive text. Example: 'A rocket launching into space, minimalist line art style, hand-drawn illustration, centered composition, clean white background, simple black lines, dynamic upward movement'.",
    ),
})

// Defines the schema for the final, complete script object.
export const storySchema = z.object({
  script_id: z
    .string()
    .describe(
      "A unique identifier for this script. A good practice is to create a human-readable ID by combining the main topic and a timestamp, for example: 'overcoming-procrastination-20231027'.",
    ),

  title: z
    .string()
    .describe(
      'A catchy and compelling title for the video. It should be short, accurately reflect the core topic, and spark curiosity in the target audience.',
    ),

  scenes: z
    .array(sceneSchema)
    .describe(
      'An array of Scene objects that, together, form a complete narrative arc. A compelling story typically requires at least 3 to 5 scenes to properly introduce a problem, present a solution, and guide the viewer to a call to action. The scenes must be ordered by their `scene_id`.',
    ),
})

// A TypeScript type can be inferred from the schema for use in your code.
export type Story = z.infer<typeof storySchema>
