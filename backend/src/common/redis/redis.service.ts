import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';

const DEFAULT_KEY_PREFIX = 'leixi:';

/**
 * Redis 封装（T22.1）。可选组件：REDIS_URL 缺失时降级为 no-op（isEnabled=false），
 * 不阻断应用启动，调用方据此走直通逻辑。
 *
 * 运行时容错：所有读写方法内部 try/catch，Redis 临时不可用时静默降级，
 * 不导致业务接口 500。
 *
 * Key 前缀：通过 REDIS_KEY_PREFIX 环境变量统一加前缀，避免多实例共享 Redis 时 key 冲突。
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  readonly isEnabled: boolean = false;
  readonly keyPrefix: string;

  constructor() {
    const url = process.env.REDIS_URL;
    this.keyPrefix = process.env.REDIS_KEY_PREFIX || DEFAULT_KEY_PREFIX;
    if (url) {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 2,
        lazyConnect: false,
        enableOfflineQueue: true,
        keyPrefix: this.keyPrefix,
      });
      this.isEnabled = true;
      this.client.on('error', (err) => this.logger.warn(`Redis 连接异常: ${err.message}`));
    }
  }

  getClient(): Redis {
    if (!this.client) throw new ServiceUnavailableException({ code: 5007, message: 'Redis 未启用（REDIS_URL 未配置）' });
    return this.client;
  }

  async ping(): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.ping();
    } catch (err: any) {
      this.logger.warn(`Redis ping 失败: ${err.message}`);
      return null;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (err: any) {
      this.logger.warn(`Redis incr 失败 [${key}]: ${err.message}`);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.expire(key, seconds);
    } catch (err: any) {
      this.logger.warn(`Redis expire 失败 [${key}]: ${err.message}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (err: any) {
      this.logger.warn(`Redis get 失败 [${key}]: ${err.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err: any) {
      this.logger.warn(`Redis set 失败 [${key}]: ${err.message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err: any) {
      this.logger.warn(`Redis del 失败 [${key}]: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }
}
