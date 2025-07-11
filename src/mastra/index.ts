import { Mastra } from '@mastra/core/mastra'

import { deepResearchAgent } from './agents/deepresearch-agent'
import { deepResearchEvaluationAgent } from './agents/deepresearch-evaluation-agent'
import { deepResearchLearningExtractionAgent } from './agents/deepresearch-learning-extraction-agent'
import { deepResearchReportAgent } from './agents/deepresearch-report-agent'
import { drawOutAgent } from './agents/drawout-agent'
import { drawOutAgentMock } from './agents/drawout-agent-mock'
import { drawOutVideoCutoutAgent } from './agents/drawout-composer-agent'
import { drawOutDeepResearchAgent } from './agents/drawout-deepresearch-agent'
import { mckinseyConsultantAgent } from './agents/mckinsey-consultant-agent'
import { stagehandWebAgent } from './agents/stagehand-web-agent'
import { testAgent } from './agents/test-agent'
import { todoAgent } from './agents/todo-agent'
import { weatherAgent } from './agents/weather-agent'
import { logger, storage, streamMiddleware } from './factory'
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
    todo: todoAgent,
    weather: weatherAgent,

    deepResearch: deepResearchAgent,
    deepResearchEvaluation: deepResearchEvaluationAgent,
    deepResearchLearningExtraction: deepResearchLearningExtractionAgent,
    deepResearchReport: deepResearchReportAgent,

    mckinseyConsultant: mckinseyConsultantAgent,
    stagehandWeb: stagehandWebAgent,

    drawOut: drawOutAgent,
    drawOutMock: drawOutAgentMock,
    drawOutDeepResearch: drawOutDeepResearchAgent,
    drawOutVideoCutout: drawOutVideoCutoutAgent,
  },
  storage: storage.value,
  logger: logger,
  server: {
    middleware: [
      // streamMiddleware()
    ],
  },
})
