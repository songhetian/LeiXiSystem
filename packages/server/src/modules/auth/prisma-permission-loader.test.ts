import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createPrismaPermissionLoader } from './prisma-permission-loader';

function mockPrisma(findMany = vi.fn(async () => [])) {
  return { permission: { findMany } } as unknown as PrismaClient;
}

describe('prisma-permission-loader 查询组装（Seam D）', () => {
  it('按 roleIds 查询权限码并返回 code 数组', async () => {
    const findMany = vi.fn(async () => [
      { code: 'user_create' },
      { code: 'leave_approve' },
    ]);
    const prisma = mockPrisma(findMany);
    const loader = createPrismaPermissionLoader(prisma);

    await expect(loader.loadPermissionCodes([1, 2])).resolves.toEqual([
      'user_create',
      'leave_approve',
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { roles: { some: { roleId: { in: [1, 2] } } } },
      select: { code: true },
    });
  });

  it('roleIds 为空时直接返回空数组，不触库', async () => {
    const findMany = vi.fn();
    const prisma = mockPrisma(findMany);
    const loader = createPrismaPermissionLoader(prisma);

    await expect(loader.loadPermissionCodes([])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});