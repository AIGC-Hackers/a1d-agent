import { streamContext } from '@/lib/context'
import { Mastra } from '@mastra/core/mastra'
import { PinoLogger } from '@mastra/loggers'
import { streamSSE } from 'hono/streaming'

import { deepResearchAgent } from './agents/deepresearch-agent'
import { deepResearchEvaluationAgent } from './agents/deepresearch-evaluation-agent'
import { deepResearchLearningExtractionAgent } from './agents/deepresearch-learning-extraction-agent'
import { deepResearchReportAgent } from './agents/deepresearch-report-agent'
import { drawOutAgent } from './agents/draw-out-agent'
import { mckinseyConsultantAgent } from './agents/mckinsey-consultant-agent'
import { drawOutDeepResearchAgent } from './agents/openai-deepresearch-agent'
import { stagehandWebAgent } from './agents/stagehand-web-agent'
import { testAgent } from './agents/test-agent'
import { drawOutVideoCutoutAgent } from './agents/video-cutout-agent'
import { weatherAgent } from './agents/weather-agent'
import { logger, storage } from './factory'
import { deepResearchGenerateReportWorkflow } from './workflows/deepresearch-generate-report-workflow'
import { deepResearchWorkflow } from './workflows/deepresearch-workflow'
import { weatherWorkflow } from './workflows/weather-workflow'

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    deepResearchWorkflow,
    deepResearchGenerateReportWorkflow,
  },
  agents: {
    test: testAgent,
    weather: weatherAgent,
    deepResearch: deepResearchAgent,
    deepResearchEvaluation: deepResearchEvaluationAgent,
    deepResearchLearningExtraction: deepResearchLearningExtractionAgent,
    deepResearchReport: deepResearchReportAgent,

    mckinseyConsultant: mckinseyConsultantAgent,
    stagehandWeb: stagehandWebAgent,

    drawOut: drawOutAgent,
    drawOutDeepResearch: drawOutDeepResearchAgent,
    drawOutVideoCutout: drawOutVideoCutoutAgent,
  },
  storage: storage.value,
  logger: logger,
  server: {
    middleware: [
      // TODO: Test
      // {
      //   path: '/api/*',
      //   handler: async (c, next) => {
      //     c.res = streamSSE(c, async (writer) => {
      //       streamContext.callAsync(writer, next)
      //     })
      //   },
      // },
    ],
  },
})
