import type { PrismaClient } from '@prisma/client';
import type { RolePermissionLoader } from './permission.service';

/**
 * Prisma 实现的 RolePermissionLoader：由角色 id 集合查出权限码列表。
 * 已经在 loader 左侧做查询、右侧（permission.service）做并集去重排序。
 */
export function createPrismaPermissionLoader(
  prisma: Pick<PrismaClient, 'permission'>,
): RolePermissionLoader {
  return {
    async loadPermissionCodes(roleIds: number[]) {
      if (roleIds.length === 0) return [];
      const rows = await prisma.permission.findMany({
        where: { roles: { some: { roleId: { in: roleIds } } } },
        select: { code: true },
      });
      return rows.map((r) => r.code);
    },
  };
}