import { NotFoundException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { DataScopeService, DataScope } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';

// ADR-0010：财务域数据隔离（预算按部门隔离，费用标准为公司级全局配置）
function createMockPrisma() {
  return {
    budget: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    expenseStandard: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
}

describe('FinanceService 数据隔离', () => {
  let service: FinanceService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let scope: DataScope;

  beforeEach(() => {
    prisma = createMockPrisma();
    scope = { all: true, ids: [] };
    const dataScope = {
      visibleScope: jest.fn().mockImplementation(async () => scope),
    } as unknown as DataScopeService;
    service = new FinanceService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  describe('listBudgets', () => {
    it('admin/hr（all）不加部门过滤，其余查询条件照常生效', async () => {
      scope = { all: true, ids: [] };

      await service.listBudgets({ year: 2026, category: '招聘' }, 1);

      const whereArg = prisma.budget.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({ year: 2026, category: '招聘' });
      expect(whereArg.departmentId).toBeUndefined();
      expect(whereArg.OR).toBeUndefined();
    });

    it('部门管理者只可见本部门及子部门的预算（公司级 departmentId=null 不可见）', async () => {
      scope = { all: false, ids: [3, 4, 5] };

      await service.listBudgets({ year: 2026 }, 1);

      const whereArg = prisma.budget.findMany.mock.calls[0][0].where;
      expect(whereArg.year).toBe(2026);
      expect(whereArg.AND).toEqual([{ departmentId: { in: [3, 4, 5] } }]);
    });

    it('无部门范围且未绑定员工（仅本人档）时返回空集，且不查询数据库', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 9 };

      const result = await service.listBudgets({}, 1);

      expect(result).toEqual({ list: [], total: 0 });
      expect(prisma.budget.findMany).not.toHaveBeenCalled();
    });

    it('入参按部门过滤时仍受可见范围约束（越权部门查不到数据）', async () => {
      scope = { all: false, ids: [3, 4] };

      await service.listBudgets({ departmentId: 99 }, 1);

      const whereArg = prisma.budget.findMany.mock.calls[0][0].where;
      expect(whereArg.departmentId).toBe(99);
      expect(whereArg.AND).toEqual([{ departmentId: { in: [3, 4] } }]);
    });
  });

  describe('listExpenseStandards', () => {
    it('费用标准为公司级全局配置，不按部门隔离（无部门维度）', async () => {
      scope = { all: false, ids: [], selfEmployeeId: 9 };

      await service.listExpenseStandards({ category: '差旅' });

      const whereArg = prisma.expenseStandard.findMany.mock.calls[0][0].where;
      expect(whereArg).toEqual({ category: '差旅' });
    });
  });
});

describe('FinanceService 错误码（财务域 41xx）', () => {
  let service: FinanceService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const dataScope = { visibleScope: jest.fn() } as unknown as DataScopeService;
    service = new FinanceService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  it.each([
    ['updateBudget', () => service.updateBudget(1, { amount: 100 })],
    ['removeBudget', () => service.removeBudget(1)],
  ])('%s 预算不存在时抛财务域错误码 4101', async (_name, run) => {
    prisma.budget.findUnique.mockResolvedValue(null);

    await expect(run()).rejects.toMatchObject({
      response: { code: ERROR_CODES.FINANCE_BUDGET_NOT_FOUND },
    });
    await expect(run()).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    ['updateExpenseStandard', () => service.updateExpenseStandard(1, { amount: 100 })],
    ['toggleExpenseStandard', () => service.toggleExpenseStandard(1)],
    ['removeExpenseStandard', () => service.removeExpenseStandard(1)],
  ])('%s 费用标准不存在时抛财务域错误码 4102', async (_name, run) => {
    prisma.expenseStandard.findUnique.mockResolvedValue(null);

    await expect(run()).rejects.toMatchObject({
      response: { code: ERROR_CODES.FINANCE_EXPENSE_STANDARD_NOT_FOUND },
    });
  });
});