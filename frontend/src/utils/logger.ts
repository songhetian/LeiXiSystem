type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const isDev = import.meta.env?.DEV ?? process.env?.NODE_ENV !== 'production'

let currentLevel: LogLevel = isDev ? 'debug' : 'error'
let prefix = '[LeiXi]'

interface LogOptions {
  /** 是否在生产环境也输出（仅 error 级别默认输出） */
  forceInProduction?: boolean
}

class Logger {
  private shouldLog(level: LogLevel, options?: LogOptions): boolean {
    if (options?.forceInProduction) return true
    if (!isDev && level !== 'error') return false
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
  }

  private formatArgs(level: LogLevel, args: any[]): any[] {
    const timestamp = new Date().toISOString()
    return [`${prefix} ${level.toUpperCase()} [${timestamp}]`, ...args]
  }

  debug(...args: any[]): void {
    if (!this.shouldLog('debug')) return
    console.debug(...this.formatArgs('debug', args))
  }

  info(...args: any[]): void {
    if (!this.shouldLog('info')) return
    console.info(...this.formatArgs('info', args))
  }

  warn(...args: any[]): void {
    if (!this.shouldLog('warn')) return
    console.warn(...this.formatArgs('warn', args))
  }

  error(...args: any[]): void {
    if (!this.shouldLog('error', { forceInProduction: true })) return
    console.error(...this.formatArgs('error', args))
  }

  /** 分组输出 */
  group(label: string, callback: () => void): void {
    if (!isDev) {
      callback()
      return
    }
    console.group(`${prefix} ${label}`)
    try {
      callback()
    } finally {
      console.groupEnd()
    }
  }

  /** 性能计时 */
  time(label: string): void {
    if (!isDev) return
    console.time(`${prefix} ${label}`)
  }

  timeEnd(label: string): number | undefined {
    if (!isDev) return undefined
    console.timeEnd(`${prefix} ${label}`)
    return undefined
  }

  /** 设置日志级别 */
  setLevel(level: LogLevel): void {
    currentLevel = level
  }

  /** 设置日志前缀 */
  setPrefix(newPrefix: string): void {
    prefix = newPrefix
  }

  /** 创建子 logger，带命名空间 */
  child(namespace: string): Logger {
    const childLogger = new Logger()
    const originalPrefix = prefix
    Object.defineProperty(childLogger, 'formatArgs', {
      value: (level: LogLevel, args: any[]) => {
        const timestamp = new Date().toISOString()
        return [`${originalPrefix} ${namespace} ${level.toUpperCase()} [${timestamp}]`, ...args]
      },
      writable: false,
    })
    return childLogger
  }
}

export const logger = new Logger()

export default logger
