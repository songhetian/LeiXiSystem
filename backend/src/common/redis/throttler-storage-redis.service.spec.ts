import { ThrottlerStorageRedis } from './throttler-storage-redis.service';

function createMockRedis(enabled = true) {
  return {
    isEnabled: enabled,
    getClient: jest.fn().mockReturnValue({
      pipeline: jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        pexpire: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        pttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 0],
          [null, 'OK'],
          [null, 1],
          [null, 60000],
        ]),
      }),
      zrange: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    }),
  } as any;
}

describe('ThrottlerStorageRedis', () => {
  describe('内存模式（Redis 不可用）', () => {
    let storage: ThrottlerStorageRedis;

    beforeEach(() => {
      const redis = createMockRedis(false);
      storage = new ThrottlerStorageRedis(redis);
    });

    it('increment: 第一次调用返回 1 次命中，未被阻止', async () => {
      const result = await storage.increment('test-key', 60, 10, 0, 'default');
      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);
      expect(result.timeToExpire).toBeGreaterThan(0);
    });

    it('increment: 未超过 limit 时不阻止', async () => {
      for (let i = 0; i < 5; i++) {
        const r = await storage.increment('key1', 60, 10, 0, 'default');
        expect(r.isBlocked).toBe(false);
      }
      const result = await storage.increment('key1', 60, 10, 0, 'default');
      expect(result.totalHits).toBe(6);
      expect(result.isBlocked).toBe(false);
    });

    it('increment: 超过 limit 时标记为阻止', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.increment('key2', 60, 10, 0, 'default');
      }
      const result = await storage.increment('key2', 60, 10, 0, 'default');
      expect(result.totalHits).toBe(11);
      expect(result.isBlocked).toBe(true);
    });

    it('increment: 不同 key 互不影响', async () => {
      await storage.increment('a', 60, 10, 0, 'default');
      await storage.increment('a', 60, 10, 0, 'default');
      const resultB = await storage.increment('b', 60, 10, 0, 'default');
      expect(resultB.totalHits).toBe(1);
    });

    it('addRecord + getRecord 正常工作', async () => {
      await storage.addRecord('test', 60);
      const record = await storage.getRecord('test');
      expect(record.length).toBe(1);
    });

    it('reset 清空计数', async () => {
      await storage.increment('x', 60, 10, 0, 'default');
      await storage.increment('x', 60, 10, 0, 'default');
      await storage.reset('x');
      const record = await storage.getRecord('x');
      expect(record.length).toBe(0);
    });

    it('getRecord 空 key 返回空数组', async () => {
      const record = await storage.getRecord('nonexistent');
      expect(record).toEqual([]);
    });

    it('blockDuration > 0 时设置阻止时间', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.increment('key3', 60, 10, 30, 'default');
      }
      const result = await storage.increment('key3', 60, 10, 30, 'default');
      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBe(30000);
    });
  });

  describe('Redis 模式故障降级', () => {
    it('Redis pipeline 抛错时降级到内存存储', async () => {
      const redis = createMockRedis(true);
      const client = redis.getClient();
      client.pipeline.mockReturnValue({
        zremrangebyscore: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        pexpire: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        pttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis down')),
      });

      const storage = new ThrottlerStorageRedis(redis as any);
      const result = await storage.increment('test', 60, 10, 0, 'default');
      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);
    });

    it('Redis getClient 返回 null 时降级', async () => {
      const redis = createMockRedis(true);
      redis.getClient.mockReturnValue(null);

      const storage = new ThrottlerStorageRedis(redis as any);
      const result = await storage.increment('test', 60, 10, 0, 'default');
      expect(result.totalHits).toBe(1);
    });
  });
});
