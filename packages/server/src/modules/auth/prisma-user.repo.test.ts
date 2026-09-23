import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createPrismaUserRepo } from './prisma-user.repo';

/** 最小 PrismaClient mock：仅暴露 repo 用到的 user.findUnique */
function mockPrisma(userRow: unknown) {
  const findUnique = vi.fn(async () => userRow);
  return {
    user: { findUnique },
    // 其余字段用不到，运行时也不会被访问
  } as unknown as PrismaClient;
}

describe('prisma-user.repo 查询组装（Seam D）', () => {
  it('findByUsername 把 user+roles 组装成 UserProjection（含 roleIds）', async () => {
    const prisma = mockPrisma({
      id: 3,
      username: 'alice',
      password: 'hash',
      realName: '爱丽丝',
      status: 'active',
      departmentId: 7,
      roles: [{ role: { id: 1 } }, { role: { id: 2 } }],
    });
    const repo = createPrismaUserRepo(prisma);

    const u = await repo.findByUsername('alice');
    expect(u).toEqual({
      id: 3,
      username: 'alice',
      password: 'hash',
      realName: '爱丽丝',
      status: 'active',
      departmentId: 7,
      roleIds: [1, 2],
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'alice' },
      include: { roles: { include: { role: true } } },
    });
  });

  it('findByUsername 查询不到返回 null', async () => {
    const prisma = mockPrisma(null);
    const repo = createPrismaUserRepo(prisma);
    expect(await repo.findByUsername('nobody')).toBeNull();
  });

  it('findById 按主键查询并组装', async () => {
    const prisma = mockPrisma({
      id: 9,
      username: 'bob',
      password: 'h',
      realName: '鲍勃',
      status: 'disabled',
      departmentId: null,
      roles: [],
    });
    const repo = createPrismaUserRepo(prisma);

    const u = await repo.findById(9);
    expect(u?.roleIds).toEqual([]);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 9 },
      include: { roles: { include: { role: true } } },
    });
  });
});