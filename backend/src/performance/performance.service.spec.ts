import { BadRequestException } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { DataScopeService, DataScope } from '../common/data-scope.service';

// ADR-0010：绩效域数据隔离
//   周期（performance_cycles）无部门维度 → 全局可见；
//   目标/评估按员工具备部门归属 → 按可见部门隔离。
function createMockPrisma() {
  return {
    // 部门范围需先经 employee 表收敛为员工 id 集合
    employee: {
      findMany: jest.fn().mockResolvedValue([{ id: 301 }, { id: 302 }]),
    },
    performanceCycle: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    performanceGoal: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    performanceReview: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

describe('PerformanceService 数据隔离', () => {
  let service: PerformanceService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let scope: DataScope;

  beforeEach(() => {
    prisma = createMockPrisma();
    scope = { all: true, ids: [] };
    const dataScope = {
      visibleScope: jest.fn().mockImplementation(async () => scope),
    } as unknown as DataScopeService;
    service = new PerformanceService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  describe('listCycles', () => {
    it('绩效周期为公司级时间周期，无部门维度，不参与数据隔离', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 9 };

      await service.listCycles();

      const whereArg = prisma.performanceCycle.findMany.mock.calls[0][0].where;
      expect(whereArg).toBeUndefined();
    });
  });

  describe('listGoals', () => {
    it('admin/hr（all）不加员工部门限制，cycleId 过滤照常生效', async () => {
      scope = { all: true, ids: [] };

      await service.listGoals(1, 5);

      const whereArg = prisma.performanceGoal.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({ cycleId: 5 });
    });

    it('部门管理者只可见本部门及子部门员工的目标', async () => {
      scope = { all: false, ids: [3, 4] };

      await service.listGoals(1, 5);

      const whereArg = prisma.performanceGoal.findMany.mock.calls[0][0].where;
      expect(whereArg.cycleId).toBe(5);
      // performance_goals 无 employee 关系字段，必须用 employeeId 集合表达部门范围
      expect(whereArg.employee).toBeUndefined();
      expect(whereArg.employeeId).toEqual({ in: [301, 302] });
      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { departmentId: { in: [3, 4] } },
        select: { id: true },
      });
    });

    it('部门管理者显式指定范围内员工时，仅返回该员工目标', async () => {
      scope = { all: false, ids: [3] };

      await service.listGoals(1, 5, 302);

      const whereArg = prisma.performanceGoal.findMany.mock.calls[0][0].where;
      expect(whereArg.employeeId).toEqual({ in: [302] });
    });

    it('部门管理者显式指定范围外员工时返回空集（不泄露他部门数据）', async () => {
      scope = { all: false, ids: [3] };

      await service.listGoals(1, 5, 99);

      const whereArg = prisma.performanceGoal.findMany.mock.calls[0][0].where;
      expect(whereArg.employeeId).toEqual({ in: [] });
    });

    it('仅本人档强制只查本人目标', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 77 };

      await service.listGoals(1);

      const whereArg = prisma.performanceGoal.findMany.mock.calls[0][0].where;
      expect(whereArg.employeeId).toBe(77);
      expect(whereArg.employee).toBeUndefined();
    });

    it('仅本人档显式查询他人目标时返回空集，且不查询数据库', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 77 };

      const result = await service.listGoals(1, 5, 99);

      expect(result).toEqual({ list: [], total: 0 });
      expect(prisma.performanceGoal.findMany).not.toHaveBeenCalled();
    });

    it('既无部门范围又未绑定员工时返回空集，且不查询数据库', async () => {
      scope = { all: false, ids: [] };

      const result = await service.listGoals(1);

      expect(result).toEqual({ list: [], total: 0 });
      expect(prisma.performanceGoal.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listReviews', () => {
    it('部门管理者只可见本部门及子部门员工的评估', async () => {
      scope = { all: false, ids: [7] };

      await service.listReviews(1, 2);

      const whereArg = prisma.performanceReview.findMany.mock.calls[0][0].where;
      expect(whereArg.cycleId).toBe(2);
      expect(whereArg.employee).toBeUndefined();
      expect(whereArg.employeeId).toEqual({ in: [301, 302] });
    });

    it('仅本人档强制只查本人评估', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 77 };

      await service.listReviews(1);

      const whereArg = prisma.performanceReview.findMany.mock.calls[0][0].where;
      expect(whereArg.employeeId).toBe(77);
    });

    it('仅本人档显式查询他人评估时返回空集', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 77 };

      const result = await service.listReviews(1, 2, 99);

      expect(result).toEqual({ list: [], total: 0 });
      expect(prisma.performanceReview.findMany).not.toHaveBeenCalled();
    });
  });

  /**
   * updateCycle 的部分更新：只传一半日期时，另一半来自数据库（@db.Date → Date 对象）。
   * 原实现直接做 `endDate < startDate`，Date 与 'YYYY-MM-DD' 字符串比较恒为 false，
   * 导致「结束日期早于开始日期」的非法周期被写入数据库。
   */
  describe('updateCycle 周期日期先后校验', () => {
    const existing = {
      id: 1,
      name: '2026 Q2',
      type: 'quarterly',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T00:00:00.000Z'),
      status: 'draft',
    };

    beforeEach(() => {
      prisma.performanceCycle.findUnique.mockResolvedValue(existing);
      prisma.performanceCycle.update.mockResolvedValue(existing);
    });

    it('仅修改结束日期且早于库中开始日期时应拒绝', async () => {
      await expect(service.updateCycle(1, { endDate: '2026-04-01' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.performanceCycle.update).not.toHaveBeenCalled();
    });

    it('仅修改开始日期且晚于库中结束日期时应拒绝', async () => {
      await expect(service.updateCycle(1, { startDate: '2026-06-01' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.performanceCycle.update).not.toHaveBeenCalled();
    });

    it('区间合法时正常更新', async () => {
      await expect(
        service.updateCycle(1, { startDate: '2026-05-01', endDate: '2026-06-30' }),
      ).resolves.toBeDefined();
    });
  });
});