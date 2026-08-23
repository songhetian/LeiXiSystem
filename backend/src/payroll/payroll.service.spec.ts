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
});
