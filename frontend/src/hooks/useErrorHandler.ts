import { useCallback } from 'react'
import { toast } from '@/utils/toast'
import { logger } from '@/utils/logger'

export interface AppError extends Error {
  code?: number | string
  status?: number
  data?: any
  isBusinessError?: boolean
}

interface UseErrorHandlerOptions {
  /** 错误提示前缀，默认为"操作失败" */
  defaultMessage?: string
  /** 是否显示错误提示，默认 true */
  showToast?: boolean
  /** 自定义错误处理回调 */
  onError?: (error: AppError) => void
  /** 是否记录错误日志，默认 true */
  logError?: boolean
}

interface UseErrorHandlerResult {
  /** 处理错误并显示提示 */
  handleError: (error: unknown, customMessage?: string) => AppError
  /** 安全执行异步函数，自动捕获错误 */
  safeExecute: <T>(fn: () => Promise<T>, errorMessage?: string) => Promise<T | null>
  /** 格式化错误对象 */
  formatError: (error: unknown) => AppError
}

/**
 * 全局错误处理 Hook
 *
 * @example
 * const { handleError, safeExecute } = useErrorHandler()
 *
 * // 直接处理错误
 * try {
 *   await fetchData()
 * } catch (e) {
 *   handleError(e)
 * }
 *
 * // 安全执行
 * const result = await safeExecute(() => fetchData())
 */
export function useErrorHandler(options: UseErrorHandlerOptions = {}): UseErrorHandlerResult {
  const {
    defaultMessage = '操作失败',
    showToast = true,
    onError,
    logError = true,
  } = options

  const formatError = useCallback((error: unknown): AppError => {
    if (error instanceof Error) {
      return {
        ...error,
        name: error.name,
        message: error.message,
      }
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as Record<string, any>
      return {
        name: 'AppError',
        message: err.message || err.msg || String(error),
        code: err.code,
        status: err.status,
        data: err.data,
        isBusinessError: !!err.code,
      }
    }

    return {
      name: 'UnknownError',
      message: String(error),
    }
  }, [])

  const handleError = useCallback(
    (error: unknown, customMessage?: string): AppError => {
      const appError = formatError(error)
      const message = customMessage || appError.message || defaultMessage

      if (logError) {
        logger.error('[Error]', {
          message: appError.message,
          code: appError.code,
          status: appError.status,
          stack: appError.stack,
        })
      }

      if (showToast) {
        toast.error(message)
      }

      onError?.(appError)

      return appError
    },
    [formatError, defaultMessage, showToast, onError, logError]
  )

  const safeExecute = useCallback(
    async <T>(fn: () => Promise<T>, errorMessage?: string): Promise<T | null> => {
      try {
        return await fn()
      } catch (error) {
        handleError(error, errorMessage)
        return null
      }
    },
    [handleError]
  )

  return {
    handleError,
    safeExecute,
    formatError,
  }
}

export default useErrorHandler
