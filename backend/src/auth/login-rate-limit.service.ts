import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { ERROR_CODES } from '../common/error-codes';

/**
 * 登录失败限流（T22.3）。基于 Redis INCR 原子操作的滑动窗口计数。
 * 维度：
 *   - username：5 次 / 15 分钟（防暴力破解单账号）
 *   - ip：20 次 / 15 分钟（防 cc 攻击，单 IP 批量尝试）
 * Redis 未启用时全部直通（不阻断登录）。
 *
 * 安全设计：使用 INCR 原子操作替代 GET+判断，消除竞态条件。
 * INCR 返回自增后的值，首次自增（返回1）时设置过期时间，
 * 确保窗口内计数准确且原子。
 *
 * 注意：`assertNotBlocked` 为快速预检（只读），极端并发下可能有 ±1 误差，
 * 真正的计数由 `registerFailure` / `checkAndRecordFailure` 的原子 INCR 保证。
 */
@Injectable()
export class LoginRateLimitService {
  readonly usernameWindowSec = 15 * 60;
  readonly usernameMaxAttempts = 5;
  readonly ipWindowSec = 15 * 60;
  readonly ipMaxAttempts = 20;

  constructor(private readonly redis: RedisService) {}

  private usernameKey(identifier: string): string {
    return `login:fail:user:${identifier}`;
  }

  private ipKey(ip: string): string {
    return `login:fail:ip:${ip}`;
  }

  /** 快速预检（用户名 + IP 任一超限即阻止）；Redis 未启用时直通 */
  async assertNotBlocked(username: string, ip?: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    const [userCount, ipCount] = await Promise.all([
      this.redis.get(this.usernameKey(username)),
      ip ? this.redis.get(this.ipKey(ip)) : Promise.resolve(null),
    ]);
    const userCurrent = userCount ? Number(userCount) : 0;
    if (userCurrent >= this.usernameMaxAttempts) {
      throw new HttpException(
        { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: '登录失败次数过多，请 15 分钟后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (ip) {
      const ipCurrent = ipCount ? Number(ipCount) : 0;
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
    if (!this.redis.isEnabled) return { userCount: 0, ipCount: 0 };

    const userKey = this.usernameKey(username);
    const userCount = await this.redis.incr(userKey);
    if (userCount === 1) {
      await this.redis.expire(userKey, this.usernameWindowSec);
    }

    let ipCount = 0;
    if (ip) {
      const ipK = this.ipKey(ip);
      ipCount = await this.redis.incr(ipK);
      if (ipCount === 1) {
        await this.redis.expire(ipK, this.ipWindowSec);
      }
    }

    return { userCount, ipCount };
  }

  /** 检查并记录失败：原子地自增计数，如超限则直接抛 429 */
  async checkAndRecordFailure(username: string, ip?: string): Promise<void> {
    if (!this.redis.isEnabled) return;
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

  /** 登录成功：清除失败计数（用户名维度） */
  async reset(username: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    await this.redis.del(this.usernameKey(username));
  }
}
