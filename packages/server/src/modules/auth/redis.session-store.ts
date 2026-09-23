import Redis from 'ioredis';
import type { SessionStore } from './auth.service';

const KEY = (userId: number) => `leixi:session:${userId}`;

/** Redis 会话存储：单设备登录时新会话覆盖旧会话（set 新 sid 即踢旧） */
export function createRedisSessionStore(redis: Redis): SessionStore {
  return {
    async set(userId, sessionId) {
      await redis.set(KEY(userId), sessionId, 'EX', 60 * 60 * 24 * 30); // 30d
    },
    async get(userId) {
      return redis.get(KEY(userId));
    },
    async delete(userId) {
      await redis.del(KEY(userId));
    },
  };
}