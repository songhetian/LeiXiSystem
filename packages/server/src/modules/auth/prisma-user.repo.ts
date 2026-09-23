import type { Prisma, PrismaClient } from '@prisma/client';

type UserWithRoles = Prisma.UserGetPayload<{ include: { roles: { include: { role: true } } } }>;

/** 由 Prisma 用户行（含角色关联）组装成路由层的 UserProjection */
function toProjection(u: UserWithRoles) {
  return {
    id: u.id,
    username: u.username,
    password: u.password,
    realName: u.realName,
    status: u.status,
    departmentId: u.departmentId,
    roleIds: u.roles.flatMap((ur) => (ur.role ? [ur.role.id] : [])),
  };
}

/**
 * Prisma 实现的 UserRepo：把 users + user_roles + roles 组装成 UserProjection。
 * 隔离点：调用方注入 PrismaClient，测试传 mock。
 */
export function createPrismaUserRepo(prisma: Pick<PrismaClient, 'user'>) {
  const query = { include: { roles: { include: { role: true } } } };

  return {
    async findByUsername(username: string) {
      const row = await prisma.user.findUnique({ where: { username }, ...query });
      return row ? toProjection(row) : null;
    },
    async findById(id: number) {
      const row = await prisma.user.findUnique({ where: { id }, ...query });
      return row ? toProjection(row) : null;
    },
  };
}