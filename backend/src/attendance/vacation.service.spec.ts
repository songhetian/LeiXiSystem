import { VacationService } from './vacation.service';
import { Prisma } from '@prisma/client';
import { UnprocessableEntityException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';

function createMockPrisma() {
  const mockTx = {
    vacationBalance: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    vacationBalanceChange: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
  };

  return {
    vacationBalance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    vacationBalanceChange: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    leaveRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    overtimeRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockTx)),
    _mockTx: mockTx,
  } as any;
}

function createMockDataScope() {
  return {
    visibleScope: jest.fn(),
  };
}

function createMockApprovalClient() {
  return {};
}

function createMockNotificationService() {
  return {
    createMany: jest.fn(),
  };
}

describe('VacationService', () => {
  let service: VacationService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dataScope: ReturnType<typeof createMockDataScope>;

  beforeEach(() => {
    prisma = createMockPrisma();
    dataScope = createMockDataScope();
    const approvalClient = createMockApprovalClient();
    const notificationService = createMockNotificationService();
    service = new VacationService(prisma, dataScope as any, approvalClient as any, notificationService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // adjustBalance - 增加余额
  // ------------------------------------------------------------------
  describe('adjustBalance - 增加余额', () => {
    it('成功增加假期余额并记录变更', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });

      const mockBalance = {
        id: 1,
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        totalDays: new Prisma.Decimal(10),
        usedDays: new Prisma.Decimal(3),
      };

      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(mockBalance);
      prisma._mockTx.vacationBalance.update.mockResolvedValue({
        ...mockBalance,
        totalDays: new Prisma.Decimal(15),
      });
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({ id: 1 });

      const result = await service.adjustBalance({
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        changeDays: 5,
        reason: '手动调整-增加额度',
        userId,
      });

      expect(prisma._mockTx.vacationBalance.findUnique).toHaveBeenCalledWith({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId: 10,
            vacationTypeId: 1,
            year: 2025,
          },
        },
      });

      expect(prisma._mockTx.vacationBalance.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          totalDays: new Prisma.Decimal(15),
        },
      });

      expect(prisma._mockTx.vacationBalanceChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          employeeId: 10,
          balanceId: 1,
          changeType: 'adjustment',
          amount: new Prisma.Decimal(5),
          balanceBefore: new Prisma.Decimal(7),
          balanceAfter: new Prisma.Decimal(12),
          reason: '手动调整-增加额度',
          createdBy: userId,
        }),
      });

      expect(result.balance).toBeDefined();
      expect(result.change).toBeDefined();
    });
  });

  // ------------------------------------------------------------------
  // adjustBalance - 减少余额
  // ------------------------------------------------------------------
  describe('adjustBalance - 减少余额', () => {
    it('成功减少假期余额并记录变更', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });

      const mockBalance = {
        id: 1,
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        totalDays: new Prisma.Decimal(10),
        usedDays: new Prisma.Decimal(3),
      };

      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(mockBalance);
      prisma._mockTx.vacationBalance.update.mockResolvedValue({
        ...mockBalance,
        totalDays: new Prisma.Decimal(7),
      });
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({ id: 1 });

      const result = await service.adjustBalance({
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        changeDays: -3,
        reason: '手动调整-扣减额度',
        userId,
      });

      expect(prisma._mockTx.vacationBalance.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          totalDays: new Prisma.Decimal(7),
        },
      });

      expect(prisma._mockTx.vacationBalanceChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeType: 'adjustment',
          amount: new Prisma.Decimal(-3),
          balanceBefore: new Prisma.Decimal(7),
          balanceAfter: new Prisma.Decimal(4),
          reason: '手动调整-扣减额度',
        }),
      });
    });

    it('允许调整后余额为负数（人工调整不受限制）', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });

      const mockBalance = {
        id: 1,
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        totalDays: new Prisma.Decimal(5),
        usedDays: new Prisma.Decimal(3),
      };

      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(mockBalance);
      prisma._mockTx.vacationBalance.update.mockResolvedValue({
        ...mockBalance,
        totalDays: new Prisma.Decimal(-5),
      });
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({ id: 1 });

      const result = await service.adjustBalance({
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        changeDays: -10,
        reason: '手动调整-特殊扣减',
        userId,
      });

      expect(prisma._mockTx.vacationBalance.update).toHaveBeenCalled();
      expect(prisma._mockTx.vacationBalanceChange.create).toHaveBeenCalled();

      const changeData = prisma._mockTx.vacationBalanceChange.create.mock.calls[0][0].data;
      expect(changeData.balanceAfter.lessThan(0)).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // adjustBalance - 余额不存在时
  // ------------------------------------------------------------------
  describe('adjustBalance - 余额不存在', () => {
    it('当余额记录不存在时抛出异常', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });

      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(null);

      await expect(
        service.adjustBalance({
          employeeId: 10,
          vacationTypeId: 1,
          year: 2025,
          changeDays: 5,
          reason: '测试',
          userId,
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      await expect(
        service.adjustBalance({
          employeeId: 10,
          vacationTypeId: 1,
          year: 2025,
          changeDays: 5,
          reason: '测试',
          userId,
        }),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.VACATION_BALANCE_NOT_FOUND },
      });
    });
  });

  // ------------------------------------------------------------------
  // adjustBalance - 权限校验
  // ------------------------------------------------------------------
  describe('adjustBalance - 数据权限校验', () => {
    it('当用户只能查看自己时，不能调整他人余额', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({
        all: false,
        ids: [],
        selfEmployeeId: 20,
      });

      await expect(
        service.adjustBalance({
          employeeId: 10,
          vacationTypeId: 1,
          year: 2025,
          changeDays: 5,
          reason: '测试',
          userId,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('部门管理员只能调整本部门员工余额', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({
        all: false,
        ids: [2, 3],
        selfEmployeeId: null,
      });

      prisma.employee.findUnique.mockResolvedValue({
        id: 10,
        departmentId: 5,
      });

      await expect(
        service.adjustBalance({
          employeeId: 10,
          vacationTypeId: 1,
          year: 2025,
          changeDays: 5,
          reason: '测试',
          userId,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
      });
    });
  });

  // ------------------------------------------------------------------
  // listBalanceChanges - 查询余额变更记录
  // ------------------------------------------------------------------
  describe('listBalanceChanges - 查询余额变更记录', () => {
    it('按员工、假期类型、年份、变更类型筛选', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });

      const mockChanges = [
        {
          id: 1,
          employeeId: 10,
          balanceId: 1,
          changeType: 'adjustment',
          amount: new Prisma.Decimal(5),
          balanceBefore: new Prisma.Decimal(7),
          balanceAfter: new Prisma.Decimal(12),
          reason: '手动调整',
          createdAt: new Date(),
          balance: {
            vacationType: { id: 1, code: 'annual', name: '年假' },
          },
          employee: {
            id: 10,
            employeeNo: 'E001',
            name: '张三',
          },
        },
      ];

      prisma.vacationBalanceChange.findMany.mockResolvedValue(mockChanges);
      prisma.vacationBalanceChange.count.mockResolvedValue(1);

      const result = await service.listBalanceChanges({
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        changeType: 'adjustment',
        userId,
        page: 1,
        pageSize: 10,
      });

      expect(prisma.vacationBalanceChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 10,
            balance: expect.objectContaining({
              vacationTypeId: 1,
              year: 2025,
            }),
            changeType: 'adjustment',
          }),
          include: expect.objectContaining({
            balance: expect.anything(),
            employee: expect.anything(),
          }),
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 10,
        }),
      );

      expect(result.list).toEqual(mockChanges);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('不带筛选条件时返回所有可见记录', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });

      prisma.vacationBalanceChange.findMany.mockResolvedValue([]);
      prisma.vacationBalanceChange.count.mockResolvedValue(0);

      await service.listBalanceChanges({
        userId,
        page: 1,
        pageSize: 10,
      });

      expect(prisma.vacationBalanceChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('数据权限控制：只能查看自己的记录', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({
        all: false,
        ids: [],
        selfEmployeeId: 20,
      });

      prisma.vacationBalanceChange.findMany.mockResolvedValue([]);
      prisma.vacationBalanceChange.count.mockResolvedValue(0);

      await service.listBalanceChanges({
        userId,
        page: 1,
        pageSize: 10,
      });

      expect(prisma.vacationBalanceChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 20,
          }),
        }),
      );
    });

    it('数据权限控制：部门范围', async () => {
      const userId = 1;
      dataScope.visibleScope.mockResolvedValue({
        all: false,
        ids: [2, 3],
        selfEmployeeId: null,
      });

      prisma.vacationBalanceChange.findMany.mockResolvedValue([]);
      prisma.vacationBalanceChange.count.mockResolvedValue(0);

      await service.listBalanceChanges({
        userId,
        page: 1,
        pageSize: 10,
      });

      expect(prisma.vacationBalanceChange.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employee: expect.objectContaining({
              departmentId: { in: [2, 3] },
            }),
          }),
        }),
      );
    });
  });

  // ------------------------------------------------------------------
  // createLeaveRecord - 日期范围校验
  // ------------------------------------------------------------------
  describe('createLeaveRecord - 日期范围校验', () => {
    const baseData = {
      employeeId: 10,
      vacationTypeId: 1,
      startDate: '2025-01-15',
      endDate: '2025-01-20',
      days: 5,
      reason: '测试请假',
    };

    beforeEach(() => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      prisma.employee.findUnique.mockResolvedValue({
        id: 10,
        hireDate: new Date('2020-01-01'),
        departmentId: 1,
      });
      prisma.vacationBalance.findUnique.mockResolvedValue({
        id: 1,
        employeeId: 10,
        vacationTypeId: 1,
        year: 2025,
        totalDays: new Prisma.Decimal(10),
        usedDays: new Prisma.Decimal(0),
      });
      prisma.leaveRecord.create.mockResolvedValue({ id: 1 });
    });

    it('开始日期晚于结束日期时抛出异常', async () => {
      await expect(
        service.createLeaveRecord(
          { ...baseData, startDate: '2025-01-20', endDate: '2025-01-15' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createLeaveRecord(
          { ...baseData, startDate: '2025-01-20', endDate: '2025-01-15' },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '开始日期不能晚于结束日期' },
      });
    });

    it('开始日期格式无效时抛出异常', async () => {
      await expect(
        service.createLeaveRecord(
          { ...baseData, startDate: 'invalid-date' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createLeaveRecord(
          { ...baseData, startDate: 'invalid-date' },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '开始日期格式无效' },
      });
    });

    it('结束日期格式无效时抛出异常', async () => {
      await expect(
        service.createLeaveRecord(
          { ...baseData, endDate: 'invalid-date' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createLeaveRecord(
          { ...baseData, endDate: 'invalid-date' },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '结束日期格式无效' },
      });
    });

    it('结束日期超过1年以上时抛出异常', async () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 2);
      const farFutureStr = farFuture.toISOString().split('T')[0];

      await expect(
        service.createLeaveRecord(
          { ...baseData, endDate: farFutureStr },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createLeaveRecord(
          { ...baseData, endDate: farFutureStr },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '结束日期不能超过当前日期1年以上' },
      });
    });

    it('开始日期早于入职日期时抛出异常', async () => {
      await expect(
        service.createLeaveRecord(
          { ...baseData, startDate: '2019-01-01', endDate: '2019-01-05' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createLeaveRecord(
          { ...baseData, startDate: '2019-01-01', endDate: '2019-01-05' },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '请假开始日期不能早于入职日期' },
      });
    });

    it('请假天数小于等于0时抛出异常', async () => {
      await expect(
        service.createLeaveRecord(
          { ...baseData, days: 0 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createLeaveRecord(
          { ...baseData, days: -1 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('日期范围有效时成功创建记录', async () => {
      const result = await service.createLeaveRecord(baseData, 1);
      expect(result).toBeDefined();
      expect(prisma.leaveRecord.create).toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // createOvertime - 日期时间校验
  // ------------------------------------------------------------------
  describe('createOvertime - 日期时间校验', () => {
    const baseData = {
      employeeId: 10,
      overtimeDate: '2025-01-15',
      startTime: '2025-01-15 18:00:00',
      endTime: '2025-01-15 21:00:00',
      hours: 3,
      reason: '测试加班',
    };

    beforeEach(() => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      prisma.employee.findUnique.mockResolvedValue({
        id: 10,
        hireDate: new Date('2020-01-01'),
        departmentId: 1,
      });
      prisma.overtimeRecord.create.mockResolvedValue({ id: 1 });
    });

    it('开始时间晚于结束时间时抛出异常', async () => {
      await expect(
        service.createOvertime(
          { ...baseData, startTime: '2025-01-15 21:00:00', endTime: '2025-01-15 18:00:00' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createOvertime(
          { ...baseData, startTime: '2025-01-15 21:00:00', endTime: '2025-01-15 18:00:00' },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '加班开始时间必须早于结束时间' },
      });
    });

    it('加班日期格式无效时抛出异常', async () => {
      await expect(
        service.createOvertime(
          { ...baseData, overtimeDate: 'invalid-date' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createOvertime(
          { ...baseData, overtimeDate: 'invalid-date' },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '加班日期格式无效' },
      });
    });

    it('加班日期超过1年以上时抛出异常', async () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 2);
      const farFutureStr = farFuture.toISOString().split('T')[0];

      await expect(
        service.createOvertime(
          { ...baseData, overtimeDate: farFutureStr },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('加班日期早于入职日期时抛出异常', async () => {
      await expect(
        service.createOvertime(
          { ...baseData, overtimeDate: '2019-01-01' },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createOvertime(
          { ...baseData, overtimeDate: '2019-01-01' },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '加班日期不能早于入职日期' },
      });
    });

    it('加班小时数小于等于0时抛出异常', async () => {
      await expect(
        service.createOvertime(
          { ...baseData, hours: 0 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createOvertime(
          { ...baseData, hours: -1 },
          1,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('日期时间有效时成功创建记录', async () => {
      const result = await service.createOvertime(baseData, 1);
      expect(result).toBeDefined();
      expect(prisma.overtimeRecord.create).toHaveBeenCalled();
    });
  });

  describe('convertOvertimeToCompensatory - 加班转调休校验', () => {
    const baseParams = {
      employeeId: 1,
      overtimeId: 1,
      vacationTypeId: 1,
      hours: 8,
      userId: 1,
    };

    beforeEach(() => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
    });

    it('兑换小时数小于等于0时抛出 PARAM_INVALID 错误', async () => {
      await expect(
        service.convertOvertimeToCompensatory({ ...baseParams, hours: 0 }),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '兑换小时数必须大于0' },
      });

      await expect(
        service.convertOvertimeToCompensatory({ ...baseParams, hours: -1 }),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '兑换小时数必须大于0' },
      });
    });

    it('兑换小时数为正数时不会因参数校验失败', async () => {
      let paramInvalidThrown = false;
      try {
        await service.convertOvertimeToCompensatory({ ...baseParams, hours: 8 });
      } catch (e: any) {
        if (e.response?.code === ERROR_CODES.PARAM_INVALID) {
          paramInvalidThrown = true;
        }
      }
      expect(paramInvalidThrown).toBe(false);
    });
  });
});
