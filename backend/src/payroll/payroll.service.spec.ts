import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { EVENT_PAYROLL_STATUS_CHANGED } from '../common/events';

function createMockPrisma() {
  const mockTx: any = {
    payrollRun: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    payrollDetail: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
    payslip: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  return {
    payrollRun: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    // C5：缺月报校验读取在职员工；默认空集合不触发阻断
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    attendanceMonthly: {
      findMany: jest.fn(),
    },
    payrollDetail: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn(),
    },
    salaryAdjustment: {
      // getEffectiveSalary 走单条查询；createRun 走批量查询
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    salaryItem: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    payslip: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
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

    it('读取异常时抛错，不得静默回退员工当前薪资（否则 DB 故障按错误基数计薪）', async () => {
      prisma.salaryAdjustment.findFirst.mockRejectedValue(new Error('db down'));
      await expect(service.getEffectiveSalary(1, '2025-09', 5000)).rejects.toThrow('db down');
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
      // 8月改薪 → 9月生效，10月发放 9月工资时取 10000（事务前批量取数）
      prisma.salaryAdjustment.findMany.mockResolvedValue([
        { id: 2, employeeId: 1, amount: 10000, effectiveMonth: '2025-09' },
      ]);
      prisma._mockTx.payrollRun.create.mockResolvedValue({
        id: 1,
        month: '2025-09',
        status: 'draft',
      });
      prisma._mockTx.payrollDetail.createMany.mockResolvedValue({ count: 1 });
      prisma._mockTx.payrollRun.update.mockImplementation(async (args: any) => args.data);

      await service.createRun('2025-09', 1);

      expect(prisma.salaryAdjustment.findMany).toHaveBeenCalledWith({
        where: { employeeId: { in: [1] }, effectiveMonth: { lte: '2025-09' } },
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
      prisma.salaryAdjustment.findMany.mockResolvedValue([]);
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
      prisma.salaryAdjustment.findMany.mockResolvedValue([]);
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

    // 撤回路径的事务内 mock：viewed 复查 + 条件更新 + 回读 + 删条
    function mockRecallTx(viewedCount: number) {
      prisma.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'published',
      });
      // 撤回不再在事务外读写工资条
      (prisma as any).payslip = {
        findMany: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      };
      prisma._mockTx.payslip.count = jest.fn().mockResolvedValue(viewedCount);
      prisma._mockTx.payslip.deleteMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma._mockTx.payrollRun.updateMany = jest.fn().mockResolvedValue({ count: 1 });
      prisma._mockTx.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'recalled',
      });
    }

    it('撤回已发布的算薪批次后发送 payroll.status.changed（published -> recalled）', async () => {
      mockRecallTx(0);

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
      mockRecallTx(0);

      await service.recallRun(9, 1);

      // 工资条已删除，遗留通知会指向不存在的单据，必须一并清理
      expect(_notificationService.removeByRelated).toHaveBeenCalledWith('payroll_run', 9);
    });

    it('撤回时存在已查看工资条，抛「不可撤回」专属码 3012，而非 3005（员工无工资配置）', async () => {
      mockRecallTx(2);

      await expect(service.recallRun(9, 1)).rejects.toMatchObject({
        response: { code: 3012, message: '存在已查看的工资条，不可撤回' },
      });
    });

    it('B7 撤回竞态：viewed 复查在事务内，发现已查看即回滚，状态不变且工资条不删', async () => {
      // 模拟「事务外预检时还是 0，事务内复查时变 2」的竞态：员工在撤回过程中查看了工资条
      mockRecallTx(2);

      await expect(service.recallRun(9, 1)).rejects.toMatchObject({
        response: { code: 3012 },
      });

      // 事务内复查命中 → 不得继续状态变更，也不得删条
      expect(prisma._mockTx.payslip.count).toHaveBeenCalledWith({
        where: { runId: 9, status: 'viewed' },
      });
      expect(prisma._mockTx.payrollRun.updateMany).not.toHaveBeenCalled();
      expect(prisma._mockTx.payslip.deleteMany).not.toHaveBeenCalled();
      expect(_eventEmitter.emit).not.toHaveBeenCalled();
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

    it('撤回时状态变更与工资条删除必须同一事务，且状态更新为条件更新', async () => {
      mockRecallTx(0);

      await service.recallRun(9, 1);

      expect(prisma.$transaction).toHaveBeenCalled();
      // 条件更新：只有仍为 published 时才允许改成 recalled
      expect(prisma._mockTx.payrollRun.updateMany).toHaveBeenCalledWith({
        where: { id: 9, status: 'published' },
        data: expect.objectContaining({ status: 'recalled', recalledBy: 1 }),
      });
      expect(prisma._mockTx.payslip.deleteMany).toHaveBeenCalledWith({ where: { runId: 9 } });
      // 事务外不能再删一次：否则事务回滚时工资条删除不可回滚，
      // 会留下「批次仍是已发布、工资条却已被删」的反向错账
      expect((prisma as any).payslip.deleteMany).not.toHaveBeenCalled();
    });

    it('撤回时条件更新命中 0 行：批次不存在 → 3004，状态已变 → 3010', async () => {
      mockRecallTx(0);
      prisma._mockTx.payrollRun.updateMany = jest.fn().mockResolvedValue({ count: 0 });
      prisma._mockTx.payrollRun.findUnique = jest.fn().mockResolvedValue(null);

      await expect(service.recallRun(9, 1)).rejects.toMatchObject({
        response: { code: 3004 },
      });

      prisma._mockTx.payrollRun.findUnique = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'draft',
      });
      await expect(service.recallRun(9, 1)).rejects.toMatchObject({
        response: { code: 3010 },
      });
      expect(prisma._mockTx.payslip.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('listRuns — B2 筛选 + B8 可见性口径', () => {
    function setup(dataScope: { all: boolean; selfEmployeeId?: number; ids?: number[] }) {
      const prisma = createMockPrisma();
      const service = new PayrollService(
        prisma as any,
        { visibleScope: jest.fn().mockResolvedValue(dataScope) } as any,
        createMockPayslipService() as any,
        createMockNotificationService() as any,
        createMockLockService() as any,
        createMockEventEmitter() as any,
      );
      return { prisma, service };
    }

    it('month 格式非法 → 4000；status 非法 → 4000（不得抛 3010）', async () => {
      const { service } = setup({ all: true });

      await expect(
        service.listRuns({ userId: 1, page: 1, pageSize: 20, month: '2025-13' }),
      ).rejects.toMatchObject({ response: { code: 4000 } });
      await expect(
        service.listRuns({ userId: 1, page: 1, pageSize: 20, month: '202509' }),
      ).rejects.toMatchObject({ response: { code: 4000 } });
      await expect(
        service.listRuns({ userId: 1, page: 1, pageSize: 20, status: 'cancelled' }),
      ).rejects.toMatchObject({ response: { code: 4000 } });
    });

    it('全量权限 + 筛选：where 为 { month, status }（筛选生效且不再丢失）', async () => {
      const { prisma, service } = setup({ all: true });

      await service.listRuns({ userId: 1, page: 1, pageSize: 20, month: '2025-09', status: 'draft' });

      expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { month: '2025-09', status: 'draft' } }),
      );
      expect(prisma.payrollRun.count).toHaveBeenCalledWith({ where: { month: '2025-09', status: 'draft' } });
    });

    it('部门主管：筛选与数据权限合并，按明细所属部门可见（草稿批次也能看到）', async () => {
      const { prisma, service } = setup({ all: false, ids: [7] });

      await service.listRuns({ userId: 1, page: 1, pageSize: 20, month: '2025-09', status: 'draft' });

      expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            month: '2025-09',
            status: 'draft',
            details: { some: { employee: { departmentId: { in: [7] } } } },
          },
        }),
      );
      // B8：不再依赖 payslip.runId（草稿/已确认批次还没有工资条）
      expect(prisma.payslip.findMany).not.toHaveBeenCalled();
    });

    it('仅本人范围：按明细中的本人 employeeId 判定可见性', async () => {
      const { prisma, service } = setup({ all: false, ids: [], selfEmployeeId: 42 });

      await service.listRuns({ userId: 1, page: 1, pageSize: 20 });

      expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { details: { some: { employeeId: 42 } } } }),
      );
    });

    it('零范围用户仍 fail-closed 返回空分页', async () => {
      const { prisma, service } = setup({ all: false, ids: [] });

      const result = await service.listRuns({ userId: 1, page: 2, pageSize: 10 });

      expect(result).toEqual({ list: [], total: 0, page: 2, pageSize: 10 });
      expect(prisma.payrollRun.findMany).not.toHaveBeenCalled();
    });
  });

  describe('createRun — B6 批量取数 + C5 缺月报阻断', () => {
    let service: PayrollService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      service = new PayrollService(
        prisma as any,
        createMockDataScope() as any,
        createMockPayslipService() as any,
        createMockNotificationService() as any,
        createMockLockService() as any,
        createMockEventEmitter() as any,
      );
    });

    function monthly(employeeId: number, salary: number) {
      return {
        employeeId,
        workDays: 22,
        absentDays: 0,
        lateCount: 0,
        earlyCount: 0,
        unpaidLeaveMinutes: 0,
        overtimeWeekdayHours: 0,
        overtimeWeekendHours: 0,
        overtimeHolidayHours: 0,
        employee: { id: employeeId, name: `员工${employeeId}`, salary },
      };
    }

    it('120 名员工只查一次 salaryAdjustment.findMany，事务显式 30s 超时', async () => {
      const monthlies = Array.from({ length: 120 }, (_, i) => monthly(i + 1, 5000));
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.attendanceMonthly.findMany.mockResolvedValue(monthlies);
      prisma.employee.findMany.mockResolvedValue(
        monthlies.map((m) => ({ id: m.employeeId, employeeNo: `E${m.employeeId}`, name: m.employee.name })),
      );
      prisma.salaryAdjustment.findMany.mockResolvedValue([
        { employeeId: 1, amount: 7000 },
      ]);
      prisma._mockTx.payrollRun.create.mockResolvedValue({ id: 1, month: '2025-09', status: 'draft' });
      prisma._mockTx.payrollDetail.createMany.mockResolvedValue({ count: 960 });
      prisma._mockTx.payrollRun.update.mockImplementation(async (args: any) => args.data);

      await service.createRun('2025-09', 1);

      // 事务体内不再逐人查询：批量一次，且事务外方法不被调用
      expect(prisma.salaryAdjustment.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.salaryAdjustment.findMany).toHaveBeenCalledWith({
        where: { employeeId: { in: Array.from({ length: 120 }, (_, i) => i + 1) }, effectiveMonth: { lte: '2025-09' } },
        orderBy: [{ effectiveMonth: 'desc' }, { createdAt: 'desc' }],
      });
      expect(prisma.salaryAdjustment.findFirst).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 30_000 });

      // 同一批调整记录按员工取首条（生效月最新）作为该月基数
      const details = prisma._mockTx.payrollDetail.createMany.mock.calls[0][0].data;
      const base1 = details.find((d: any) => d.employeeId === 1 && d.itemCode === 'base');
      expect(base1.amount.toNumber()).toBe(7000);
    });

    it('在职员工缺当月已确认月报 → 阻断创建（3017）并回传缺失名单', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.attendanceMonthly.findMany.mockResolvedValue([monthly(1, 5000)]);
      prisma.employee.findMany.mockResolvedValue([
        { id: 1, employeeNo: 'E001', name: '张三' },
        { id: 2, employeeNo: 'E002', name: '李四' },
      ]);

      await expect(service.createRun('2025-09', 1)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 3017, detail: 'E002 李四' }),
      });
      // 阻断发生在事务前：不得写入任何批次
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('缺失超过 5 人时只列前 5 个并附总人数', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      prisma.attendanceMonthly.findMany.mockResolvedValue([monthly(1, 5000)]);
      prisma.employee.findMany.mockResolvedValue(
        Array.from({ length: 8 }, (_, i) => ({ id: i + 1, employeeNo: `E${i + 1}`, name: `员工${i + 1}` })),
      );

      await expect(service.createRun('2025-09', 1)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 3017,
          detail: 'E2 员工2、E3 员工3、E4 员工4、E5 员工5、E6 员工6 等 7 人',
        }),
      });
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
