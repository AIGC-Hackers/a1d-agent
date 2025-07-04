import type { ProjectConfig } from './scripts/project.schema'

export default {
  aws: {
    stackName: 'ethan-huo-org/a1d-infra/dev',
  },
  docker: {
    buildOptions: {},
  },
  build: {
    distDir: '.mastra',
    cleanupAfterPush: true,
    alwaysPushLatest: true,
  },
} satisfies ProjectConfig
