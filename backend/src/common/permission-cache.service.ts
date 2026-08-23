import { Injectable, OnModuleDestroy, UnauthorizedException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { ERROR_CODES } from './error-codes';
import { MetricsService } from './metrics.service';

export interface CachedUserInfo {
  id: number;
  username: string;
  name: string;
  permissions: string[];
}

const USER_PERM_CACHE_KEY_PREFIX = 'user:perm:';
const CACHE_TTL_SECONDS = 5 * 60;
const CACHE_TTL_JITTER_SECONDS = 60;
const NULL_CACHE_TTL_SECONDS = 30;
const MEMORY_CACHE_MAX_SIZE = 1000;
const MEMORY_CACHE_CLEANUP_INTERVAL_MS = 60 * 1000;

interface MemoryCacheEntry {
  data: CachedUserInfo | null;
  expireAt: number;
}

interface InflightRequest {
  promise: Promise<CachedUserInfo | null>;
  resolve: (value: CachedUserInfo | null) => void;
  reject: (err: any) => void;
}

function jitter(base: number, jitterSec: number): number {
  return base + Math.floor(Math.random() * jitterSec);
}

@Injectable()
export class PermissionCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(PermissionCacheService.name);
  private readonly memoryCache = new Map<number, MemoryCacheEntry>();
  private readonly inflight = new Map<number, InflightRequest>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    this.startMemoryCacheCleanup();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.memoryCache.clear();
    this.inflight.clear();
  }

  async getUserPermissions(userId: number): Promise<Set<string>> {
    const info = await this.getUserInfo(userId);
    return new Set(info.permissions);
  }

  async getUserInfo(userId: number): Promise<CachedUserInfo> {
    const cached = await this.loadFromCache(userId);
    if (cached !== null) {
      return cached;
    }

    const inflightKey = userId;
    const existing = this.inflight.get(inflightKey);
    if (existing) {
      const result = await existing.promise;
      if (result === null) {
        throw new UnauthorizedException({
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'token 无效或过期',
        });
      }
      return result;
    }

    let resolve!: (value: CachedUserInfo | null) => void;
    let reject!: (err: any) => void;
    const promise = new Promise<CachedUserInfo | null>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    promise.catch(() => {});
    this.inflight.set(inflightKey, { promise, resolve, reject });

    try {
      let userInfo: CachedUserInfo;
      try {
        userInfo = await this.fetchFromDb(userId);
      } catch (err: any) {
        if (err instanceof UnauthorizedException) throw err;
        this.logger.error(`从 DB 加载用户权限失败 [user=${userId}]: ${err.message}`);
        const stale = await this.loadStaleFromMemory(userId);
        if (stale) {
          this.logger.warn(`DB 不可用，使用内存缓存降级 [user=${userId}]`);
          resolve(stale);
          return stale;
        }
        throw err;
      }
      await this.writeCache(userId, userInfo);
      resolve(userInfo);
      return userInfo;
    } catch (err) {
      reject(err);
      throw err;
    } finally {
      this.inflight.delete(inflightKey);
    }
  }

  async invalidateUser(userId: number): Promise<void> {
    const key = USER_PERM_CACHE_KEY_PREFIX + userId;
    if (this.redis.isEnabled) {
      try {
        await this.redis.del(key);
      } catch (err: any) {
        this.logger.warn(`Redis 删除缓存失败 [user=${userId}]: ${err.message}`);
      }
    }
    this.memoryCache.delete(userId);
  }

  private cacheKey(userId: number): string {
    return USER_PERM_CACHE_KEY_PREFIX + userId;
  }

  private async loadFromCache(userId: number): Promise<CachedUserInfo | null> {
    if (this.redis.isEnabled) {
      const cached = await this.redis.get(this.cacheKey(userId));
      if (cached !== null) {
        this.metrics?.recordCacheHit('permission');
        try {
          const parsed = JSON.parse(cached);
          if (parsed === null || parsed.__isNull) return null;
          return parsed as CachedUserInfo;
        } catch {
          return null;
        }
      }
      this.metrics?.recordCacheMiss('permission');
      return null;
    }

    const entry = this.memoryCache.get(userId);
    if (entry && entry.expireAt > Date.now()) {
      this.metrics?.recordCacheHit('permission');
      return entry.data;
    }
    if (entry) {
      this.memoryCache.delete(userId);
    }
    return null;
  }

  private loadStaleFromMemory(userId: number): CachedUserInfo | null {
    const entry = this.memoryCache.get(userId);
    if (entry && entry.data) {
      return entry.data;
    }
    return null;
  }

  private async writeCache(userId: number, data: CachedUserInfo | null): Promise<void> {
    const ttl = data === null ? NULL_CACHE_TTL_SECONDS : jitter(CACHE_TTL_SECONDS, CACHE_TTL_JITTER_SECONDS);
    const payload = data === null ? JSON.stringify({ __isNull: true }) : JSON.stringify(data);

    if (this.redis.isEnabled) {
      try {
        await this.redis.set(this.cacheKey(userId), payload, ttl);
      } catch (err: any) {
        this.logger.warn(`写入 Redis 缓存失败 [user=${userId}]: ${err.message}`);
      }
    } else {
      this.evictOldestIfNeeded();
      this.memoryCache.set(userId, {
        data,
        expireAt: Date.now() + ttl * 1000,
      });
    }
  }

  private async fetchFromDb(userId: number): Promise<CachedUserInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });
    if (!user) {
      await this.writeCache(userId, null);
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: 'token 无效或过期',
      });
    }
    return {
      id: user.id,
      username: user.username,
      name: user.realName,
      permissions: Array.from(
        new Set(
          user.roles.flatMap((ur: any) =>
            ur.role.permissions.map((rp: any) => rp.permission.code),
          ),
        ),
      ),
    };
  }

  private startMemoryCacheCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const keysToDelete: number[] = [];
      for (const [key, entry] of this.memoryCache) {
        if (entry.expireAt <= now) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.memoryCache.delete(key);
      }
    }, MEMORY_CACHE_CLEANUP_INTERVAL_MS);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private evictOldestIfNeeded() {
    if (this.memoryCache.size < MEMORY_CACHE_MAX_SIZE) return;
    let oldestKey: number | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.memoryCache) {
      if (entry.expireAt < oldestTime) {
        oldestTime = entry.expireAt;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) {
      this.memoryCache.delete(oldestKey);
    }
  }
}
