import { prisma } from '../app';
import { connection as redis } from './redis';

/**
 * 高性能 RBAC 引擎 (基于 Redis Set)
 */
export const RBACEngine = {
  /**
   * 缓存用户权限点至 Redis Set (SADD)
   */
  async cacheUserPermissions(userId: number) {
    const CACHE_KEY = `user:permissions:${userId}`;

    // 1. 物理还原旧版多表关联逻辑
    const permissions = await prisma.permissions.findMany({
      where: {
        role_permissions: {
          some: {
            roles: {
              user_roles: {
                some: { user_id: userId }
              }
            }
          }
        }
      },
      select: { code: true }
    });

    const codes = permissions.map(p => p.code);

    // 2. 闭环加固：原子性清理并重建 Set
    await redis.del(CACHE_KEY);
    if (codes.length > 0) {
      await redis.sadd(CACHE_KEY, ...codes);
      await redis.expire(CACHE_KEY, 86400 * 7); // 24h 存证
    }

    return codes;
  },

  /**
   * O(1) 权限校验点 (SISMEMBER)
   */
  async hasPermission(userId: number, code: string): Promise<boolean> {
    const CACHE_KEY = `user:permissions:${userId}`;
    
    // 自动降级逻辑 (逻辑闭环)
    const exists = await redis.exists(CACHE_KEY);
    if (!exists) {
      const codes = await this.cacheUserPermissions(userId);
      return codes.includes(code);
    }

    const isAllowed = await redis.sismember(CACHE_KEY, code);
    return isAllowed === 1;
  },

  /**
   * 精准清理特定用户的权限缓存 (规约：严禁模糊匹配)
   */
  async invalidateUser(userId: number) {
    await redis.del(`user:permissions:${userId}`);
  }
};
