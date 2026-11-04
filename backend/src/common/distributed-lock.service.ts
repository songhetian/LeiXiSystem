import { Injectable, Logger, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from './redis/redis.service';
import { ERROR_CODES } from './error-codes';
import { MetricsService } from './metrics.service';
import { errorMessage } from './error.util';

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
  /** Redis 不可用时是否拒绝（fallbackToLocal=false 时才有意义） */
  failClosed?: boolean;
  /**
   * Redis 不可用时是否降级为进程内互斥（默认开启）。
   * S23 / D1：算薪、考勤月报、打卡、请假余额等核心写操作不能在 Redis 故障时整体不可用；
   * 进程内互斥在单实例部署下与分布式锁等价，多实例部署退化为「每实例互斥」（可接受）。
   */
  fallbackToLocal?: boolean;
}

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  /** 进程内互斥队列：key = 资源名，value = 队尾 Promise */
  private readonly localTails = new Map<string, Promise<void>>();

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
    const result = await this.acquireRedis(resource, ownerId, ttlMs);
    if (result === null) {
      if (failClosed) {
        this.logger.error(`Redis 不可用，按 fail-closed 策略拒绝获取锁 [${resource}]`);
        this.metrics?.recordLockAcquire(resource, false);
        return false;
      }
      this.logger.warn(`Redis 不可用，按 fail-open 策略放行锁 [${resource}]`);
      return true;
    }
    this.metrics?.recordLockAcquire(resource, result);
    return result;
  }

  /** 返回 true=抢到；false=被他人持有；null=Redis 不可用（未配置或连接异常） */
  private async acquireRedis(resource: string, ownerId: string, ttlMs: number): Promise<boolean | null> {
    if (!this.redis.isEnabled) return null;
    try {
      const client = this.redis.getClient();
      const result = await client.set(KEY_PREFIX + resource, ownerId, 'PX', ttlMs, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.warn(`获取锁失败 [${resource}]: ${errorMessage(err)}`);
      return null;
    }
  }

  /**
   * 进程内互斥（Redis 不可用时的兜底）。同资源串行执行，返回释放函数。
   * 释放后清理队尾，避免 Map 随资源数无限增长。
   */
  private async acquireLocal(resource: string): Promise<() => void> {
    const prev = this.localTails.get(resource) ?? Promise.resolve();
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const tail = prev.then(() => gate);
    this.localTails.set(resource, tail);
    await prev;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseGate();
      if (this.localTails.get(resource) === tail) this.localTails.delete(resource);
    };
  }

  async release(resource: string, ownerId: string): Promise<boolean> {
    if (!this.redis.isEnabled) return true;
    const key = KEY_PREFIX + resource;
    try {
      const client = this.redis.getClient();
      const result = await client.eval(UNLOCK_SCRIPT, 1, key, ownerId);
      return result === 1;
    } catch (err) {
      this.logger.warn(`释放锁失败 [${resource}]: ${errorMessage(err)}`);
      return false;
    }
  }

  async withLock<T>(
    resource: string,
    ttlMs: number,
    fn: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const { failClosed = true, fallbackToLocal = true } = options;
    const ownerId = this.generateOwnerId();

    let mode: 'redis' | 'local' | 'none';
    const acquired = await this.acquireRedis(resource, ownerId, ttlMs);
    if (acquired === true) {
      mode = 'redis';
      this.metrics?.recordLockAcquire(resource, true);
    } else if (acquired === false) {
      this.metrics?.recordLockAcquire(resource, false);
      throw new LockAcquisitionError(resource);
    } else if (fallbackToLocal) {
      // Redis 未配置或连接异常：降级为进程内互斥，保证核心业务仍可用（S23 A1 / D1）
      this.logger.warn(`Redis 不可用，降级为进程内互斥 [${resource}]`);
      mode = 'local';
      this.metrics?.recordLockAcquire(resource, true);
    } else if (failClosed) {
      this.logger.error(`Redis 不可用，按 fail-closed 策略拒绝获取锁 [${resource}]`);
      this.metrics?.recordLockAcquire(resource, false);
      throw new LockAcquisitionError(resource);
    } else {
      this.logger.warn(`Redis 不可用，按 fail-open 策略跳过锁 [${resource}]`);
      mode = 'none';
    }

    let renewalTimer: ReturnType<typeof setInterval> | null = null;
    const stopRenewal = () => {
      if (renewalTimer) {
        clearInterval(renewalTimer);
        renewalTimer = null;
      }
    };

    if (mode === 'redis' && ttlMs > 10_000) {
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
        } catch (err) {
          this.logger.warn(`锁续期异常 [${resource}]: ${errorMessage(err)}`);
        }
      }, renewalIntervalMs);
      // setInterval 返回 NodeJS.Timeout，带 unref()：不阻止进程退出
      renewalTimer.unref();
    }

    const releaseLocal = mode === 'local' ? await this.acquireLocal(resource) : null;
    try {
      return await fn();
    } finally {
      stopRenewal();
      if (releaseLocal) releaseLocal();
      if (mode === 'redis') {
        await this.release(resource, ownerId).catch((err) =>
          this.logger.warn(`释放锁异常 [${resource}]: ${err.message}`),
        );
      }
    }
  }

  generateOwnerId(): string {
    return `${process.pid}-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }
}
