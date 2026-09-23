import { describe, it, expect, vi } from 'vitest';
import { createPrismaDepartmentRepo } from './prisma-department.repo';

type DeptMock = {
  department: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  user: { count: ReturnType<typeof vi.fn> };
  leave: { count: ReturnType<typeof vi.fn> };
};

function makeDeptMock(): DeptMock {
  return { department: { findUnique: vi.fn(), count: vi.fn(), delete: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() }, user: { count: vi.fn() }, leave: { count: vi.fn() } } as never;
}

describe('自定义 DepartmentRepo 删除保护', () => {
  it('无引用且部门存在 → 删除成功 ok', async () => {
    const m = makeDeptMock();
    m.department.findUnique.mockResolvedValue({ id: 1, name: '研发部', parentId: null });
    m.department.count.mockResolvedValueOnce(0); // children
    m.leave.count.mockResolvedValueOnce(0); // leaves
    m.user.count.mockResolvedValueOnce(0); // users
    const repo = createPrismaDepartmentRepo(m as never);
    expect(await repo.deleteDepartment(1)).toBe('ok');
    expect(m.department.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('存在子部门 → has_children', async () => {
    const m = makeDeptMock();
    m.department.findUnique.mockResolvedValue({ id: 1, name: '总部', parentId: null });
    m.department.count.mockResolvedValueOnce(2);
    const repo = createPrismaDepartmentRepo(m as never);
    expect(await repo.deleteDepartment(1)).toBe('has_children');
  });

  it('存在请假单 → has_leaves（不再排查用户）', async () => {
    const m = makeDeptMock();
    m.department.findUnique.mockResolvedValue({ id: 3, name: '市场部', parentId: null });
    m.department.count.mockResolvedValueOnce(0); // children
    m.leave.count.mockResolvedValueOnce(5);
    const repo = createPrismaDepartmentRepo(m as never);
    expect(await repo.deleteDepartment(3)).toBe('has_leaves');
  });

  it('存在用户 → has_users', async () => {
    const m = makeDeptMock();
    m.department.findUnique.mockResolvedValue({ id: 3, name: '市场部', parentId: null });
    m.department.count.mockResolvedValueOnce(0); // children
    m.leave.count.mockResolvedValueOnce(0); // leaves
    m.user.count.mockResolvedValueOnce(2); // users
    const repo = createPrismaDepartmentRepo(m as never);
    expect(await repo.deleteDepartment(3)).toBe('has_users');
  });

  it('部门不存在 → not_found', async () => {
    const m = makeDeptMock();
    m.department.findUnique.mockResolvedValue(null);
    const repo = createPrismaDepartmentRepo(m as never);
    expect(await repo.deleteDepartment(999)).toBe('not_found');
  });
});