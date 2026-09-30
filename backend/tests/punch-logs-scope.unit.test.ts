// 打卡流水列表的数据范围过滤（缺陷 P0-1）
// 背景：list() 曾用 `where.employee = { id / departmentId }` 过滤 PunchLog，
// 但 PunchLog 模型没有 employee 关系（只有 employeeNo 字符串）→ Prisma 运行时抛
// `Unknown argument 'employee'`，任何非 admin 打开打卡流水页必然 500。
// 之所以 tsc 没拦住，是 where 被声明成了 `any`。本用例锁定「按工号过滤」的行为。
import { describe, it, expect, jest } from '@jest/globals';
import { PunchLogsService } from '../src/attendance/punch-logs.service';
import type { DataScope } from '../src/common/data-scope.service';

interface Captured {
  findManyWhere?: any;
  countWhere?: any;
  employeeWhere?: any;
}

function makeService(scope: DataScope, visibleEmployees: { id: number; employeeNo: string }[]) {
  const captured: Captured = {};
  const prisma = {
    employee: {
      findMany: jest.fn(async (args: any) => {
        captured.employeeWhere = args?.where;
        return visibleEmployees;
      }),
    },
    punchLog: {
      findMany: jest.fn(async (args: any) => {
        captured.findManyWhere = args?.where;
        return [];
      }),
      count: jest.fn(async (args: any) => {
        captured.countWhere = args?.where;
        return 0;
      }),
    },
  };
  const dataScope = { visibleScope: jest.fn(async () => scope) };
  const service = new PunchLogsService(prisma as never, dataScope as never);
  return { service, captured };
}

const page = { page: 1, pageSize: 20 };

describe('打卡流水列表 · 数据范围（P0-1）', () => {
  it('员工本人范围：按本人工号过滤，且不使用 PunchLog 上不存在的 employee 键', async () => {
    const { service, captured } = makeService({ all: false, ids: [], selfEmployeeId: 7 }, [
      { id: 7, employeeNo: 'E007' },
    ]);

    await service.list(7, { ...page });

    expect(captured.employeeWhere).toEqual({ id: 7 });
    expect(captured.findManyWhere.employee).toBeUndefined();
    expect(captured.findManyWhere.employeeNo).toEqual({ in: ['E007'] });
    expect(captured.countWhere.employeeNo).toEqual({ in: ['E007'] });
  });

  it('主管范围：按可见部门内员工的工号过滤（非法键不得出现）', async () => {
    const { service, captured } = makeService({ all: false, ids: [3, 4] }, [
      { id: 11, employeeNo: 'E011' },
      { id: 12, employeeNo: 'E012' },
    ]);

    await service.list(9, { ...page });

    expect(captured.employeeWhere).toEqual({ departmentId: { in: [3, 4] } });
    expect(captured.findManyWhere.employee).toBeUndefined();
    expect(captured.findManyWhere.employeeNo).toEqual({ in: ['E011', 'E012'] });
  });

  it('显式查询他人工号但不在可见范围 → 取交集为空，返回空结果（fail-closed）', async () => {
    const { service } = makeService({ all: false, ids: [], selfEmployeeId: 7 }, [
      { id: 7, employeeNo: 'E007' },
    ]);

    const res = await service.list(7, { ...page, employeeNo: 'E999' });

    expect(res.list).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('全量范围：不按工号过滤；显式工号仍生效', async () => {
    const { service, captured } = makeService({ all: true, ids: [] }, []);

    await service.list(1, { ...page });

    expect(captured.findManyWhere.employeeNo).toBeUndefined();
  });
});
