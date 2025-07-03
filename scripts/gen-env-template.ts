/// <reference types="@types/bun" />

import { writeFileSync } from 'fs'
import { join } from 'path'
import { runtimeEnvSchema } from '../src/lib/env'

type EnvVariable = {
  key: string
  value: any
  default?: string
}

function generateEnvTemplate() {
  const schemaJson = runtimeEnvSchema.json as {
    required: EnvVariable[]
    optional: EnvVariable[]
  }

  let template = '# Environment Variables Template\n'
  template += '# Copy this file to .env and fill in the values\n\n'

  // Add required variables
  if (schemaJson.required.length > 0) {
    template += '# ----------------------------------\n'
    template += '# Required Variables\n'
    template += '# ----------------------------------\n\n'

    for (const variable of schemaJson.required) {
      const description = getVariableDescription(variable)
      if (description) {
        template += `# ${description}\n`
      }
      template += `${variable.key}=\n\n`
    }
  }

  // Add optional variables
  if (schemaJson.optional.length > 0) {
    template += '# ----------------------------------\n'
    template += '# Optional Variables\n'
    template += '# ----------------------------------\n\n'

    for (const variable of schemaJson.optional) {
      const description = getVariableDescription(variable)
      if (description) {
        template += `# ${description}\n`
      }
      const defaultValue = variable.default || ''
      template += `# ${variable.key}=${defaultValue}\n\n`
    }
  }

  return template
}

function getVariableDescription(variable: EnvVariable): string {
  const { key, value } = variable

  if (typeof value === 'string') {
    return `${key}: ${value}`
  }

  if (typeof value === 'object' && value.meta) {
    if (value.meta.format === 'uri') {
      return `${key}: URL string`
    }
    return `${key}: ${value.meta}`
  }

  return `${key}: ${typeof value}`
}

function main() {
  console.log('Generating .env.template...')

  const template = generateEnvTemplate()
  const templatePath = join(process.cwd(), '.env.template')

  writeFileSync(templatePath, template, 'utf-8')

  console.log(`✅ Generated .env.template at ${templatePath}`)
}

main()