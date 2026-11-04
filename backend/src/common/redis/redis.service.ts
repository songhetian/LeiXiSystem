import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import Redis from 'ioredis';
import { errorMessage } from '../error.util';

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
  /** 连接健康度：仅在收到 ready 事件后为 true，任何连接异常立即回退 false */
  private healthy = false;
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
      this.client.on('ready', () => {
        this.healthy = true;
      });
      this.client.on('end', () => {
        this.healthy = false;
      });
      this.client.on('close', () => {
        this.healthy = false;
      });
      this.client.on('error', (err) => {
        this.healthy = false;
        this.logger.warn(`Redis 连接异常: ${err.message}`);
      });
    }
  }

  /**
   * Redis 是否「可用」：已配置且连接健康。
   * 与 isEnabled 的区别：isEnabled 只表示配置了 REDIS_URL，进程刚启动或连接断开时
   * 仍为 true。限流/鉴权/二级密码通行证等安全相关逻辑必须按可用性判断，
   * 否则会出现「配置了但连不上 → get 返回 null → 校验 fail-open」（S23 A2/A3）。
   */
  isAvailable(): boolean {
    return this.isEnabled && this.healthy;
  }

  getClient(): Redis {
    if (!this.client) throw new ServiceUnavailableException({ code: 5007, message: 'Redis 未启用（REDIS_URL 未配置）' });
    return this.client;
  }

  async ping(): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.ping();
    } catch (err) {
      this.logger.warn(`Redis ping 失败: ${errorMessage(err)}`);
      return null;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (err) {
      this.logger.warn(`Redis incr 失败 [${key}]: ${errorMessage(err)}`);
      return 0;
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.expire(key, seconds);
    } catch (err) {
      this.logger.warn(`Redis expire 失败 [${key}]: ${errorMessage(err)}`);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      this.logger.warn(`Redis get 失败 [${key}]: ${errorMessage(err)}`);
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
    } catch (err) {
      this.logger.warn(`Redis set 失败 [${key}]: ${errorMessage(err)}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Redis del 失败 [${key}]: ${errorMessage(err)}`);
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
