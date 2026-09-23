import type { Prisma, PrismaClient } from '@prisma/client';
import type { PermissionPoint, RoleWithPermissions, UserWithRoles } from '@leixi/shared';

type RoleWithPerms = Prisma.RoleGetPayload<{
  include: { permissions: { select: { permission: true } } };
}>;
type UserWithRolesRow = Prisma.UserGetPayload<{ include: { roles: { select: { roleId: true } } } }>;

/** RBAC 数据访问：角色权限、权限点、用户-角色 的查询与赋值（全量替换） */
type RbacPrisma = Pick<
  PrismaClient,
  'role' | 'rolePermission' | 'permission' | 'user' | 'userRole' | '$transaction'
>;

export function createPrismaRbacRepo(prisma: RbacPrisma) {
  return {
    async listRoles(): Promise<RoleWithPermissions[]> {
      const rows = await prisma.role.findMany({
        include: { permissions: { select: { permission: true } } },
      });
      return rows.map((r: RoleWithPerms) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissionIds: r.permissions.map((rp) => rp.permission.id),
      }));
    },

    async listPermissions(): Promise<PermissionPoint[]> {
      const rows = await prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { code: 'asc' }],
      });
      return rows.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        type: p.type as PermissionPoint['type'],
        module: p.module,
      }));
    },

    /** 全量替换角色权限：先删后建。返回 void。 */
    async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({ where: { roleId } }),
        prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        }),
      ]);
    },

    async listUsers(): Promise<UserWithRoles[]> {
      const rows = await prisma.user.findMany({
        include: { roles: { select: { roleId: true } } },
      });
      return rows.map((u: UserWithRolesRow) => ({
        id: u.id,
        username: u.username,
        realName: u.realName,
        status: u.status,
        roleIds: u.roles.map((ur) => ur.roleId),
        departmentId: u.departmentId,
      }));
    },

    /** 全量替换用户角色：先删后建。返回 void。 */
    async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
      await prisma.$transaction([
        prisma.userRole.deleteMany({ where: { userId } }),
        prisma.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId })),
        }),
      ]);
    },

    async createUser(data: {
      username: string;
      password: string;
      realName: string;
      roleIds: number[];
    }): Promise<{ id: number }> {
      const user = await prisma.user.create({
        data: { username: data.username, password: data.password, realName: data.realName },
      });
      if (data.roleIds.length > 0) {
        await prisma.userRole.createMany({
          data: data.roleIds.map((roleId) => ({ userId: user.id, roleId })),
        });
      }
      return { id: user.id };
    },

    async updateUser(
      id: number,
      data: { realName?: string; status?: string; password?: string; roleIds?: number[] },
    ): Promise<void> {
      await prisma.user.update({
        where: { id },
        data: { realName: data.realName, status: data.status, password: data.password },
      });
      if (data.roleIds) {
        await prisma.$transaction([
          prisma.userRole.deleteMany({ where: { userId: id } }),
          prisma.userRole.createMany({
            data: data.roleIds.map((roleId) => ({ userId: id, roleId })),
          }),
        ]);
      }
    },

    async deleteUser(id: number): Promise<void> {
      await prisma.user.delete({ where: { id } });
    },
  };
}