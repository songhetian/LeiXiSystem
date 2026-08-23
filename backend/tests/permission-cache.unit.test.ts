import { PermissionCacheService } from '../src/common/permission-cache.service';
import { PrismaService } from '../src/prisma/prisma.service';

function makeRedisMock(store: Record<string, string> = {}) {
  const storeObj = { ...store };
  return {
    isEnabled: true,
    store: storeObj,
    get: jest.fn((k: string) => Promise.resolve(k in storeObj ? storeObj[k] : null)),
    set: jest.fn((k: string, v: string, ttl?: number) => {
      storeObj[k] = v;
      return Promise.resolve();
    }),
    del: jest.fn((k: string) => {
      delete storeObj[k];
      return Promise.resolve();
    }),
  };
}

function makePrismaMock(users: Record<number, any> = {}) {
  return {
    user: {
      findUnique: jest.fn((args: any) => {
        const user = users[args.where.id];
        return user ? Promise.resolve(user) : Promise.resolve(null);
      }),
    },
  };
}

function buildUserWithPerms(userId: number, username: string, permCodes: string[]) {
  return {
    id: userId,
    username,
    realName: `用户${username}`,
    roles: permCodes.map((code) => ({
      role: {
        permissions: [{ permission: { code } }],
      },
    })),
  };
}

describe('PermissionCacheService', () => {
  describe('getUserPermissions', () => {
    it('首次调用查数据库，第二次走 Redis 缓存', async () => {
      const redis = makeRedisMock();
      const prisma = makePrismaMock({
        1: buildUserWithPerms(1, 'alice', ['user:read', 'user:write']),
      });
      const svc = new PermissionCacheService(prisma as any, redis as any);

      const result1 = await svc.getUserPermissions(1);
      expect(result1).toBeInstanceOf(Set);
      expect(result1.has('user:read')).toBe(true);
      expect(result1.has('user:write')).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      const result2 = await svc.getUserPermissions(1);
      expect(result2.has('user:read')).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
      expect(redis.get).toHaveBeenCalledTimes(2);
    });

    it('Redis 未启用时，使用本地内存缓存', async () => {
      const redis = makeRedisMock();
      redis.isEnabled = false;
      const prisma = makePrismaMock({
        1: buildUserWithPerms(1, 'alice', ['perm:1']),
      });
      const svc = new PermissionCacheService(prisma as any, redis as any);

      await svc.getUserPermissions(1);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      await svc.getUserPermissions(1);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    it('invalidateUser 后再次调用会重新查库', async () => {
      const redis = makeRedisMock();
      const prisma = makePrismaMock({
        1: buildUserWithPerms(1, 'alice', ['perm:1']),
      });
      const svc = new PermissionCacheService(prisma as any, redis as any);

      await svc.getUserPermissions(1);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);

      await svc.invalidateUser(1);

      await svc.getUserPermissions(1);
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserInfo', () => {
    it('返回用户公开信息（含 id/username/name/permissions）', async () => {
      const redis = makeRedisMock();
      const prisma = makePrismaMock({
        1: buildUserWithPerms(1, 'alice', ['user:read']),
      });
      const svc = new PermissionCacheService(prisma as any, redis as any);

      const info = await svc.getUserInfo(1);
      expect(info.id).toBe(1);
      expect(info.username).toBe('alice');
      expect(info.name).toBe('用户alice');
      expect(info.permissions).toContain('user:read');
    });

    it('用户不存在时抛出 AUTH_TOKEN_INVALID', async () => {
      const redis = makeRedisMock();
      const prisma = makePrismaMock({});
      const svc = new PermissionCacheService(prisma as any, redis as any);

      await expect(svc.getUserInfo(999)).rejects.toMatchObject({
        response: { code: 5002 },
      });
    });
  });
});
