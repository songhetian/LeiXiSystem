import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createPrismaRbacRepo } from './prisma-rbac.repo';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    role: { findMany: vi.fn(async () => []), update: vi.fn() },
    permission: { findMany: vi.fn(async () => []) },
    rolePermission: { deleteMany: vi.fn(async () => ({ count: 0 })), createMany: vi.fn() },
    user: { findMany: vi.fn(async () => []) },
    userRole: { deleteMany: vi.fn(async () => ({ count: 0 })), createMany: vi.fn() },
    $transaction: async (ops: Array<Promise<unknown>>) => {
      for (const op of ops) await op;
    },
    ...overrides,
  } as unknown as PrismaClient;
}

const ROLE_ROW = {
  id: 1,
  name: 'admin',
  description: null,
  isSystem: true,
  permissions: [{ permission: { id: 10 } }, { permission: { id: 11 } }],
};

describe('prisma-rbac.repo（Seam E）', () => {
  it('listRoles 组装出 role.permissionIds', async () => {
    const prisma = mockPrisma({ role: { findMany: vi.fn(async () => [ROLE_ROW]) } });
    const repo = createPrismaRbacRepo(prisma);
    const roles = await repo.listRoles();
    expect(roles[0]).toMatchObject({ id: 1, name: 'admin', isSystem: true, permissionIds: [10, 11] });
  });

  it('listPermissions 返回权限点', async () => {
    const prisma = mockPrisma({
      permission: { findMany: vi.fn(async () => [{ id: 1, code: 'user_view', name: '查看用户', type: 'menu', module: 'user' }]) },
    });
    const repo = createPrismaRbacRepo(prisma);
    const perms = await repo.listPermissions();
    expect(perms[0]?.code).toBe('user_view');
  });

  it('setRolePermissions 全量替换：deleteMany + createMany', async () => {
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    const createMany = vi.fn();
    const prisma = mockPrisma({ rolePermission: { deleteMany, createMany } });
    const repo = createPrismaRbacRepo(prisma);

    await repo.setRolePermissions(3, [10, 11]);
    expect(deleteMany).toHaveBeenCalledWith({ where: { roleId: 3 } });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 3, permissionId: 10 },
        { roleId: 3, permissionId: 11 },
      ],
    });
  });

  it('listUsers 组装出 user.roleIds', async () => {
    const prisma = mockPrisma({
      user: { findMany: vi.fn(async () => [{ id: 5, username: 'alice', realName: '爱丽丝', status: 'active', roles: [{ roleId: 1 }, { roleId: 2 }] }]) },
    });
    const repo = createPrismaRbacRepo(prisma);
    const users = await repo.listUsers();
    expect(users[0]).toMatchObject({ id: 5, username: 'alice', status: 'active', roleIds: [1, 2] });
  });

  it('setUserRoles 全量替换：deleteMany + createMany', async () => {
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    const createMany = vi.fn();
    const prisma = mockPrisma({ userRole: { deleteMany, createMany } });
    const repo = createPrismaRbacRepo(prisma);

    await repo.setUserRoles(9, [2, 3]);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 9 } });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { userId: 9, roleId: 2 },
        { userId: 9, roleId: 3 },
      ],
    });
  });
});