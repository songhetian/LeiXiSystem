import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis/redis.service';
import { randomBytes, timingSafeEqual } from 'crypto';

const CSRF_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const CSRF_KEY_PREFIX = 'csrf:';
const MAX_TOKENS_PER_USER = 5;

function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

@Injectable()
export class CsrfService {
  private readonly logger = new Logger(CsrfService.name);

  constructor(private readonly redis: RedisService) {}

  async generateToken(userId: number): Promise<string> {
    const token = randomBytes(32).toString('hex');
    if (this.redis.isEnabled) {
      const key = CSRF_KEY_PREFIX + userId;
      try {
        const client = this.redis.getClient();
        await client
          .multi()
          .lpush(key, token)
          .ltrim(key, 0, MAX_TOKENS_PER_USER - 1)
          .expire(key, CSRF_TOKEN_TTL_SECONDS)
          .exec();
      } catch (err: any) {
        this.logger.error(`存储 CSRF token 失败 [user=${userId}]: ${err.message}`);
      }
    }
    return token;
  }

  async validateToken(userId: number, token: string): Promise<boolean> {
    if (!this.redis.isEnabled) {
      this.logger.warn(`Redis 不可用，CSRF 校验放行 [user=${userId}]`);
      return true;
    }
    if (!token || typeof token !== 'string' || token.length !== 64) {
      return false;
    }
    const key = CSRF_KEY_PREFIX + userId;
    try {
      const client = this.redis.getClient();
      const tokens = await client.lrange(key, 0, -1);
      if (!tokens || tokens.length === 0) return false;
      for (const stored of tokens) {
        if (secureCompare(stored, token)) {
          return true;
        }
      }
      return false;
    } catch (err: any) {
      this.logger.error(`CSRF 校验异常 [user=${userId}]: ${err.message}`);
      return true;
    }
  }

  async invalidateToken(userId: number): Promise<void> {
    if (this.redis.isEnabled) {
      try {
        await this.redis.del(CSRF_KEY_PREFIX + userId);
      } catch (err: any) {
        this.logger.error(`失效 CSRF token 失败 [user=${userId}]: ${err.message}`);
      }
    }
  }
}
