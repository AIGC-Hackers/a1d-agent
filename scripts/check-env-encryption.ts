#!/usr/bin/env bun
/// <reference types="@types/bun" />
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const checkEnvFile = (filePath: string): boolean => {
  if (!existsSync(filePath)) {
    return true
  }

  const content = readFileSync(filePath, 'utf-8')

  // 如果文件有内容但不包含 "encrypted:"，则视为风险
  if (content.trim() && !content.includes('encrypted:')) {
    console.error(`❌ 环境变量存在风险: ${filePath}`)
    console.error(`   文件中没有找到 "encrypted:" 标记`)
    return false
  }

  return true
}

const main = () => {
  const stagedFiles = process.argv.slice(2)

  // 如果没有传入任何文件，直接通过
  if (stagedFiles.length === 0) {
    console.log('✅ 环境变量检查通过（无相关文件）')
    process.exit(0)
  }

  const rootDir = process.cwd()
  const envFiles = ['.env', '.env.production']

  // 只检查被暂存的环境文件
  const stagedEnvFiles = stagedFiles.filter((file) =>
    envFiles.some(
      (envFile) => file === envFile || file.endsWith(`/${envFile}`),
    ),
  )

  // 如果没有暂存任何环境文件，直接通过
  if (stagedEnvFiles.length === 0) {
    console.log('✅ 环境变量检查通过（无环境文件被暂存）')
    process.exit(0)
  }

  let hasRisk = false

  for (const file of stagedEnvFiles) {
    const filePath = file.startsWith('/') ? file : join(rootDir, file)
    if (!checkEnvFile(filePath)) {
      hasRisk = true
    }
  }

  if (hasRisk) {
    console.error('\n⚠️  检测到未加密的环境变量，请使用 dotenvx 加密后再提交')
    process.exit(1)
  }

  console.log('✅ 环境变量检查通过')
  process.exit(0)
}

main()
