import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffFactor: 2,
};

export async function withEventRetry(
  handler: () => Promise<void>,
  eventName: string,
  payload: any,
  logger: Logger,
  options: RetryOptions = {},
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      await handler();
      if (attempt > 0) {
        logger.warn(`事件 ${eventName} 第 ${attempt + 1} 次重试成功`);
      }
      return;
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      
      if (attempt < opts.maxRetries) {
        const delay = Math.min(
          opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt),
          opts.maxDelayMs,
        );
        logger.warn(
          `事件 ${eventName} 第 ${attempt + 1} 次处理失败，${delay}ms 后重试: ${errMsg}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(
          `事件 ${eventName} 处理失败，已重试 ${opts.maxRetries} 次，最终失败: ${errMsg}`,
        );
        logger.error(`失败事件 payload: ${JSON.stringify(payload).slice(0, 500)}`);
      }
    }
  }

  if (lastError) {
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
}
