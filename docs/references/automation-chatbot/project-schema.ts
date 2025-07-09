import { z } from 'zod'

// Step 1: 经过主 Agent 与用户澄清后，所有字段都变为必填项
export const projectSchema = z.object({
  topic: z
    .string()
    .describe(
      '视频的核心主题或概念。例如："量子计算入门" 或 "如何进行有效的时间管理"。',
    ),
  targetAudience: z
    .string()
    .describe(
      '视频的目标观众。这会影响内容的深度和语言风格。例如："中学生", "市场营销经理", "软件开发者"。',
    ),
  tone: z
    .enum(['professional', 'friendly', 'energetic', 'inspirational'])
    .describe(
      "视频的整体情感基调。例如：'professional' (专业严谨), 'friendly' (轻松友好), 'energetic' (充满活力), 'inspirational' (鼓舞人心)。",
    ),
  desiredDurationInSeconds: z
    .number()
    .describe('用户期望的视频大致时长，单位为秒。例如：60 或 90。'),
  callToAction: z
    .string()
    .describe(
      '希望观众在看完视频后采取的具体行动。例如："访问我们的网站 a.com", "下载我们的APP", "订阅频道"。',
    ),

  // Visual Settings
  aspectRatio: z
    .enum(['16:9', '9:16', '1:1', '4:3'])
    .describe(
      '画面比率设置。16:9适合横屏观看，9:16适合手机竖屏，1:1适合社交媒体方形视频。',
    ),

  visualStyle: z
    .enum(['minimalist', 'detailed', 'sketch', 'doodle'])
    .describe(
      '视觉风格偏好。minimalist: 极简线条，detailed: 丰富细节，sketch: 草图风格，doodle: 涂鸦风格。',
    ),

  lineStyle: z
    .enum(['thin', 'medium', 'thick', 'varied'])
    .describe(
      '线条粗细风格。thin: 细线条，medium: 中等线条，thick: 粗线条，varied: 变化线条。',
    ),

  colorScheme: z
    .enum(['monochrome', 'two-color', 'limited-color'])
    .describe(
      '颜色方案。monochrome: 单色黑白，two-color: 双色方案，limited-color: 有限配色。',
    ),

  backgroundStyle: z
    .enum(['clean-white', 'grid-paper', 'notebook', 'digital-whiteboard'])
    .describe(
      '背景风格。clean-white: 纯白背景，grid-paper: 网格纸，notebook: 笔记本，digital-whiteboard: 数字白板。',
    ),
})

export type Project = z.infer<typeof projectSchema>
