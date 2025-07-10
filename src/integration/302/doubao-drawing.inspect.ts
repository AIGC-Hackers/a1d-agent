import { mkdir, writeFile } from 'node:fs/promises'
import { env } from '@/lib/env'
import { firstValueFrom, from, mergeMap, toArray } from 'rxjs'

import { generateDoubaoImage } from './doubao-drawing'

const prompts = [
  // 手绘动画风格 - 科普教育场景
  '简洁的手绘线条风格，白色背景，黑色马克笔绘制的人体心脏解剖图，标注各个部位名称，教科书插图风格',
  'Hand-drawn sketch style, a hand holding a marker drawing the water cycle diagram with arrows showing evaporation, condensation, and precipitation',
  '手绘风格，中心是一个大脑，周围用箭头连接着各种学习方法的图标：思维导图、番茄钟、记忆宫殿，黑色线条画',

  // 手绘动画风格 - 商业解释场景
  '极简线条画风格，白色背景，展示一个销售漏斗，从上到下标注：认知、兴趣、决策、行动，黑色马克笔效果',
  'Minimalist hand-drawn sketch showing a startup journey: idea lightbulb → prototype → funding → growth chart, black marker style on white background',
  '手绘商业模型图，中心是"客户"，周围环绕：产品、服务、反馈、改进，用箭头形成闭环，简笔画风格',

  // 手绘动画风格 - 流程说明场景
  '黑色马克笔手绘流程图：用户注册 → 邮箱验证 → 完善信息 → 开始使用，简洁线条，带勾选框，白色背景',
  'Hand-drawn flowchart: raw materials → manufacturing → quality control → packaging → shipping, simple black lines, sketch style',
  '手绘APP使用教程，分步骤展示：1.下载安装 2.注册账号 3.设置偏好 4.开始体验，配图标和箭头，简笔画风格',

  // 手绘动画风格 - 概念可视化场景
  '手绘风格的"区块链"概念图，用简单方块和链条展示，白色背景，黑色线条，标注关键词：去中心化、安全、透明',
  'Hand-drawn illustration of cloud computing: central cloud icon connected to various devices (laptop, phone, tablet), marker drawing style',
  '手绘"人工智能"概念图，大脑图标连接到各种应用场景：语音识别、图像处理、数据分析，极简线条画，黑色笔触',

  // 手绘动画风格 - 故事叙述场景
  '手绘连环画风格，展示创业故事第一幕：一个人在车库里画设计图，简笔画风格，黑色马克笔，白色背景',
  'Sequential hand-drawn sketches showing a day in the life: morning coffee → commute → office work → evening relaxation, simple stick figures',
  '手绘故事板：从种子到大树的成长过程，分为5个阶段，每个阶段用简单图标表示，教学插画风格，黑色线条',
]

// 创建生成图片的任务
const makeGenerateTask = async (
  prompt: string,
  index: number,
  timestamp: string,
) => {
  console.log(
    `[${index + 1}/${prompts.length}] Start generating: "${prompt.substring(0, 40)}..."`,
  )

  try {
    const result = await firstValueFrom(
      generateDoubaoImage(
        {
          prompt,
          width: 512,
          height: 512,
          ddim_steps: 10,
          use_sr: false,
        },
        {
          apiKey: env.value.X_302_API_KEY,
        },
      ),
    )

    if (result.data.binary_data_base64.length > 0) {
      const filename = `./temp/${timestamp}_${(index + 1).toString().padStart(2, '0')}.png`
      const imageBuffer = Buffer.from(
        result.data.binary_data_base64[0],
        'base64',
      )
      await writeFile(filename, imageBuffer)

      console.log(`✓ [${index + 1}] Done: ${filename}`)
      return { success: true, filename }
    } else {
      console.log(`✗ [${index + 1}] Failed: No image data`)
      return { success: false, error: 'No image data returned' }
    }
  } catch (error) {
    console.log(`✗ [${index + 1}] Failed: ${error}`)
    return { success: false, error: String(error) }
  }
}

async function test() {
  const tempDir = './temp'
  await mkdir(tempDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const CONCURRENCY = 3

  console.log(
    `Generating ${prompts.length} images with concurrency ${CONCURRENCY}...\n`,
  )

  // 使用 RxJS 执行并发任务
  const results = await firstValueFrom(
    from(prompts.map((prompt, index) => ({ prompt, index }))).pipe(
      mergeMap(
        ({ prompt, index }) => from(makeGenerateTask(prompt, index, timestamp)),
        CONCURRENCY,
      ),
      toArray(),
    ),
  )

  // 统计结果
  console.log('\n=== Summary ===')
  const successful = results.filter((r) => r.success).length
  const failed = results.length - successful

  console.log(`Total: ${results.length}`)
  console.log(`Success: ${successful}`)
  console.log(`Failed: ${failed}`)

  if (failed > 0) {
    console.log('\nFailed prompts:')
    results.forEach((result, index) => {
      if (!result.success) {
        console.log(`- [${index + 1}] ${prompts[index].substring(0, 50)}...`)
        console.log(`  Error: ${result.error}`)
      }
    })
  }
}

test()
