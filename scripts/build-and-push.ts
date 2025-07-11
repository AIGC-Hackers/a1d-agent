#!/usr/bin/env bun
/// <reference types="@types/bun" />
import { $ } from 'bun'
import { existsSync } from 'fs'
import { join } from 'path'
import { type } from 'arktype'

import type { ProjectConfigOutput } from './project.schema'
import { loadProjectConfig } from './project.loader'
import { log } from './utils'

type BuildContext = {
  config: ProjectConfigOutput
  imageTag: string
  ecrUrl: string
  ecrRegistry: string
}

async function getEcrInfo(
  config: ProjectConfigOutput,
): Promise<{ ecrUrl: string; ecrRegistry: string }> {
  log.info('Getting ECR repository information...')

  const ecrUrlResult =
    await $`pulumi stack output ecrRepositoryUrl -s ${config.aws.stackName}`.text()
  const ecrUrl = type('string.url.parse')
    .configure({
      message:
        'Failed to get ECR repository URL. Make sure infrastructure is deployed.',
    })
    .assert(ecrUrlResult.trim())

  const ecrRegistry = ecrUrl.hostname

  log.success(`ECR URL: ${ecrUrl}`)

  return { ecrUrl: ecrUrl.toString(), ecrRegistry }
}

async function validateDistDirectory(
  config: ProjectConfigOutput,
): Promise<void> {
  const distPath = join(process.cwd(), config.build.distDir)
  if (!existsSync(distPath)) {
    throw new Error(
      `${config.build.distDir}/ directory not found. Please run 'pnpm build' first.`,
    )
  }
}

async function loginToEcr(
  config: ProjectConfigOutput,
  ecrRegistry: string,
): Promise<void> {
  log.info('Logging in to ECR...')

  const loginPassword =
    await $`aws ecr get-login-password --region ${config.aws.region}`.text()
  await $`echo ${loginPassword.trim()} | docker login --username AWS --password-stdin ${ecrRegistry}`

  log.success('Successfully logged in to ECR')
}

async function buildDockerImage(context: BuildContext): Promise<string> {
  log.info('Building ARM64 Docker image...')

  const tempImageName = `${context.config.docker.tempImageName}:${context.imageTag}`
  const buildArgs = prepareBuildArgs(context.config, context.ecrUrl)

  // Enable BuildKit if configured
  if (context.config.docker.buildOptions.enableBuildKit) {
    process.env.DOCKER_BUILDKIT = '1'
  }

  log.info(`Build command: docker build ${buildArgs.join(' ')}`)
  await $`docker build ${buildArgs}`

  log.success('Docker image built successfully')
  return tempImageName
}

function prepareBuildArgs(
  config: ProjectConfigOutput,
  ecrUrl: string,
): string[] {
  const buildArgs: string[] = []
  const buildOptions = config.docker.buildOptions

  // Add platform
  buildArgs.push(`--platform=${config.docker.platform}`)

  // Add inline cache if enabled
  if (buildOptions.enableInlineCache) {
    buildArgs.push('--build-arg', 'BUILDKIT_INLINE_CACHE=1')
  }

  // Add registry cache if enabled
  if (buildOptions.enableRegistryCache) {
    const cacheRef = buildOptions.cacheRegistryRef || `${ecrUrl}:cache`
    buildArgs.push(
      '--cache-from',
      `type=registry,ref=${cacheRef}`,
      '--cache-to',
      `type=registry,ref=${cacheRef},mode=max`,
    )
  }

  // Add progress style
  buildArgs.push(`--progress=${buildOptions.progress}`)

  return buildArgs
}

async function tagAndPushImage(
  context: BuildContext,
  tempImageName: string,
): Promise<string> {
  const ecrImageName = `${context.ecrUrl}:${context.imageTag}`

  // Tag image for ECR
  log.info('Tagging image...')
  await $`docker tag ${tempImageName} ${ecrImageName}`

  // Push to ECR
  log.info('Pushing image to ECR...')
  await $`docker push ${ecrImageName}`

  log.success('Image pushed to ECR successfully')
  return ecrImageName
}

async function handleLatestTag(
  context: BuildContext,
  tempImageName: string,
): Promise<void> {
  if (context.imageTag !== 'latest' && context.config.build.alwaysPushLatest) {
    log.info('Tagging as latest...')

    const latestImageName = `${context.ecrUrl}:latest`
    await $`docker tag ${tempImageName} ${latestImageName}`
    await $`docker push ${latestImageName}`

    log.success('Latest tag pushed successfully')
  }
}

async function cleanupImages(
  context: BuildContext,
  tempImageName: string,
  ecrImageName: string,
): Promise<void> {
  if (!context.config.build.cleanupAfterPush) return

  log.info('Cleaning up local images...')

  try {
    const imagesToClean = [tempImageName, ecrImageName]

    if (
      context.imageTag !== 'latest' &&
      context.config.build.alwaysPushLatest
    ) {
      imagesToClean.push(`${context.ecrUrl}:latest`)
    }

    // Also clean up cache images if registry cache is enabled
    if (context.config.docker.buildOptions.enableRegistryCache) {
      const cacheRef =
        context.config.docker.buildOptions.cacheRegistryRef ||
        `${context.ecrUrl}:cache`
      imagesToClean.push(cacheRef)
    }

    await $`docker rmi ${imagesToClean}`

    log.success('Local images cleaned up')
  } catch (error) {
    log.warning('Failed to cleanup some local images (this is usually fine)')
  }
}

async function main(): Promise<void> {
  try {
    const config = await loadProjectConfig()
    const imageTag = process.argv[2] || config.docker.defaultTag

    log.info('Building and pushing Docker image to ECR...')
    log.success(`Image tag: ${imageTag}`)

    // Get ECR information
    const { ecrUrl, ecrRegistry } = await getEcrInfo(config)

    // Create build context
    const context: BuildContext = { config, imageTag, ecrUrl, ecrRegistry }

    // Validate prerequisites
    await validateDistDirectory(config)

    // Login to ECR
    await loginToEcr(config, ecrRegistry)

    // Build and tag Docker image
    const tempImageName = await buildDockerImage(context)

    // Push to ECR
    const ecrImageName = await tagAndPushImage(context, tempImageName)

    // Handle latest tag
    await handleLatestTag(context, tempImageName)

    // Cleanup
    await cleanupImages(context, tempImageName, ecrImageName)

    log.success('Successfully pushed image to ECR!')
    log.info(`Image URI: ${ecrImageName}`)
    log.info('Next steps:')
    console.log('   1. Update your Pulumi code to use this image')
    console.log("   2. Run 'pulumi up' to deploy")
  } catch (error) {
    log.error(`Script failed: ${error}`)
    process.exit(1)
  }
}

// Make script executable when run directly
if (import.meta.main) {
  main()
}

export {
  main as buildAndPush,
  getEcrInfo,
  validateDistDirectory,
  loginToEcr,
  buildDockerImage,
  tagAndPushImage,
  handleLatestTag,
  cleanupImages,
}
