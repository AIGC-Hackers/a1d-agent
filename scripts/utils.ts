export const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  reset: (text: string) => `\x1b[0m${text}\x1b[0m`,
}

export const log = {
  error: (message: string) => console.log(colors.red(`❌ ${message}`)),
  success: (message: string) => console.log(colors.green(`✅ ${message}`)),
  info: (message: string) => console.log(colors.blue(`ℹ️  ${message}`)),
  warning: (message: string) => console.log(colors.yellow(`⚠️  ${message}`)),
}
