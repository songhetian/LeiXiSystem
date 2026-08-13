import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { ERROR_CODES } from '../common/error-codes';

/**
 * 登录失败限流（T22.3）。基于 Redis incr + expire 的滑动窗口计数。
 * 维度：按 username。窗口 15 分钟，上限 5 次；超限抛 429。
 * Redis 未启用时全部直通（不阻断登录）。
 */
@Injectable()
export class LoginRateLimitService {
  readonly windowSec = 15 * 60;
  readonly maxAttempts = 5;

  constructor(private readonly redis: RedisService) {}

  private keyOf(identifier: string): string {
    return `login:fail:${identifier}`;
  }

  /** 超限则抛 429；Redis 未启用时直通 */
  async assertNotBlocked(identifier: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    const raw = await this.redis.get(this.keyOf(identifier));
    if (raw !== null && Number(raw) >= this.maxAttempts) {
      throw new HttpException(
        { code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: '登录失败次数过多，请 15 分钟后再试' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** 记录一次失败；首次写入时设置窗口过期 */
  async registerFailure(identifier: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    const key = this.keyOf(identifier);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.windowSec);
    }
  }

  /** 登录成功：清除失败计数 */
  async reset(identifier: string): Promise<void> {
    if (!this.redis.isEnabled) return;
    await this.redis.del(this.keyOf(identifier));
  }
}
