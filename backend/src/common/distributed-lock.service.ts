import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from './redis/redis.service';
import { ERROR_CODES } from './error-codes';
import { MetricsService } from './metrics.service';

export class LockAcquisitionError extends Error {
  readonly code = ERROR_CODES.LOCK_ACQUISITION_FAILED;
  constructor(public readonly resource: string) {
    super(`无法获取分布式锁: ${resource}，请稍后重试`);
    this.name = 'LockAcquisitionError';
  }
}

const UNLOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`;

const DEFAULT_TTL_MS = 30_000;
const KEY_PREFIX = 'lock:';

export interface LockOptions {
  ttlMs?: number;
  failClosed?: boolean;
}

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(
    private readonly redis: RedisService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async tryAcquire(
    resource: string,
    ownerId: string,
    ttlMs: number = DEFAULT_TTL_MS,
    failClosed: boolean = true,
  ): Promise<boolean> {
    if (!this.redis.isEnabled) {
      if (failClosed) {
        this.logger.error(`Redis 不可用，按 fail-closed 策略拒绝获取锁 [${resource}]`);
        this.metrics?.recordLockAcquire(resource, false);
        return false;
      }
      this.logger.warn(`Redis 不可用，按 fail-open 策略放行锁 [${resource}]`);
      return true;
    }
    const key = KEY_PREFIX + resource;
    try {
      const client = this.redis.getClient();
      const result = await client.set(key, ownerId, 'PX', ttlMs, 'NX');
      const success = result === 'OK';
      this.metrics?.recordLockAcquire(resource, success);
      return success;
    } catch (err: any) {
      this.logger.warn(`获取锁失败 [${resource}]: ${err.message}`);
      const success = !failClosed;
      this.metrics?.recordLockAcquire(resource, success);
      return success;
    }
  }

  async release(resource: string, ownerId: string): Promise<boolean> {
    if (!this.redis.isEnabled) return true;
    const key = KEY_PREFIX + resource;
    try {
      const client = this.redis.getClient();
      const result = await client.eval(UNLOCK_SCRIPT, 1, key, ownerId);
      return result === 1;
    } catch (err: any) {
      this.logger.warn(`释放锁失败 [${resource}]: ${err.message}`);
      return false;
    }
  }

  async withLock<T>(
    resource: string,
    ttlMs: number,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const { failClosed = true } = options;
    const ownerId = this.generateOwnerId();
    const acquired = await this.tryAcquire(resource, ownerId, ttlMs, failClosed);
    if (!acquired) {
      throw new LockAcquisitionError(resource);
    }

    let renewalTimer: ReturnType<typeof setInterval> | null = null;
    const stopRenewal = () => {
      if (renewalTimer) {
        clearInterval(renewalTimer);
        renewalTimer = null;
      }
    };

    if (this.redis.isEnabled && ttlMs > 10_000) {
      const renewalIntervalMs = Math.floor(ttlMs / 3);
      renewalTimer = setInterval(async () => {
        try {
          const client = this.redis.getClient();
          const key = KEY_PREFIX + resource;
          const current = await client.get(key);
          if (current === ownerId) {
            await client.pexpire(key, ttlMs);
          } else {
            this.logger.warn(`锁续期失败，锁已不属于当前持有者 [${resource}]`);
            stopRenewal();
          }
        } catch (err: any) {
          this.logger.warn(`锁续期异常 [${resource}]: ${err.message}`);
        }
      }, renewalIntervalMs);
      if ((renewalTimer as any).unref) {
        (renewalTimer as any).unref();
      }
    }

    try {
      return await fn();
    } finally {
      stopRenewal();
      await this.release(resource, ownerId).catch((err) =>
        this.logger.warn(`释放锁异常 [${resource}]: ${err.message}`),
      );
    }
  }

  generateOwnerId(): string {
    return `${process.pid}-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }
}
