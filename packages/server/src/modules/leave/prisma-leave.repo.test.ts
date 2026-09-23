import { describe, it, expect, vi } from 'vitest';
import { createPrismaLeaveRepo } from './prisma-leave.repo';

function makeLeaveMock(
  findMany = vi.fn(),
  create = vi.fn(),
  findUnique = vi.fn(),
  update = vi.fn(),
) {
  return { leave: { findMany, create, findUnique, update } } as never;
}

describe('自定义 LeaveRepo（scope 下沉到 where.departmentId）', () => {
  it('subtree scope → findMany.where.departmentId.in 等于可见部门集合', async () => {
    const findMany = vi.fn(async (args: { where: { departmentId?: { in: number[] } } }) => []);
    const repo = createPrismaLeaveRepo(makeLeaveMock(findMany) as never);
    await repo.listLeaves({ kind: 'subtree', departmentIds: [2, 3, 4, 5] });
    const args = findMany.mock.calls[0]![0];
    expect(args.where.departmentId?.in).toEqual([2, 3, 4, 5]);
  });

  it('all scope → where 不含 departmentId 过滤（系统级）', async () => {
    const findMany = vi.fn(async (args: { where: Record<string, unknown> }) => []);
    const repo = createPrismaLeaveRepo(makeLeaveMock(findMany) as never);
    await repo.listLeaves({ kind: 'all' });
    const args = findMany.mock.calls[0]![0];
    expect(args.where.departmentId).toBeUndefined();
  });

  it('createLeave 强制写入 applicantId 与 departmentId', async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({ id: 7 }));
    const repo = createPrismaLeaveRepo(makeLeaveMock(vi.fn(), create) as never);
    const res = await repo.createLeave({
      type: '事假',
      reason: '家中有事',
      startAt: '2026-10-01T00:00:00.000Z',
      endAt: '2026-10-02T00:00:00.000Z',
      applicantId: 5,
      departmentId: 2,
    });
    expect(res.id).toBe(7);
    expect(create.mock.calls[0]![0].data).toMatchObject({ applicantId: 5, departmentId: 2 });
  });

  it('getLeaveById 组装 LeaveView（含申请人/部门名）', async () => {
    const findUnique = vi.fn(async () => ({
      id: 7,
      type: '事假',
      reason: 'x',
      startAt: new Date('2026-10-01T00:00:00.000Z'),
      endAt: new Date('2026-10-02T00:00:00.000Z'),
      status: 'pending',
      applicantId: 5,
      departmentId: 2,
      applicant: { realName: '张三' },
      department: { name: '研发部' },
    }));
    const repo = createPrismaLeaveRepo(makeLeaveMock(vi.fn(), vi.fn(), findUnique) as never);
    const view = await repo.getLeaveById(7);
    expect(view).toMatchObject({
      id: 7,
      applicantName: '张三',
      departmentName: '研发部',
      departmentId: 2,
      startAt: '2026-10-01T00:00:00.000Z',
    });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 7 } }));
  });

  it('setStatus 按 id 更新 status', async () => {
    const update = vi.fn(async () => ({}));
    const repo = createPrismaLeaveRepo(makeLeaveMock(vi.fn(), vi.fn(), vi.fn(), update) as never);
    await repo.setStatus(7, 'approved');
    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: 'approved' } });
  });
});