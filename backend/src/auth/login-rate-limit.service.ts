import { Injectable, HttpException, HttpStatus, Optional } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { LocalFallbackStore } from '../common/local-fallback-store';
import { ERROR_CODES } from '../common/error-codes';

/**
 * 登录失败限流（T22.3）。基于 Redis INCR 原子操作的滑动窗口计数。
 * 维度：
 *   - username：5 次 / 15 分钟（防暴力破解单账号）
 *   - ip：20 次 / 15 分钟（防 cc 攻击，单 IP 批量尝试）
 * Redis 未配置或连接未就绪时改用进程内固定窗口（见下方降级说明），不再直通。
 *
 * 安全设计：使用 INCR 原子操作替代 GET+判断，消除竞态条件。
 * INCR 返回自增后的值，首次自增（返回1）时设置过期时间，
 * 确保窗口内计数准确且原子。
 *
 * 注意：`assertNotBlocked` 为快速预检（只读），极端并发下可能有 ±1 误差，
 * 真正的计数由 `registerFailure` / `checkAndRecordFailure` 的原子 INCR 保证。
 *
 * Redis 降级（S23 A2 / D2）：REDIS_URL 已配置但连接不可用时，RedisService 的 get/incr
 * 会返回 null/0，若直接使用就会「计数归零 → 暴力破解防护失效」。因此这里按可用性分流：
 * 可用走 Redis，不可用走进程内固定窗口（多实例部署精度退化为单实例）。
 */
@Injectable()
export class LoginRateLimitService {
  readonly usernameWindowSec = 15 * 60;
  readonly usernameMaxAttempts = 5;
  readonly ipWindowSec = 15 * 60;
  readonly ipMaxAttempts = 20;

  constructor(
    private readonly redis: RedisService,
    @Optional() private readonly local?: LocalFallbackStore,
  ) {}

  /** Redis 是否可用于计数：未配置或连接未就绪都走本地兜底 */
  private useRedis(): boolean {
    return this.redis.isEnabled && (this.redis.isAvailable?.() ?? true);
  }

  private async readCount(key: string): Promise<number> {
    if (this.useRedis()) {
      const value = await this.redis.get(key);
      return value ? Number(value) : 0;
    }
    const value = this.local?.get(key);
    return value ? Number(value) : 0;
  }

  private async bumpCount(key: string, windowSec: number): Promise<number> {
    if (this.useRedis()) {
      return this.redis.incr(key);
    }
    return this.local?.incr(key, windowSec) ?? 0;
  }

  private usernameKey(identifier: string): string {
    return `login:fail:user:${identifier}`;
  }

  private ipKey(ip: string): string {
    return `login:fail:ip:${ip}`;
  }

  /** 快速预检（用户名 + IP 任一超限即阻止）；Redis 不可用时用本地窗口兜底 */
  async assertNotBlocked(username: string, ip?: string): Promise<void> {
    const userCurrent = await this.readCount(this.usernameKey(username));
    if (userCurrent >= this.usernameMaxAttempts) {
      throw new HttpException(
        { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: '登录失败次数过多，请 15 分钟后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (ip) {
      const ipCurrent = await this.readCount(this.ipKey(ip));
      if (ipCurrent >= this.ipMaxAttempts) {
        throw new HttpException(
          { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: '该 IP 登录请求过于频繁，请 15 分钟后再试' },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  /**
   * 记录一次失败（用户名 + IP 双维度）；使用 INCR 原子操作，首次写入时设置窗口过期。
   * 返回 { userCount, ipCount } 自增后的计数。
   */
  async registerFailure(username: string, ip?: string): Promise<{ userCount: number; ipCount: number }> {
    const onRedis = this.useRedis();
    const userKey = this.usernameKey(username);
    const userCount = await this.bumpCount(userKey, this.usernameWindowSec);
    if (onRedis && userCount === 1) {
      await this.redis.expire(userKey, this.usernameWindowSec);
    }

    let ipCount = 0;
    if (ip) {
      const ipK = this.ipKey(ip);
      ipCount = await this.bumpCount(ipK, this.ipWindowSec);
      if (onRedis && ipCount === 1) {
        await this.redis.expire(ipK, this.ipWindowSec);
      }
    }

    return { userCount, ipCount };
  }

  /** 检查并记录失败：原子地自增计数，如超限则直接抛 429 */
  async checkAndRecordFailure(username: string, ip?: string): Promise<void> {
    const { userCount, ipCount } = await this.registerFailure(username, ip);
    if (userCount >= this.usernameMaxAttempts) {
      throw new HttpException(
        { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: '登录失败次数过多，请 15 分钟后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (ip && ipCount >= this.ipMaxAttempts) {
      throw new HttpException(
        { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: '该 IP 登录请求过于频繁，请 15 分钟后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** 登录成功：清除失败计数（用户名维度），Redis 与本地镜像同时清理 */
  async reset(username: string): Promise<void> {
    const key = this.usernameKey(username);
    this.local?.del(key);
    if (this.redis.isEnabled) {
      await this.redis.del(key);
    }
  }
}
