import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { EVENT_PAYROLL_STATUS_CHANGED } from '../common/events';

function createMockPrisma() {
  const mockTx: any = {
    payrollRun: {
      create: jest.fn(),
      update: jest.fn(),
    },
    payrollDetail: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
  };

  return {
    payrollRun: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    attendanceMonthly: {
      findMany: jest.fn(),
    },
    payrollDetail: {
      create: jest.fn(),
    },
    salaryAdjustment: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockTx)),
    _mockTx: mockTx,
  };
}

function createMockDataScope() {
  return { visibleScope: jest.fn().mockResolvedValue({ all: true }) };
}

function createMockPayslipService() {
  return { generatePayslips: jest.fn() };
}

function createMockNotificationService() {
  return {
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    removeByRelated: jest.fn().mockResolvedValue({ count: 0 }),
  };
}

function createMockLockService() {
  return {
    withLock: jest.fn((_key: string, _ttl: number, fn: () => Promise<any>) => fn()),
  };
}

function createMockEventEmitter() {
  return { emit: jest.fn() };
}

describe('PayrollService', () => {
  let _eventEmitter: ReturnType<typeof createMockEventEmitter>;
  let _notificationService: ReturnType<typeof createMockNotificationService>;
  describe('createRun — 唯一约束竞态处理', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const payslipService = createMockPayslipService() as any;
      const notificationService = createMockNotificationService() as any;
      const lockService = createMockLockService() as any;
      const eventEmitter = createMockEventEmitter();
      _eventEmitter = eventEmitter;
      service = new PayrollService(
        prisma as any,
        dataScope as any,
        payslipService,
        notificationService,
        lockService,
        eventEmitter as any,
      );
    });

    it('Prisma 唯一约束错误（P2002）应转换为 ConflictException', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);

      prisma.attendanceMonthly.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDays: 22,
          absentDays: 0,
          lateCount: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          employee: { id: 1, name: '张三', salary: 5000 },
        },
      ]);

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`month`)',
        { code: 'P2002', clientVersion: '1.0.0', meta: { target: ['month'] } },
      );
      prisma._mockTx.payrollRun.create.mockRejectedValue(p2002Error);

      await expect(service.createRun('2025-01', 1)).rejects.toThrow(ConflictException);
      await expect(service.createRun('2025-01', 1)).rejects.toMatchObject({
        response: { code: 3001, message: '该月份算薪批次已存在' },
      });
    });

    it('非 P2002 的 Prisma 错误应原样抛出', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);

      prisma.attendanceMonthly.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDays: 22,
          absentDays: 0,
          lateCount: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          employee: { id: 1, name: '张三', salary: 5000 },
        },
      ]);

      const otherError = new Prisma.PrismaClientKnownRequestError(
        'Some other error',
        { code: 'P2003', clientVersion: '1.0.0', meta: {} },
      );
      prisma._mockTx.payrollRun.create.mockRejectedValue(otherError);

      await expect(service.createRun('2025-01', 1)).rejects.toThrow(
        Prisma.PrismaClientKnownRequestError,
      );
    });
  });

  describe('createRun — 事务原子性', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const payslipService = createMockPayslipService() as any;
      const notificationService = createMockNotificationService() as any;
      const lockService = createMockLockService() as any;
      const eventEmitter = createMockEventEmitter();
      _eventEmitter = eventEmitter;
      service = new PayrollService(
        prisma as any,
        dataScope as any,
        payslipService,
        notificationService,
        lockService,
        eventEmitter as any,
      );
    });

    it('使用 $transaction 保证原子性：payrollRun 和 payrollDetail 在同一事务中', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);

      prisma.attendanceMonthly.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDays: 22,
          absentDays: 0,
          lateCount: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          employee: { id: 1, name: '张三', salary: 5000 },
        },
        {
          employeeId: 2,
          workDays: 22,
          absentDays: 0,
          lateCount: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          employee: { id: 2, name: '李四', salary: 6000 },
        },
      ]);

      prisma._mockTx.payrollRun.create.mockResolvedValue({ id: 1, month: '2025-01', status: 'draft' });
      prisma._mockTx.payrollDetail.createMany.mockResolvedValue({ count: 10 });
      prisma._mockTx.payrollRun.update.mockResolvedValue({ id: 1, totalEmployees: 2 });

      await service.createRun('2025-01', 1);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma._mockTx.payrollRun.create).toHaveBeenCalled();
      expect(prisma._mockTx.payrollDetail.createMany).toHaveBeenCalled();
      expect(prisma._mockTx.payrollRun.update).toHaveBeenCalled();
    });

    it('明细创建失败时，事务回滚，不残留半完成状态', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);

      prisma.attendanceMonthly.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDays: 22,
          absentDays: 0,
          lateCount: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          employee: { id: 1, name: '张三', salary: 5000 },
        },
      ]);

      prisma._mockTx.payrollRun.create.mockResolvedValue({ id: 1, month: '2025-01', status: 'draft' });
      prisma._mockTx.payrollDetail.createMany.mockRejectedValue(new Error('DB error'));

      prisma.$transaction.mockImplementation((fn: any) => fn(prisma._mockTx));

      await expect(service.createRun('2025-01', 1)).rejects.toThrow('DB error');
      expect(prisma.payrollRun.update).not.toHaveBeenCalled();
    });
  });

  describe('getEffectiveSalary — 薪资生效月取数', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const payslipService = createMockPayslipService() as any;
      const notificationService = createMockNotificationService() as any;
      const lockService = createMockLockService() as any;
      const eventEmitter = createMockEventEmitter();
      _eventEmitter = eventEmitter;
      service = new PayrollService(
        prisma as any,
        dataScope as any,
        payslipService,
        notificationService,
        lockService,
        eventEmitter as any,
      );
    });

    it('无任何调整记录时回退员工当前薪资（初始工资）', async () => {
      prisma.salaryAdjustment.findFirst.mockResolvedValue(null);
      const salary = await service.getEffectiveSalary(1, '2025-09', 5000);
      expect(salary).toBe(5000);
      expect(prisma.salaryAdjustment.findFirst).toHaveBeenCalledWith({
        where: { employeeId: 1, effectiveMonth: { lte: '2025-09' } },
        orderBy: [{ effectiveMonth: 'desc' }, { createdAt: 'desc' }],
      });
    });

    it('生效月 ≤ 计薪月的最新一条调整记录作为该月基础工资', async () => {
      // 8月改薪，默认 9月 生效；计薪月 9月（10月发放）时应取这条
      prisma.salaryAdjustment.findFirst.mockResolvedValue({
        id: 2,
        employeeId: 1,
        amount: 10000,
        effectiveMonth: '2025-09',
      });
      const salary = await service.getEffectiveSalary(1, '2025-09', 5000);
      expect(salary).toBe(10000);
    });

    it('生效月晚于计薪月的调整不生效（次月生效边界）', async () => {
      // 8月改薪默认 9月生效，计薪月 8月（9月发放）仍用旧薪资
      prisma.salaryAdjustment.findFirst.mockResolvedValue(null);
      const salary = await service.getEffectiveSalary(1, '2025-08', 5000);
      expect(salary).toBe(5000);
    });

    it('读取异常时回退员工当前薪资，不抛错', async () => {
      prisma.salaryAdjustment.findFirst.mockRejectedValue(new Error('db down'));
      const salary = await service.getEffectiveSalary(1, '2025-09', 5000);
      expect(salary).toBe(5000);
    });
  });

  describe('createRun — 使用计薪月生效薪资', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const payslipService = createMockPayslipService() as any;
      const notificationService = createMockNotificationService() as any;
      const lockService = createMockLockService() as any;
      const eventEmitter = createMockEventEmitter();
      _eventEmitter = eventEmitter;
      service = new PayrollService(
        prisma as any,
        dataScope as any,
        payslipService,
        notificationService,
        lockService,
        eventEmitter as any,
      );
    });

    it('计薪月命中生效薪资时，基础工资按调整记录计算', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.attendanceMonthly.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDays: 22,
          absentDays: 0,
          lateCount: 0,
          leaveMinutes: 0,
          overtimeHours: 0,
          employee: { id: 1, name: '张三', salary: 5000 },
        },
      ]);
      // 8月改薪 → 9月生效，10月发放 9月工资时取 10000
      prisma.salaryAdjustment.findFirst.mockResolvedValue({
        id: 2,
        employeeId: 1,
        amount: 10000,
        effectiveMonth: '2025-09',
      });
      prisma._mockTx.payrollRun.create.mockResolvedValue({
        id: 1,
        month: '2025-09',
        status: 'draft',
      });
      prisma._mockTx.payrollDetail.createMany.mockResolvedValue({ count: 1 });
      prisma._mockTx.payrollRun.update.mockImplementation(async (args: any) => args.data);

      await service.createRun('2025-09', 1);

      expect(prisma.salaryAdjustment.findFirst).toHaveBeenCalledWith({
        where: { employeeId: 1, effectiveMonth: { lte: '2025-09' } },
        orderBy: [{ effectiveMonth: 'desc' }, { createdAt: 'desc' }],
      });
      // 基础工资为 10000（而非初始 5000），说明命中生效薪资
      expect(prisma._mockTx.payrollDetail.createMany).toHaveBeenCalled();
      const created = prisma._mockTx.payrollDetail.createMany.mock.calls[0][0].data;
      const base = created.find((d: any) => d.itemCode === 'base');
      expect(base).toBeDefined();
      // 写库边界为定点 Decimal（@db.Decimal(12,2)），非浮点 number
      expect(base.amount.toNumber()).toBe(10000);
      expect(base.amount.toFixed(2)).toBe('10000.00');
    });
  });

  describe('createRun — 金额定点化（写库边界 + 对账断言）', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const payslipService = createMockPayslipService() as any;
      const notificationService = createMockNotificationService() as any;
      const lockService = createMockLockService() as any;
      const eventEmitter = createMockEventEmitter();
      _eventEmitter = eventEmitter;
      service = new PayrollService(
        prisma as any,
        dataScope as any,
        payslipService,
        notificationService,
        lockService,
        eventEmitter as any,
      );
    });

    // 构造月报数据：指定员工数与薪资，其余字段取全勤
    function monthly(employeeId: number, salary: number) {
      return {
        employeeId,
        workDays: 22,
        absentDays: 0,
        lateCount: 0,
        earlyCount: 0,
        leaveMinutes: 0,
        overtimeHours: 0,
        employee: { id: employeeId, name: `员工${employeeId}`, salary },
      };
    }

    it('明细与批次总额均以 Prisma.Decimal 定点写入', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.attendanceMonthly.findMany.mockResolvedValue([monthly(1, 8333.33)]);
      prisma.salaryAdjustment.findFirst.mockResolvedValue(null);
      prisma._mockTx.payrollRun.create.mockResolvedValue({ id: 1, month: '2025-09', status: 'draft' });
      prisma._mockTx.payrollDetail.createMany.mockResolvedValue({ count: 8 });
      prisma._mockTx.payrollRun.update.mockImplementation(async (args: any) => args.data);

      await service.createRun('2025-09', 1);

      const details = prisma._mockTx.payrollDetail.createMany.mock.calls[0][0].data;
      for (const d of details) {
        expect(d.amount).toBeInstanceOf(Prisma.Decimal);
        // 定点写入：写入值的小数位不超过 2 位，杜绝 0.1+0.2 型漂移入库
        expect(d.amount.decimalPlaces()).toBeLessThanOrEqual(2);
      }
      const runData = prisma._mockTx.payrollRun.update.mock.calls[0][0].data;
      expect(runData.totalAmount).toBeInstanceOf(Prisma.Decimal);
      // 批次总额 == 所有明细定点累加
      const detailCents = details.reduce(
        (acc: number, d: any) => acc + Math.round(d.amount.toNumber() * 100),
        0,
      );
      expect(runData.totalAmount.toNumber()).toBe(detailCents / 100);
      expect(runData.totalEmployees).toBe(1);
    });

    it('多员工时批次总额恒等于明细定点累加，不发生浮点漂移', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      // 8333.33/21.75/8 会产生无尽小数，正是浮点漂移的典型来源
      prisma.attendanceMonthly.findMany.mockResolvedValue([
        monthly(1, 8333.33),
        monthly(2, 6666.67),
        monthly(3, 9999.99),
      ]);
      prisma.salaryAdjustment.findFirst.mockResolvedValue(null);
      prisma._mockTx.payrollRun.create.mockResolvedValue({ id: 7, month: '2025-09', status: 'draft' });
      prisma._mockTx.payrollDetail.createMany.mockResolvedValue({ count: 24 });
      prisma._mockTx.payrollRun.update.mockImplementation(async (args: any) => args.data);

      await service.createRun('2025-09', 1);

      const details = prisma._mockTx.payrollDetail.createMany.mock.calls[0][0].data;
      const detailCents = details.reduce(
        (acc: number, d: any) => acc + Math.round(d.amount.toNumber() * 100),
        0,
      );
      const runData = prisma._mockTx.payrollRun.update.mock.calls[0][0].data;
      expect(runData.totalAmount.toNumber()).toBe(detailCents / 100);
      expect(runData.totalEmployees).toBe(3);
    });
  });

  describe('状态变更 — 发送 payroll.status.changed 事件（触发报表缓存失效）', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const payslipService = createMockPayslipService() as any;
      const notificationService = createMockNotificationService() as any;
      _notificationService = notificationService;
      const lockService = createMockLockService() as any;
      const eventEmitter = createMockEventEmitter();
      _eventEmitter = eventEmitter;
      service = new PayrollService(
        prisma as any,
        dataScope as any,
        payslipService,
        notificationService,
        lockService,
        eventEmitter as any,
      );
    });

    it('确认算薪批次后发送 payroll.status.changed（draft -> confirmed）', async () => {
      (prisma as any).payrollDetail.groupBy = jest.fn().mockResolvedValue([
        { employeeId: 1 },
        { employeeId: 2 },
        { employeeId: 3 },
      ]);
      (prisma as any).payrollRun.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 5,
        month: '2026-08',
        status: 'confirmed',
      });

      await service.confirmRun(5, 1, [1, 2, 3]);

      expect(_eventEmitter.emit).toHaveBeenCalledWith(
        EVENT_PAYROLL_STATUS_CHANGED,
        expect.objectContaining({
          runId: 5,
          month: '2026-08',
          from: 'draft',
          to: 'confirmed',
          status: 'confirmed',
        }),
      );
    });

    it('撤回已发布的算薪批次后发送 payroll.status.changed（published -> recalled）', async () => {
      prisma.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'published',
      });
      (prisma as any).payslip = {
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({}),
      };
      prisma._mockTx.payrollRun.update = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'recalled',
      });
      prisma._mockTx.payslip = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };

      await service.recallRun(9, 1);

      expect(_eventEmitter.emit).toHaveBeenCalledWith(
        EVENT_PAYROLL_STATUS_CHANGED,
        expect.objectContaining({
          runId: 9,
          month: '2026-08',
          from: 'published',
          to: 'recalled',
        }),
      );
    });

    it('撤回已发布批次时同步清理「工资条已发布」通知（relatedType=payroll_run）', async () => {
      prisma.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'published',
      });
      (prisma as any).payslip = {
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({}),
      };
      prisma._mockTx.payrollRun.update = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'recalled',
      });
      prisma._mockTx.payslip = { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) };

      await service.recallRun(9, 1);

      // 工资条已删除，遗留通知会指向不存在的单据，必须一并清理
      expect(_notificationService.removeByRelated).toHaveBeenCalledWith('payroll_run', 9);
    });

    it('撤回时存在已查看工资条，抛「不可撤回」专属码 3012，而非 3005（员工无工资配置）', async () => {
      prisma.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'published',
      });
      (prisma as any).payslip = {
        count: jest.fn().mockResolvedValue(2),
        deleteMany: jest.fn().mockResolvedValue({}),
      };

      await expect(service.recallRun(9, 1)).rejects.toMatchObject({
        response: { code: 3012, message: '存在已查看的工资条，不可撤回' },
      });
    });

    it('非草稿批次确认时抛「批次状态不允许此操作」3010，而非语义不符的 3003', async () => {
      (prisma as any).payrollDetail.groupBy = jest.fn().mockResolvedValue([
        { employeeId: 1 },
        { employeeId: 2 },
        { employeeId: 3 },
      ]);
      (prisma as any).payrollRun.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prisma.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 5,
        month: '2026-08',
        status: 'confirmed',
      });

      await expect(service.confirmRun(5, 1, [1, 2, 3])).rejects.toMatchObject({
        response: { code: 3010, message: '仅草稿状态可确认' },
      });
    });

    it('撤回时状态变更与工资条删除必须同一事务，避免删条失败后残留可查工资条', async () => {
      prisma.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'published',
      });
      // 事务外只允许读（count），不允许写
      (prisma as any).payslip = { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() };
      prisma._mockTx.payrollRun.update = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'recalled',
      });
      prisma._mockTx.payslip = { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) };

      await service.recallRun(9, 1);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma._mockTx.payrollRun.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: expect.objectContaining({ status: 'recalled', recalledBy: 1 }),
      });
      expect(prisma._mockTx.payslip.deleteMany).toHaveBeenCalledWith({ where: { runId: 9 } });
      // 事务外不能再删一次：否则事务回滚时工资条删除不可回滚，
      // 会留下「批次仍是已发布、工资条却已被删」的反向错账
      expect((prisma as any).payslip.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('getRunDetails — 批次明细 + 数据范围隔离', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    function setup(dataScope: { all: boolean; selfEmployeeId?: number; ids?: number[] }) {
      prisma = createMockPrisma();
      (prisma.payrollDetail as any).findMany = jest.fn();
      (prisma as any).payrollAdjustment = { findMany: jest.fn() };
      const payslipService = createMockPayslipService() as any;
      const notificationService = createMockNotificationService() as any;
      const lockService = createMockLockService() as any;
      const eventEmitter = createMockEventEmitter();
      service = new PayrollService(
        prisma as any,
        { visibleScope: jest.fn().mockResolvedValue(dataScope) } as any,
        payslipService,
        notificationService,
        lockService,
        eventEmitter as any,
      );
      return prisma;
    }

    it('批次不存在时抛 404（code 3004）', async () => {
      setup({ all: true });
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      await expect(service.getRunDetails(99, 1)).rejects.toMatchObject({
        response: { code: 3004 },
      });
    });

    it('全量数据范围时聚合明细与调整项，合计四舍五入', async () => {
      const p = setup({ all: true });
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 1, month: '2026-08', status: 'draft' });
      (prisma.payrollDetail as any).findMany.mockResolvedValue([
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: 5000, employee: { id: 1, employeeNo: 'E001', name: '张三', departmentId: 1 } },
        { employeeId: 1, itemCode: 'meal', itemName: '餐补', amount: 300, employee: { id: 1, employeeNo: 'E001', name: '张三', departmentId: 1 } },
      ]);
      (prisma as any).payrollAdjustment.findMany.mockResolvedValue([
        { id: 1, employeeId: 1, itemCode: 'penalty', amount: -100, reason: '迟到扣款', createdAt: '2026-08-01T00:00:00+08:00', employee: { id: 1, employeeNo: 'E001', name: '张三', departmentId: 1 } },
      ]);

      const result = await service.getRunDetails(1, 1);

      expect(result.employees).toHaveLength(1);
      expect(result.employees[0].items).toEqual([
        { code: 'base', name: '基本工资', amount: 5000 },
        { code: 'meal', name: '餐补', amount: 300 },
      ]);
      expect(result.employees[0].adjustments).toHaveLength(1);
      expect(result.employees[0].adjustments[0]).toMatchObject({ amount: -100, reason: '迟到扣款' });
      // 5000 + 300 - 100 = 5200
      expect(result.employees[0].total).toBe(5200);
    });

    it('部门数据范围时过滤不在范围内的员工明细与调整项', async () => {
      const p = setup({ all: false, ids: [1] });
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 1, month: '2026-08', status: 'draft' });
      (prisma.payrollDetail as any).findMany.mockResolvedValue([
        { employeeId: 1, itemCode: 'base', itemName: '基本工资', amount: 5000, employee: { id: 1, employeeNo: 'E001', name: '张三', departmentId: 1 } },
        { employeeId: 2, itemCode: 'base', itemName: '基本工资', amount: 6000, employee: { id: 2, employeeNo: 'E002', name: '李四', departmentId: 2 } },
      ]);
      (prisma as any).payrollAdjustment.findMany.mockResolvedValue([
        { id: 1, employeeId: 2, itemCode: 'penalty', amount: -50, reason: '迟到扣款', createdAt: '2026-08-01T00:00:00+08:00', employee: { id: 2, employeeNo: 'E002', name: '李四', departmentId: 2 } },
      ]);

      const result = await service.getRunDetails(1, 1);

      expect(result.employees).toHaveLength(1);
      expect(result.employees[0].employee.employeeNo).toBe('E001');
      expect(result.employees[0].items).toEqual([{ code: 'base', name: '基本工资', amount: 5000 }]);
      expect(result.employees[0].adjustments).toHaveLength(0);
      expect(result.employees[0].total).toBe(5000);
    });
  });

  // ------------------------------------------------------------------
  // addAdjustment — 零范围用户越权（{all:false, ids:[], selfEmployeeId:undefined}）
  // 缺 fail-closed 守卫时会静默放行任意 employeeId，可为他人工资批次加钱。
  // ------------------------------------------------------------------
  describe('addAdjustment — 零范围用户不得越权添加调整项', () => {
    it('零范围用户为任意员工加调整项：应抛 FORBIDDEN', async () => {
      const prisma: any = createMockPrisma();
      prisma.payrollAdjustment = { create: jest.fn() };
      prisma.employee = { findUnique: jest.fn() };
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 1, status: 'draft' });
      prisma.employee.findUnique.mockResolvedValue({ id: 10, departmentId: 5 });
      const service = new PayrollService(
        prisma as any,
        { visibleScope: jest.fn().mockResolvedValue({ all: false, ids: [], selfEmployeeId: undefined }) } as any,
        createMockPayslipService() as any,
        createMockNotificationService() as any,
        createMockLockService() as any,
        createMockEventEmitter() as any,
      );

      await expect(
        service.addAdjustment(1, { employeeId: 10, itemCode: 'bonus', amount: 100, reason: '测试' }, 1),
      ).rejects.toMatchObject({
        response: { code: 5003, message: '无权为其他员工添加调整项' },
      });
      expect(prisma.payrollAdjustment.create).not.toHaveBeenCalled();
    });
  });
});
