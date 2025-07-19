#!/usr/bin/env bun
/// <reference types="@types/bun" />
import { get } from '@dotenvx/dotenvx'
import { camelCase, kebabCase } from 'lodash-es'

import { runtimeEnvSchema } from './env.schema.ts'

export type EnvVarInfo = {
  key: string
  value: any
  required: boolean
  defaultValue?: string
}

export function getEnvSchema(): {
  required: EnvVarInfo[]
  optional: EnvVarInfo[]
} {
  const schema = runtimeEnvSchema.json as any

  const required: EnvVarInfo[] = []
  const optional: EnvVarInfo[] = []

  if (schema.required) {
    for (const item of schema.required) {
      required.push({
        key: item.key,
        value: item.value,
        required: true,
      })
    }
  }

  if (schema.optional) {
    for (const item of schema.optional) {
      optional.push({
        key: item.key,
        value: item.value,
        required: false,
        defaultValue: item.default,
      })
    }
  }

  return { required, optional }
}

export function envKeyToConfigKey(envKey: string): string {
  // 使用 camelCase 符合 Pulumi 官方风格
  return camelCase(envKey)
}

export function envKeyToSecretName(envKey: string): string {
  // Secret 名称使用 kebab-case，这是 Kubernetes/Docker 的惯例
  return kebabCase(envKey)
}

export function getEnvValue(envKey: string): string | undefined {
  try {
    return get(envKey) || process.env[envKey]
  } catch {
    return process.env[envKey]
  }
}

// 转义 shell 中的特殊字符
function escapeShellValue(value: string): string {
  // 处理所有可能导致 shell 语法错误的字符
  return value
    .replace(/\\/g, '\\\\') // 转义反斜杠 (必须最先处理)
    .replace(/"/g, '\\"') // 转义双引号
    .replace(/`/g, '\\`') // 转义反引号
    .replace(/\$/g, '\\$') // 转义美元符号
    .replace(/\n/g, '\\n') // 转义换行符
    .replace(/\r/g, '\\r') // 转义回车符
    .replace(/\t/g, '\\t') // 转义制表符
}

export function generatePulumiConfigCommands(cwd: string = '.'): string[] {
  const { required, optional } = getEnvSchema()
  const commands: string[] = []

  // 生成必需变量的配置命令
  for (const envVar of required) {
    const configKey = envKeyToConfigKey(envVar.key)
    const value = getEnvValue(envVar.key)

    if (value) {
      const escapedValue = escapeShellValue(value)
      commands.push(`pulumi config set -C ${cwd} --secret ${configKey} "${escapedValue}"`)
    } else {
      commands.push(
        `# Missing required: pulumi config set -C ${cwd} --secret ${configKey} "YOUR_${envVar.key}"`,
      )
    }
  }

  // 生成可选变量的配置命令
  for (const envVar of optional) {
    const configKey = envKeyToConfigKey(envVar.key)
    const value = getEnvValue(envVar.key)

    if (value) {
      const escapedValue = escapeShellValue(value)
      commands.push(`pulumi config set -C ${cwd} --secret ${configKey} "${escapedValue}"`)
    } else if (envVar.defaultValue) {
      commands.push(
        `# Optional with default: pulumi config set -C ${cwd} --secret ${configKey} "${envVar.defaultValue}"`,
      )
    } else {
      commands.push(
        `# Optional: pulumi config set -C ${cwd} --secret ${configKey} "YOUR_${envVar.key}"`,
      )
    }
  }

  return commands
}

export function generatePulumiSecrets(): Array<{ name: string; value: any }> {
  const { required, optional } = getEnvSchema()
  const secrets: Array<{ name: string; value: any }> = []

  for (const envVar of [...required, ...optional]) {
    const secretName = envKeyToSecretName(envVar.key)
    const configKey = envKeyToConfigKey(envVar.key)

    if (envVar.required) {
      secrets.push({
        name: secretName,
        value: `config.requireSecret('${configKey}')`,
      })
    } else {
      const defaultValue = envVar.defaultValue
        ? `'${envVar.defaultValue}'`
        : 'undefined'
      secrets.push({
        name: secretName,
        value: `config.getSecret('${configKey}') || ${defaultValue}`,
      })
    }
  }

  return secrets
}

export function generatePulumiEnvVars(): Array<{
  name: string
  secretRef: string
}> {
  const { required, optional } = getEnvSchema()
  const envVars: Array<{ name: string; secretRef: string }> = []

  for (const envVar of [...required, ...optional]) {
    const secretName = envKeyToSecretName(envVar.key)
    envVars.push({
      name: envVar.key,
      secretRef: secretName,
    })
  }

  return envVars
}

// CLI 功能
if (import.meta.main) {
  const command = process.argv[2]
  const options = process.argv.slice(3)
  const shouldExecute = options.includes('--execute') || options.includes('-x')

  switch (command) {
    case 'schema':
      console.log(JSON.stringify(getEnvSchema(), null, 2))
      break

    case 'commands':
      // 根据当前目录判断 cwd
      const currentPath = process.cwd()
      const cwd = currentPath.endsWith('/pulumi') ? '.' : './pulumi'

      const commands = generatePulumiConfigCommands(cwd)
      console.log('#!/bin/bash')
      console.log('# Auto-generated Pulumi config commands')
      if (shouldExecute) {
        console.log('# Executing commands...')
      }
      console.log('')

      if (shouldExecute) {
        // 执行命令
        const { $ } = await import('bun')

        for (const cmd of commands) {
          if (cmd.startsWith('#')) {
            console.log(cmd) // 打印注释
          } else {
            console.log(`Executing: ${cmd}`)
            try {
              // 直接执行命令（已经包含 -C 参数）
              await $`${cmd}`.quiet()
              console.log('✓ Success')
            } catch (error: any) {
              console.error(`✗ Failed: ${error.message}`)
            }
          }
        }
      } else {
        // 只打印命令
        commands.forEach((cmd: string) => console.log(cmd))
      }
      break

    case 'secrets':
      const secrets = generatePulumiSecrets()
      console.log('// Auto-generated Pulumi secrets configuration')
      secrets.forEach((secret) => {
        console.log(`  {`)
        console.log(`    name: '${secret.name}',`)
        console.log(`    value: ${secret.value},`)
        console.log(`  },`)
      })
      break

    case 'env':
      const envVars = generatePulumiEnvVars()
      console.log('// Auto-generated Pulumi environment variables')
      envVars.forEach((env) => {
        console.log(`  {`)
        console.log(`    name: '${env.name}',`)
        console.log(`    secretRef: '${env.secretRef}',`)
        console.log(`  },`)
      })
      break

    default:
      console.log('Usage: bun pulumi/lib/env-config.ts <command> [options]')
      console.log('')
      console.log('Commands:')
      console.log('  schema    - Show environment schema')
      console.log('  commands  - Generate pulumi config set commands')
      console.log('  secrets   - Generate Pulumi secrets configuration')
      console.log(
        '  env       - Generate Pulumi environment variables configuration',
      )
      console.log('')
      console.log('Options:')
      console.log(
        '  --execute, -x  - Execute commands instead of just printing (for commands command)',
      )
      console.log('')
      console.log('Examples:')
      console.log(
        '  bun pulumi/lib/env-config.ts commands          # Print commands',
      )
      console.log(
        '  bun pulumi/lib/env-config.ts commands -x       # Execute commands',
      )
  }
}
