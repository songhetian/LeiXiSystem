// 算薪批次的数据范围（缺陷 P1-3 / P2-6）
// P1-3：listRuns 在「无任何可见范围」的用户下 where 保持 undefined → 返回全公司批次（fail-open）
// P2-6：getRunDetails 未做批次级范围校验 → 传他人 runId 可拿到批次汇总
import { describe, it, expect, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { PayrollService } from '../src/payroll/payroll.service';
import type { DataScope } from '../src/common/data-scope.service';

function makeService(scope: DataScope) {
  let capturedWhere: any;
  const prisma = {
    payslip: {
      findMany: jest.fn(async () => []),
    },
    payrollRun: {
      findMany: jest.fn(async (args: any) => {
        capturedWhere = args?.where;
        return [];
      }),
      count: jest.fn(async () => 0),
      findUnique: jest.fn(async () => ({
        id: 5,
        month: '2026-08',
        status: 'draft',
        totalAmount: '999999.00',
        totalEmployees: 88,
      })),
    },
    payrollDetail: { findMany: jest.fn(async () => []) },
    payrollAdjustment: { findMany: jest.fn(async () => []) },
  };
  const dataScope = { visibleScope: jest.fn(async () => scope) };
  const service = new PayrollService(
    prisma as never,
    dataScope as never,
    {} as never, // PayslipService
    { create: jest.fn(), removeByRelated: jest.fn() } as never, // NOTIFICATION_CLIENT
    {} as never, // DistributedLockService
    { emit: jest.fn() } as never, // EventEmitter2
  );
  return { service, prisma, getWhere: () => capturedWhere };
}

describe('算薪批次 · 数据范围（P1-3 / P2-6）', () => {
  it('listRuns：无任何可见范围 → fail-closed（不得发起任何不过滤的查询）', async () => {
    const { service, prisma } = makeService({ all: false, ids: [] });

    const res = await service.listRuns({ userId: 42, page: 1, pageSize: 10 });

    expect(res.list).toEqual([]);
    expect(res.total).toBe(0);
    // 关键：不能出现「where=undefined 的全表查询」——空范围应直接短路
    expect(prisma.payrollRun.findMany).not.toHaveBeenCalled();
    expect(prisma.payrollRun.count).not.toHaveBeenCalled();
  });

  it('listRuns：部门范围 → 按明细所属部门过滤（不再依赖工资条，草稿批次也可见）', async () => {
    const { service, prisma, getWhere } = makeService({ all: false, ids: [3] });

    await service.listRuns({ userId: 42, page: 1, pageSize: 10 });

    // B8/D5①：口径与 getRunDetails 一致；payslip 在草稿/已确认阶段尚未生成
    expect(getWhere()).toEqual({ details: { some: { employee: { departmentId: { in: [3] } } } } });
    expect(prisma.payslip.findMany).not.toHaveBeenCalled();
  });

  it('listRuns：全量范围 → 不加过滤', async () => {
    const { service, getWhere } = makeService({ all: true, ids: [] });

    await service.listRuns({ userId: 1, page: 1, pageSize: 10 });

    expect(getWhere()).toBeUndefined();
  });

  it('getRunDetails：无任何可见范围 → 拒绝（不得返回批次汇总）', async () => {
    const { service } = makeService({ all: false, ids: [] });

    await expect(service.getRunDetails(5, 42)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getRunDetails：部门范围不含该批次员工 → 拒绝', async () => {
    const { service } = makeService({ all: false, ids: [3] });
    // 二次取详情时返回不在范围内的员工
    (service as unknown as { prisma: any }).prisma.payrollDetail.findMany = jest.fn(async () => [
      { employeeId: 77, employee: { departmentId: 9 } },
    ]);

    await expect(service.getRunDetails(5, 42)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
