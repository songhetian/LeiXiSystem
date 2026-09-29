import { Prisma } from '@prisma/client';
import { PayslipService } from './payslip.service';
import { DataScopeService } from '../common/data-scope.service';

// 工资条金额定点化：totalAmount 必须由明细定点累加得出，并以 Prisma.Decimal 写入
function createMockPrisma() {
  return {
    payrollRun: {
      findUnique: jest.fn(),
    },
    payslip: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
  } as any;
}

describe('PayslipService.generateFromRun — 金额定点化', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = {} as DataScopeService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PayslipService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  it('批次不存在时抛 404（薪资域错误码 3004）', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue(null);

    await expect(service.generateFromRun(99)).rejects.toMatchObject({
      response: { code: 3004 },
    });
    expect(prisma.payslip.createMany).not.toHaveBeenCalled();
  });

  it('按员工分组明细，总额为明细定点累加并以 Prisma.Decimal 写入', async () => {
    // 明细金额刻意选择浮点不友好的数值：0.07 × 100 朴素累加会漂移
    const details = Array.from({ length: 100 }, () => ({
      employeeId: 1,
      itemCode: 'meal',
      itemName: '餐补',
      amount: new Prisma.Decimal('0.07'),
    }));
    details.push({
      employeeId: 1,
      itemCode: 'base',
      itemName: '基本工资',
      amount: new Prisma.Decimal('8333.33'),
    });
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details,
    });

    await service.generateFromRun(5);

    expect(prisma.payslip.createMany).toHaveBeenCalledTimes(1);
    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].employeeId).toBe(1);
    expect(data[0].month).toBe('2026-08');
    expect(data[0].totalAmount).toBeInstanceOf(Prisma.Decimal);
    // 0.07 × 100 + 8333.33 = 8340.33，定点累加必须精确无漂移
    expect(data[0].totalAmount.toNumber()).toBe(8340.33);
    expect(data[0].totalAmount.decimalPlaces()).toBeLessThanOrEqual(2);
    // itemsJson 保留明细原文，供工资条详情展示
    expect(JSON.parse(data[0].itemsJson)).toHaveLength(101);
  });

  it('已存在工资条的员工跳过，不重复生成', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('5000') },
        { employeeId: 2, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('6000') },
      ],
    });
    prisma.payslip.findMany.mockResolvedValue([{ employeeId: 1 }]);

    await service.generateFromRun(5);

    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].employeeId).toBe(2);
    expect(data[0].totalAmount.toNumber()).toBe(6000);
  });

  it('无明细时不写库', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({ id: 5, month: '2026-08', details: [] });

    await service.generateFromRun(5);

    expect(prisma.payslip.createMany).not.toHaveBeenCalled();
  });
});

describe('PayslipService — 工资条不存在（薪资域错误码 3011）', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = {} as DataScopeService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PayslipService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  it('getMyPayslipDetail：员工档案缺失时抛 3011 而非报销域 4004', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);

    await expect(service.getMyPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });

  it('getMyPayslipDetail：工资条不属于本人时抛 3011', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 1 });
    prisma.payslip.findUnique.mockResolvedValue({ id: 9, employeeId: 2 });

    await expect(service.getMyPayslipDetail(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });

  it('markAsViewed：工资条不属于本人时抛 3011', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 1 });
    prisma.payslip.findUnique.mockResolvedValue({ id: 9, employeeId: 2 });

    await expect(service.markAsViewed(1, 9)).rejects.toMatchObject({
      response: { code: 3011 },
    });
  });
});

/**
 * 工资条口径（CONTEXT.md 业务规则）：「工资条」展示 = 计算值 + 调整值。
 *
 * `generateFromRun` 只汇总 PayrollDetail 而漏掉 PayrollAdjustment，会导致
 * 工资条总额少算（调整项为负时员工福利被多计、为正时少发），明细区也缺调整项。
 */
describe('PayslipService.generateFromRun — 工资条 = 计算值 + 调整项', () => {
  let service: PayslipService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = {} as DataScopeService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PayslipService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  it('调整项计入工资条总额与 itemsJson（type=adjustment）', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('5000.00') },
        { employeeId: 1, itemCode: 'social', itemName: '社保代扣', amount: new Prisma.Decimal('-300.00') },
      ],
      adjustments: [
        { id: 11, employeeId: 1, itemCode: 'penalty', amount: new Prisma.Decimal('-100.00'), reason: '迟到扣款', createdBy: 9 },
        { id: 12, employeeId: 1, itemCode: 'allowance', amount: new Prisma.Decimal('200.00'), reason: '项目奖金', createdBy: 9 },
      ],
    });

    await service.generateFromRun(5);

    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    // 5000 - 300 - 100 + 200 = 4800
    expect(data[0].totalAmount.toNumber()).toBe(4800);

    const items = JSON.parse(data[0].itemsJson);
    expect(items).toHaveLength(4);
    const adjustmentItems = items.filter((i: any) => i.type === 'adjustment');
    expect(adjustmentItems).toHaveLength(2);
    expect(adjustmentItems.map((i: any) => i.amount)).toEqual([-100, 200]);
  });

  it('明细项带 type 供工资条前端分组（正数=income，负数=deduction）', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: new Prisma.Decimal('5000.00') },
        { employeeId: 1, itemCode: 'social', itemName: '社保代扣', amount: new Prisma.Decimal('-300.00') },
      ],
      adjustments: [],
    });

    await service.generateFromRun(5);

    const items = JSON.parse(prisma.payslip.createMany.mock.calls[0][0].data[0].itemsJson);
    expect(items).toEqual([
      { code: 'base', name: '基本工资', amount: 5000, type: 'income' },
      { code: 'social', name: '社保代扣', amount: -300, type: 'deduction' },
    ]);
  });

  it('仅有调整项（无明细）的员工也要出工资条', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 5,
      month: '2026-08',
      details: [],
      adjustments: [
        { id: 11, employeeId: 2, itemCode: 'penalty', amount: new Prisma.Decimal('-50.00'), reason: '迟到扣款', createdBy: 9 },
      ],
    });

    await service.generateFromRun(5);

    const data = prisma.payslip.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].employeeId).toBe(2);
    expect(data[0].totalAmount.toNumber()).toBe(-50);
  });

  it('getMyPayslipDetail：把 type=adjustment 的项拆到 adjustments 字段供前端单独展示', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 1 });
    prisma.payslip.findUnique.mockResolvedValue({
      id: 9,
      employeeId: 1,
      month: '2026-08',
      totalAmount: new Prisma.Decimal('4800.00'),
      itemsJson: JSON.stringify([
        { code: 'base', name: '基本工资', amount: 5000, type: 'income' },
        { code: 'penalty', name: '迟到扣款', amount: -100, type: 'adjustment' },
      ]),
    });

    const detail = (await service.getMyPayslipDetail(1, 9)) as any;

    expect(detail.items).toHaveLength(2);
    expect(detail.adjustments).toEqual([
      { code: 'penalty', name: '迟到扣款', amount: -100, type: 'adjustment' },
    ]);
  });
});