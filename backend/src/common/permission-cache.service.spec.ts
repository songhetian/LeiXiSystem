import { PermissionCacheService } from './permission-cache.service';
import { UnauthorizedException } from '@nestjs/common';

function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
    },
  } as any;
}

function createMockRedis(enabled = true) {
  return {
    isEnabled: enabled,
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockMetrics() {
  return {
    recordCacheHit: jest.fn(),
    recordCacheMiss: jest.fn(),
  };
}

function buildMockUser(userId: number, permissionCodes: string[]) {
  return {
    id: userId,
    username: `user${userId}`,
    realName: `用户${userId}`,
    roles: [
      {
        role: {
          permissions: permissionCodes.map((code) => ({ permission: { code } })),
        },
      },
    ],
  };
}

describe('PermissionCacheService', () => {
  let service: PermissionCacheService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let metrics: ReturnType<typeof createMockMetrics>;

  beforeEach(() => {
    jest.useFakeTimers();
    prisma = createMockPrisma();
    redis = createMockRedis(true);
    metrics = createMockMetrics();
    service = new PermissionCacheService(prisma, redis, metrics as any);
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  describe('getUserInfo - 基本流程', () => {
    it('首次调用从 DB 加载并缓存到 Redis', async () => {
      const user = buildMockUser(1, ['employee:view', 'attendance:view']);
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserInfo(1);

      expect(result.id).toBe(1);
      expect(result.username).toBe('user1');
      expect(result.name).toBe('用户1');
      expect(result.permissions).toEqual(expect.arrayContaining(['employee:view', 'attendance:view']));
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(metrics.recordCacheMiss).toHaveBeenCalledTimes(1);
    });

    it('第二次调用从 Redis 缓存读取，不查 DB', async () => {
      const user = buildMockUser(1, ['employee:view']);
      prisma.user.findUnique.mockResolvedValue(user);

      await service.getUserInfo(1);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      redis.get.mockResolvedValue(JSON.stringify({
        id: 1, username: 'user1', name: '用户1', permissions: ['employee:view'],
      }));

      const result = await service.getUserInfo(1);

      expect(result.id).toBe(1);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(metrics.recordCacheHit).toHaveBeenCalled();
    });

    it('getUserPermissions 返回 Set 集合', async () => {
      const user = buildMockUser(1, ['a:view', 'b:manage']);
      prisma.user.findUnique.mockResolvedValue(user);

      const perms = await service.getUserPermissions(1);

      expect(perms).toBeInstanceOf(Set);
      expect(perms.has('a:view')).toBe(true);
      expect(perms.has('b:manage')).toBe(true);
      expect(perms.has('c:none')).toBe(false);
    });
  });

  describe('用户不存在', () => {
    it('用户不存在时抛出 UnauthorizedException', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserInfo(999)).rejects.toThrow(UnauthorizedException);
    });

    it('用户不存在时写入 null 缓存（防止穿透）', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      try {
        await service.getUserInfo(999);
      } catch {}

      expect(redis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('__isNull'),
        expect.any(Number),
      );
    });
  });

  describe('Redis 不可用时的内存缓存', () => {
    beforeEach(() => {
      redis = createMockRedis(false);
      service = new PermissionCacheService(prisma, redis, metrics as any);
    });

    it('使用内存缓存存储和读取', async () => {
      const user = buildMockUser(2, ['payroll:view']);
      prisma.user.findUnique.mockResolvedValue(user);

      const first = await service.getUserInfo(2);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      const second = await service.getUserInfo(2);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(second.id).toBe(2);
      expect(metrics.recordCacheHit).toHaveBeenCalledTimes(1);
    });

    it('内存缓存过期后重新从 DB 加载', async () => {
      const user = buildMockUser(3, ['knowledge:view']);
      prisma.user.findUnique.mockResolvedValue(user);

      await service.getUserInfo(3);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(10 * 60 * 1000);

      await service.getUserInfo(3);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('inflight 请求合并', () => {
    it('并发请求同一用户只查一次 DB', async () => {
      let resolveDb: (value: any) => void;
      const dbPromise = new Promise<any>((res) => { resolveDb = res; });
      prisma.user.findUnique.mockReturnValue(dbPromise);

      const promise1 = service.getUserInfo(1);
      const promise2 = service.getUserInfo(1);
      const promise3 = service.getUserInfo(1);

      await Promise.resolve();
      await Promise.resolve();

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      resolveDb!(buildMockUser(1, ['test:perm']));

      const [r1, r2, r3] = await Promise.all([promise1, promise2, promise3]);

      expect(r1.id).toBe(1);
      expect(r2.id).toBe(1);
      expect(r3.id).toBe(1);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('DB 失败时的降级策略', () => {
    it('DB 挂了但内存有旧数据时，返回旧数据降级', async () => {
      redis = createMockRedis(false);
      service = new PermissionCacheService(prisma, redis, metrics as any);

      const user = buildMockUser(5, ['old:perm']);
      prisma.user.findUnique.mockResolvedValue(user);
      await service.getUserInfo(5);

      prisma.user.findUnique.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.getUserInfo(5);

      expect(result.id).toBe(5);
      expect(result.permissions).toContain('old:perm');
    });

    it('DB 挂了且没有内存缓存时，抛出错误', async () => {
      redis = createMockRedis(false);
      service = new PermissionCacheService(prisma, redis, metrics as any);

      prisma.user.findUnique.mockRejectedValue(new Error('DB down'));

      await expect(service.getUserInfo(6)).rejects.toThrow('DB down');
    });
  });

  describe('invalidateUser 缓存失效', () => {
    it('删除 Redis 和内存缓存', async () => {
      const user = buildMockUser(7, ['perm:a']);
      prisma.user.findUnique.mockResolvedValue(user);

      await service.getUserInfo(7);

      await service.invalidateUser(7);

      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('7'));

      redis.get.mockResolvedValue(null);
      await service.getUserInfo(7);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('权限去重', () => {
    it('多角色重复权限自动去重', async () => {
      const user = {
        id: 8,
        username: 'u8',
        realName: 'U8',
        roles: [
          { role: { permissions: [{ permission: { code: 'shared:view' } }, { permission: { code: 'role1:perm' } }] } },
          { role: { permissions: [{ permission: { code: 'shared:view' } }, { permission: { code: 'role2:perm' } }] } },
        ],
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserInfo(8);

      expect(result.permissions).toHaveLength(3);
      expect(new Set(result.permissions).size).toBe(3);
      expect(result.permissions).toEqual(expect.arrayContaining(['shared:view', 'role1:perm', 'role2:perm']));
    });
  });
});
