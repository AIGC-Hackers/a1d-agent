import { ProjectConfigSchema } from './project.schema'

export async function loadProjectConfig() {
  const config = await import('../project.config')
  return ProjectConfigSchema.assert(config.default || config)
}
