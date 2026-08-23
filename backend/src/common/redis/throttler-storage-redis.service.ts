import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

interface MemoryRecord {
  hits: number[];
  blockedUntil: number;
}

@Injectable()
export class ThrottlerStorageRedis implements ThrottlerStorage {
  private readonly logger = new Logger(ThrottlerStorageRedis.name);
  private memoryStore = new Map<string, MemoryRecord>();

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redis.isEnabled) {
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }

    try {
      const client = this.redis.getClient();
      if (!client) {
        return this.incrementMemory(key, ttl, limit, blockDuration);
      }

      const now = Date.now();
      const ttlMs = ttl * 1000;
      const windowStart = now - ttlMs;
      const keyStr = `throttler:${throttlerName}:${key}`;
      const blockKey = `${keyStr}:blocked`;

      const blocked = await client.get(blockKey);
      if (blocked) {
        const blockTtl = await client.pttl(blockKey);
        return {
          totalHits: limit,
          timeToExpire: Math.max(0, ttlMs),
          isBlocked: true,
          timeToBlockExpire: Math.max(0, blockTtl > 0 ? blockTtl : blockDuration * 1000),
        };
      }

      const member = now.toString();
      const pipeline = client.pipeline();
      pipeline.zremrangebyscore(keyStr, 0, windowStart);
      pipeline.zadd(keyStr, now, member);
      pipeline.pexpire(keyStr, ttlMs);
      pipeline.zcard(keyStr);

      const results = await pipeline.exec();
      const totalHits = (results?.[3]?.[1] as number) ?? 1;

      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        await client.set(
          blockKey,
          '1',
          'PX',
          blockDuration * 1000,
        );
        timeToBlockExpire = blockDuration * 1000;
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, ttlMs - (now - windowStart)),
        isBlocked,
        timeToBlockExpire,
      };
    } catch (err: any) {
      this.logger.warn(`限流 Redis 操作失败，降级到内存存储: ${err.message}`);
      return this.incrementMemory(key, ttl, limit, blockDuration);
    }
  }

  async getRecord(key: string): Promise<number[]> {
    if (!this.redis.isEnabled) {
      return this.getRecordMemory(key);
    }

    try {
      const client = this.redis.getClient();
      if (!client) {
        return this.getRecordMemory(key);
      }

      const keyStr = `throttler:${key}`;
      const now = Date.now();

      const scores = await client.zrange(keyStr, 0, -1 as any);
      const hits = (scores as string[]).map(Number).filter((t) => t > now - 60000);
      return hits;
    } catch (err: any) {
      this.logger.warn(`限流 Redis 读取失败，降级到内存存储: ${err.message}`);
      return this.getRecordMemory(key);
    }
  }

  async addRecord(key: string, ttl: number): Promise<void> {
    if (!this.redis.isEnabled) {
      this.addRecordMemory(key, ttl);
      return;
    }

    try {
      const client = this.redis.getClient();
      if (!client) {
        this.addRecordMemory(key, ttl);
        return;
      }

      const keyStr = `throttler:${key}`;
      const now = Date.now();
      const ttlMs = ttl * 1000;

      const pipeline = client.pipeline();
      pipeline.zadd(keyStr, now, now.toString());
      pipeline.pexpire(keyStr, ttlMs);
      await pipeline.exec();
    } catch (err: any) {
      this.logger.warn(`限流 Redis 写入失败，降级到内存存储: ${err.message}`);
      this.addRecordMemory(key, ttl);
    }
  }

  async reset(key: string): Promise<void> {
    if (!this.redis.isEnabled) {
      this.memoryStore.delete(key);
      return;
    }

    try {
      const client = this.redis.getClient();
      if (!client) {
        this.memoryStore.delete(key);
        return;
      }
      await client.del(`throttler:${key}`, `throttler:${key}:blocked`);
    } catch (err: any) {
      this.logger.warn(`限流 Redis 重置失败: ${err.message}`);
      this.memoryStore.delete(key);
    }
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const ttlMs = ttl * 1000;
    const windowStart = now - ttlMs;

    let record = this.memoryStore.get(key);
    if (!record) {
      record = { hits: [], blockedUntil: 0 };
      this.memoryStore.set(key, record);
    }

    if (record.blockedUntil > now) {
      return {
        totalHits: limit + 1,
        timeToExpire: Math.max(0, ttlMs),
        isBlocked: true,
        timeToBlockExpire: record.blockedUntil - now,
      };
    }

    record.hits = record.hits.filter((t) => t > windowStart);
    record.hits.push(now);

    const totalHits = record.hits.length;
    const isBlocked = totalHits > limit;
    let timeToBlockExpire = 0;

    if (isBlocked && blockDuration > 0) {
      record.blockedUntil = now + blockDuration * 1000;
      timeToBlockExpire = blockDuration * 1000;
    }

    const oldest = record.hits[0];
    const timeToExpire = oldest ? Math.max(0, oldest + ttlMs - now) : ttlMs;

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }

  private getRecordMemory(key: string): number[] {
    const record = this.memoryStore.get(key);
    if (!record) return [];
    const now = Date.now();
    return record.hits.filter((t) => t > now - 60000);
  }

  private addRecordMemory(key: string, ttl: number): void {
    const now = Date.now();
    const ttlMs = ttl * 1000;
    const windowStart = now - ttlMs;

    let record = this.memoryStore.get(key);
    if (!record) {
      record = { hits: [], blockedUntil: 0 };
      this.memoryStore.set(key, record);
    }
    record.hits = record.hits.filter((t) => t > windowStart);
    record.hits.push(now);
  }
}
