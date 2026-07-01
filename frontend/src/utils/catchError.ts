import { logger } from '@/utils/logger'

interface CatchErrorOptions {
  /** 组件或模块名称 */
  component: string
  /** 操作描述 */
  operation: string
  /** 是否静默处理（仅记录日志，不抛出） */
  silent?: boolean
}

const childLogger = logger.child('catchError')

/**
 * 统一错误捕获工具
 * 在 catch 块中调用，确保所有被捕获的错误都有日志可查
 *
 * @example
 * ```ts
 * try {
 *   await fetchData()
 * } catch (e) {
 *   catchError(e, { component: 'EmployeePage', operation: '获取员工列表' })
 * }
 * ```
 */
export function catchError(
  error: unknown,
  options: CatchErrorOptions,
): void {
  const { component, operation, silent = true } = options
  const message = `[${component}] ${operation} 失败`

  if (error instanceof Error) {
    childLogger.error(message, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    })
  } else if (typeof error === 'object' && error !== null) {
    childLogger.error(message, error)
  } else {
    childLogger.error(message, String(error))
  }

  if (!silent) {
    throw error
  }
}

export default catchError
