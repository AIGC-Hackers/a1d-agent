import { type } from 'arktype'

export const ProjectConfigSchema = type({
  aws: {
    region: 'string = "ap-southeast-2"',
    stackName: 'string',
  },
  docker: {
    platform: 'string = "linux/arm64"',
    defaultTag: 'string = "latest"',
    tempImageName: 'string = "temp-app"',
    buildOptions: {
      enableBuildKit: 'boolean = true',
      enableInlineCache: 'boolean = true',
      enableRegistryCache: 'boolean = true',
      'cacheRegistryRef?': 'string',
      progress: "'auto' | 'plain' | 'tty' = 'plain'",
    },
  },
  build: {
    distDir: 'string = "dist"',
    cleanupAfterPush: 'boolean = true',
    alwaysPushLatest: 'boolean = true',
  },
})

export type ProjectConfig = typeof ProjectConfigSchema.inferIn
export type ProjectConfigOutput = typeof ProjectConfigSchema.infer
