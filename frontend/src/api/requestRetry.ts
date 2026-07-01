import type { AxiosError, AxiosRequestConfig } from 'axios'
import { logger } from '@/utils/logger'

interface RetryConfig {
  retries?: number
  retryDelay?: number
  retryCondition?: (error: AxiosError) => boolean
}

const DEFAULT_RETRIES = 3
const DEFAULT_RETRY_DELAY = 1000

function defaultRetryCondition(error: AxiosError): boolean {
  const status = error.response?.status
  if (status && status >= 500) return true
  if (!error.response) return true
  return false
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function requestWithRetry(
  requestFn: (config: AxiosRequestConfig) => Promise<any>,
  config: AxiosRequestConfig & { retryConfig?: RetryConfig },
): Promise<any> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    retryCondition = defaultRetryCondition,
  } = config.retryConfig || {}

  let lastError: AxiosError | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestFn(config)
    } catch (error) {
      lastError = error as AxiosError

      if (attempt === retries || !retryCondition(lastError)) {
        throw lastError
      }

      const waitTime = retryDelay * Math.pow(2, attempt)
      logger.warn(`请求重试 ${attempt + 1}/${retries}，等待 ${waitTime}ms`, config.url)

      await delay(waitTime)
    }
  }

  throw lastError
}

export default requestWithRetry
