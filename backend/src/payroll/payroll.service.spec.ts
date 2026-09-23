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
  return { create: jest.fn().mockResolvedValue({}) };
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
      expect(base.amount).toBe(10000);
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
      prisma.payrollRun.update = jest.fn().mockResolvedValue({
        id: 9,
        month: '2026-08',
        status: 'recalled',
      });

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
});
