/**
 * 以 UTC（=生产容器时区）运行：加班起止时间是「无时区墙钟串」，GMT+8 开发机上
 * `new Date(str)` 会"碰巧"解析正确，只有非北京时区才能暴露 8 小时偏移。
 *
 * @jest-environment ./jest-utc-environment
 */

import { Prisma } from '@prisma/client';
import { UnprocessableEntityException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../common/error-codes';
import * as ExcelJS from 'exceljs';
import { VacationService } from './vacation.service';

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
    overtimeRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    vacationType: {
      findUnique: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    leaveRecord: {
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };

  return {
    vacationBalance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      groupBy: jest.fn(),
    },
    vacationBalanceChange: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    leaveRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    overtimeRecord: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    systemSetting: {
      findUnique: jest.fn(),
    },
    vacationType: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
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
  return {
    approve: jest.fn(),
    reject: jest.fn(),
    startInstance: jest.fn(),
  };
}

function createMockNotificationService() {
  return {
    createMany: jest.fn(),
  };
}

function createMockLockService() {
  return {
    withLock: jest.fn((_resource: string, _ttlMs: number, fn: () => Promise<unknown>) => fn()),
  };
}

describe('VacationService', () => {
  let service: VacationService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let dataScope: ReturnType<typeof createMockDataScope>;
  let approvalClient: ReturnType<typeof createMockApprovalClient>;
  let lockService: ReturnType<typeof createMockLockService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    dataScope = createMockDataScope();
    approvalClient = createMockApprovalClient();
    lockService = createMockLockService();
    const notificationService = createMockNotificationService();
    service = new VacationService(
      prisma,
      dataScope as any,
      approvalClient as any,
      notificationService as any,
      lockService as any,
    );
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
          employeeId_vacationTypeId_year_month: {
            employeeId: 10,
            vacationTypeId: 1,
            year: 2025,
            month: 0,
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
      month: 1,
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
      // 默认将用途类型配置为月假（length=12），用于校验抵扣月份
      prisma.vacationType.findUnique.mockResolvedValue({ id: 1, monthlyDays: [4,4,4,4,4,4,5,5,5,5,5,5] });
      prisma.leaveRecord.create.mockResolvedValue({ id: 1 });
    });

    it('未指定抵扣月份时抛出异常（月假规则）', async () => {
      const { month, ...noMonth } = baseData;
      await expect(
        service.createLeaveRecord({ ...noMonth } as any, 1),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '请选择抵扣的假期月份' },
      });
    });

    it('抵扣月份超出1~12范围时抛出异常', async () => {
      await expect(
        service.createLeaveRecord({ ...baseData, month: 13 }, 1),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '请选择抵扣的假期月份' },
      });
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

    it('业务日按 UTC 归属年份：负时区宿主机上跨年请假不得退回上一年', async () => {
      // 业务日 '2027-01-01' 存为 2027-01-01T00:00:00Z；在 UTC-5 宿主机上
      // 本地 getFullYear() 会读成 2026，导致扣减落到上一年度的额度行。
      // 说明：Node 20+ 在 process.env.TZ 被赋值时会立刻重载时区数据，但文件级沙箱
      // 无法只对「本用例」生效（赋值是进程级的，且会在 teardown 时被还原），
      // 故此处不改 TZ —— 本文件已由 ./jest-utc-environment 以 UTC 运行；
      // 该用例需以外部 TZ=America/New_York 运行时才呈负例。
      await service.createLeaveRecord(
        { ...baseData, startDate: '2027-01-01', endDate: '2027-01-02' },
        1,
      );
      expect(prisma.vacationBalance.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeId_vacationTypeId_year_month: expect.objectContaining({ year: 2027 }),
          },
        }),
      );
    });
  });

  // ------------------------------------------------------------------
  // createLeaveRecord - 数据范围隔离（ADR-0010）
  // ------------------------------------------------------------------
  describe('createLeaveRecord - 数据范围隔离', () => {
    const baseData = {
      employeeId: 10,
      vacationTypeId: 1,
      startDate: '2025-01-15',
      endDate: '2025-01-20',
      days: 5,
      month: 1,
      reason: '测试请假',
    };

    beforeEach(() => {
      // 默认配置占位，便于越权用例只关心 scope 判定
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
      prisma.vacationType.findUnique.mockResolvedValue({ id: 1, monthlyDays: [4,4,4,4,4,4,5,5,5,5,5,5] });
      prisma.leaveRecord.create.mockResolvedValue({ id: 1 });
    });

    it('普通员工为本人创建记录：scope.selfEmployeeId 匹配 → 通过', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: 10 });
      const result = await service.createLeaveRecord(baseData, 1);
      expect(result).toBeDefined();
      expect(prisma.leaveRecord.create).toHaveBeenCalled();
    });

    it('普通员工为他人创建记录：scope.selfEmployeeId 不匹配 → 抛 FORBIDDEN', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: 99 });
      await expect(
        service.createLeaveRecord(baseData, 1),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' },
      });
      expect(prisma.leaveRecord.create).not.toHaveBeenCalled();
    });

    it('部门管理员为本部门员工创建记录：scope.ids 命中部门 → 通过', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [1, 2, 3], selfEmployeeId: undefined });
      prisma.employee.findUnique.mockResolvedValue({ id: 10, departmentId: 2 });
      const result = await service.createLeaveRecord(baseData, 1);
      expect(result).toBeDefined();
    });

    it('部门管理员为非本部门员工创建记录：scope.ids 未命中 → 抛 FORBIDDEN', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [1, 2, 3], selfEmployeeId: undefined });
      prisma.employee.findUnique.mockResolvedValue({ id: 10, departmentId: 99 });
      await expect(
        service.createLeaveRecord(baseData, 1),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' },
      });
    });

    // ── 关键越权漏洞：无角色用户既无 selfEmployeeId 又无部门范围时不应静默放行 ──
    it('无角色用户（scope 为 {all:false, ids:[], selfEmployeeId:undefined}）应为任意 employeeId 抛 FORBIDDEN', async () => {
      // 模拟既无 admin/hr 角色、又无 manager 部门、又未关联员工的用户
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: undefined });
      await expect(
        service.createLeaveRecord(baseData, 1),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' },
      });
      expect(prisma.leaveRecord.create).not.toHaveBeenCalled();
    });

    it('员工不存在且无 selfEmployeeId 时应抛 FORBIDDEN（而非静默放行）', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: undefined });
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.createLeaveRecord(baseData, 1),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' },
      });
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

    it('客户端 hours 字段已废弃：即使传入 0 也按起止时间推算时长，不抛参数错误', async () => {
      const result = await service.createOvertime({ ...baseData, hours: 0 }, 1);
      expect(result).toBeDefined();
      expect(prisma.overtimeRecord.create).toHaveBeenCalled();
      const createArgs = prisma.overtimeRecord.create.mock.calls[0][0];
      expect(Number(createArgs.data.hours)).toBe(3);
    });

    it('日期时间有效时成功创建记录', async () => {
      const result = await service.createOvertime(baseData, 1);
      expect(result).toBeDefined();
      expect(prisma.overtimeRecord.create).toHaveBeenCalled();
    });

    it('跨天加班时长由起止时间推算（18:00~次日02:00=8小时），忽略客户端 hours', async () => {
      await service.createOvertime(
        {
          ...baseData,
          overtimeDate: '2025-01-15',
          startTime: '2025-01-15 18:00:00',
          endTime: '2025-01-16 02:00:00',
          hours: 3,
        },
        1,
      );

      const createArgs = prisma.overtimeRecord.create.mock.calls[0][0];
      expect(Number(createArgs.data.hours)).toBe(8);
      // 墙钟串按北京时间解析：北京 1/15 18:00 → UTC 10:00，北京 1/16 02:00 → UTC 1/15 18:00
      expect(createArgs.data.startTime).toEqual(new Date('2025-01-15T10:00:00.000Z'));
      expect(createArgs.data.endTime).toEqual(new Date('2025-01-15T18:00:00.000Z'));
    });

    it('无时区墙钟串按北京时间入库：北京 18:00~22:00 → UTC 10:00~14:00（UTC 容器下不偏 8 小时）', async () => {
      await service.createOvertime(
        {
          ...baseData,
          overtimeDate: '2026-09-28',
          startTime: '2026-09-28 18:00',
          endTime: '2026-09-28 22:00',
          hours: 4,
        },
        1,
      );

      const createArgs = prisma.overtimeRecord.create.mock.calls[0][0];
      expect(createArgs.data.startTime).toEqual(new Date('2026-09-28T10:00:00.000Z'));
      expect(createArgs.data.endTime).toEqual(new Date('2026-09-28T14:00:00.000Z'));
      expect(Number(createArgs.data.hours)).toBe(4);
    });

    it('起止时间为非法格式（非 YYYY-MM-DD HH:mm）时抛出参数错误', async () => {
      await expect(
        service.createOvertime({ ...baseData, startTime: '2026/09/28 18:00' }, 1),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.PARAM_INVALID, message: '开始时间格式无效' },
      });
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
      // 调休类型默认为年假整户（非月假），month=0
      prisma._mockTx.vacationType.findUnique.mockResolvedValue({ monthlyDays: null });
      // 默认抢到「isCompensated: false → true」一次性令牌
      prisma._mockTx.overtimeRecord.updateMany.mockResolvedValue({ count: 1 });
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

    it('加班转调休天数按系统设置比例换算（20小时/10小时每天=2天）', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue({ value: '10', key: 'overtime_to_leave_hours' });
      prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue({
        id: 1, employeeId: 1, status: 'approved', isCompensated: false,
        hours: new Prisma.Decimal(20), overtimeDate: new Date('2026-06-15'),
      });
      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(null);
      prisma._mockTx.vacationBalance.create.mockResolvedValue({
        id: 9, employeeId: 1, vacationTypeId: 1, year: 2026,
        totalDays: new Prisma.Decimal(0), usedDays: new Prisma.Decimal(0),
      });
      prisma._mockTx.vacationBalance.update.mockResolvedValue({});
      prisma._mockTx.overtimeRecord.update.mockResolvedValue({});
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({ id: 1 });

      const result = await service.convertOvertimeToCompensatory({ ...baseParams, hours: 20 });

      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({ where: { key: 'overtime_to_leave_hours' } });
      // 额度年份/月份取加班日期（overtimeDate）所在年月，非「当前年」
      expect(prisma._mockTx.vacationBalance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ year: 2026, month: 0 }),
        }),
      );
      expect(result.days).toBe('2');
    });

    it('跨年加班按加班日期年份建额度（12月末加班不落到次年）', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);
      prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue({
        id: 1, employeeId: 1, status: 'approved', isCompensated: false,
        hours: new Prisma.Decimal(8), overtimeDate: new Date('2025-12-31'),
      });
      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(null);
      prisma._mockTx.vacationBalance.create.mockResolvedValue({
        id: 9, employeeId: 1, vacationTypeId: 1, year: 2025,
        totalDays: new Prisma.Decimal(0), usedDays: new Prisma.Decimal(0),
      });
      prisma._mockTx.vacationBalance.update.mockResolvedValue({});
      prisma._mockTx.overtimeRecord.update.mockResolvedValue({});
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({ id: 1 });

      await service.convertOvertimeToCompensatory({ ...baseParams, hours: 8 });

      expect(prisma._mockTx.vacationBalance.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeId_vacationTypeId_year_month: { employeeId: 1, vacationTypeId: 1, year: 2025, month: 0 } },
        }),
      );
    });

    it('系统设置未配置加班转调休比例时缺省为8小时/天', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);
      prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue({
        id: 1, employeeId: 1, status: 'approved', isCompensated: false,
        hours: new Prisma.Decimal(16), overtimeDate: new Date('2026-06-15'),
      });
      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue(null);
      prisma._mockTx.vacationBalance.create.mockResolvedValue({
        id: 9, employeeId: 1, vacationTypeId: 1, year: 2026,
        totalDays: new Prisma.Decimal(0), usedDays: new Prisma.Decimal(0),
      });
      prisma._mockTx.vacationBalance.update.mockResolvedValue({});
      prisma._mockTx.overtimeRecord.update.mockResolvedValue({});
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({ id: 1 });

      const result = await service.convertOvertimeToCompensatory({ ...baseParams, hours: 16 });

      expect(result.days).toBe('2');
    });

    it('并发重复兑换：未抢到「isCompensated: false」令牌的一方不入账', async () => {
      prisma._mockTx.overtimeRecord.findUnique.mockResolvedValue({
        id: 1, employeeId: 1, status: 'approved', isCompensated: false,
        hours: new Prisma.Decimal(8), overtimeDate: new Date('2026-06-15'),
      });
      // 另一请求/另一路径已抢先兑换，令牌被消费
      prisma._mockTx.overtimeRecord.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.convertOvertimeToCompensatory({ ...baseParams, hours: 8 }),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.OVERTIME_ALREADY_COMPENSATED },
      });

      expect(prisma._mockTx.overtimeRecord.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, isCompensated: false } }),
      );
      expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
      expect(prisma._mockTx.vacationBalanceChange.create).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------
  // listLeaveRecords - 日期范围过滤
  // ------------------------------------------------------------------
  describe('listLeaveRecords - 日期范围过滤', () => {
    beforeEach(() => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.leaveRecord.count.mockResolvedValue(0);
    });

    it('按 startDate/endDate 区间重叠过滤请假（排班日历月视图依赖）', async () => {
      await service.listLeaveRecords({ userId: 1, startDate: '2026-08-01', endDate: '2026-08-31' });

      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            endDate: { gte: new Date('2026-08-01 00:00:00') },
            startDate: { lte: new Date('2026-08-31 23:59:59') },
          }),
        }),
      );
    });

    it('未传日期范围时查询条件不含日期过滤', async () => {
      await service.listLeaveRecords({ userId: 1, status: 'approved' });

      expect(prisma.leaveRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
        }),
      );
    });
  });

  // ------------------------------------------------------------------
  // getAttendanceStatistics - 考勤统计（员工×月份应休/已休/剩余/加班时长）
  // ------------------------------------------------------------------
  describe('getAttendanceStatistics - 月假考勤统计', () => {
    const baseParams = { userId: 1, year: 2026, month: 6 };

    beforeEach(() => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      prisma.employee.findMany.mockResolvedValue([
        { id: 1, employeeNo: 'E001', name: '张三', departmentId: 2 },
      ]);
      prisma.vacationBalance.groupBy.mockResolvedValue([
        { employeeId: 1, _sum: { totalDays: new Prisma.Decimal(4), usedDays: new Prisma.Decimal(1) } },
      ]);
      prisma.overtimeRecord.groupBy.mockResolvedValue([
        { employeeId: 1, _sum: { hours: new Prisma.Decimal(8) } },
      ]);
    });

    it('按 data-scope 过滤员工，并按月汇总应休/已休/剩余/加班时长', async () => {
      const result = await service.getAttendanceStatistics(baseParams);

      // 数据范围过滤
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { in: ['active', 'probation'] } }),
        }),
      );
      // 余额按 {year,月假月 + 年度型 month=0} 汇总（年假等年度型额度也需计入）
      expect(prisma.vacationBalance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ year: 2026, month: { in: [0, 6] } }),
          by: ['employeeId'],
        }),
      );
      // 加班按加班日期所在月 + approved 汇总
      expect(prisma.overtimeRecord.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['employeeId'],
        }),
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        employeeNo: 'E001',
        name: '张三',
        totalDays: 4,
        usedDays: 1,
        remainingDays: 3,
        overtimeHours: 8,
      });
    });

    it('无余额/无加班记录时默认 0', async () => {
      prisma.vacationBalance.groupBy.mockResolvedValue([]);
      prisma.overtimeRecord.groupBy.mockResolvedValue([]);

      const result = await service.getAttendanceStatistics(baseParams);

      expect(result.rows[0]).toMatchObject({
        totalDays: 0,
        usedDays: 0,
        remainingDays: 0,
        overtimeHours: 0,
      });
    });

    it('只允许查看自己(scope.selfEmployeeId)时仅统计当前员工', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: 9 });
      prisma.employee.findMany.mockResolvedValue([
        { id: 9, employeeNo: 'E009', name: '自己', departmentId: 1 },
      ]);

      await service.getAttendanceStatistics({ ...baseParams, employeeId: 9 });

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 9 }),
        }),
      );
    });
  });

  // ------------------------------------------------------------------
  // approveLeave - 扣减前复核余额（防止审批期间余额被占用后仍超额透支）
  // ------------------------------------------------------------------
  describe('approveLeave - 扣减前复核余额', () => {
    const approvingLeave = {
      id: 1,
      employeeId: 2,
      vacationTypeId: 3,
      status: 'approving',
      approvalInstanceId: 50,
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-14'),
      days: new Prisma.Decimal(5),
      month: 8,
    };

    beforeEach(() => {
      prisma.leaveRecord.findUnique.mockResolvedValue(approvingLeave);
      prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '主管' });
    });

    it('余额不足时在调用审批引擎前拒绝，不产生状态变更', async () => {
      // 额度总共 3 天、已用 0 天，剩余 3 天 < 本次请假 5 天
      prisma.vacationBalance.findUnique.mockResolvedValue({
        id: 9,
        totalDays: new Prisma.Decimal(3),
        usedDays: new Prisma.Decimal(0),
      });

      await expect(service.approveLeave(1, 1)).rejects.toThrow(UnprocessableEntityException);

      expect(approvalClient.approve).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.leaveRecord.update).not.toHaveBeenCalled();
    });

    it('余额充足时按「剩余天」口径扣减并记录变更流水', async () => {
      prisma.vacationBalance.findUnique.mockResolvedValue({
        id: 9,
        totalDays: new Prisma.Decimal(10),
        usedDays: new Prisma.Decimal(2),
      });
      approvalClient.approve.mockResolvedValue({ status: 'approved' });
      prisma._mockTx.leaveRecord.updateMany.mockResolvedValue({ count: 1 });
      prisma._mockTx.vacationBalance.findUnique.mockResolvedValue({
        id: 9,
        totalDays: new Prisma.Decimal(10),
        usedDays: new Prisma.Decimal(2),
      });
      prisma._mockTx.vacationBalance.update.mockResolvedValue({});
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({});
      prisma._mockTx.leaveRecord.findUnique.mockResolvedValue({ id: 1, status: 'approved' });

      await service.approveLeave(1, 1);

      // usedDays 2 + 5 = 7
      expect(prisma._mockTx.vacationBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 9 },
          data: { usedDays: expect.anything() },
        }),
      );
      // 流水口径统一为「剩余天」：调整前 10-2=8，调整后 10-7=3
      const change = prisma._mockTx.vacationBalanceChange.create.mock.calls[0][0].data;
      expect(Number(change.balanceBefore)).toBe(8);
      expect(Number(change.balanceAfter)).toBe(3);
      expect(change.referenceType).toBe('leave_record');
    });
  });

  // ------------------------------------------------------------------
  // initializeYearBalances / carryOverBalances - 幂等与并发安全
  // 背景：这两个方法由定时任务（VacationBalanceSchedulerService）调用，
  // 且可被手工触发（POST /vacation/balances/initialize）。多实例部署下
  // 定时任务会在同一时刻并发执行，必须做到「重复执行不产生副作用」。
  // ------------------------------------------------------------------
  describe('initializeYearBalances / carryOverBalances - 幂等与并发安全', () => {
    const annualType = {
      id: 1,
      code: 'annual',
      name: '年假',
      monthlyDays: null,
      baseDays: new Prisma.Decimal(10),
      seniorityRule: null,
      enabled: true,
    };

    it('初始化年度额度使用 upsert，避免并发重复写入撞唯一键', async () => {
      prisma.vacationType.findMany.mockResolvedValue([annualType]);
      prisma.employee.findMany.mockResolvedValue([{ id: 10, hireDate: new Date('2020-01-01') }]);
      prisma.vacationBalance.upsert.mockResolvedValue({} as any);

      await service.initializeYearBalances(2026);

      expect(prisma.vacationBalance.upsert).toHaveBeenCalledWith({
        where: {
          employeeId_vacationTypeId_year_month: {
            employeeId: 10,
            vacationTypeId: 1,
            year: 2026,
            month: 0,
          },
        },
        // update: {} —— 已存在的额度不改动，仅保证不存在时补齐
        update: {},
        create: {
          employeeId: 10,
          vacationTypeId: 1,
          year: 2026,
          month: 0,
          totalDays: new Prisma.Decimal(10),
          usedDays: 0,
        },
      });
      // 不再走 findUnique + create 的竞态写法
      expect(prisma.vacationBalance.findUnique).not.toHaveBeenCalled();
      expect(prisma.vacationBalance.create).not.toHaveBeenCalled();
    });

    it('额度初始化与跨年结转都把试用期员工视为在职（与考勤统计口径一致）', async () => {
      const carryOverType = {
        ...annualType,
        carryOverMaxDays: new Prisma.Decimal(5),
        carryOverRatio: null,
      };
      prisma.vacationType.findMany.mockResolvedValue([carryOverType]);
      prisma.employee.findMany.mockResolvedValue([{ id: 10, hireDate: new Date('2020-01-01') }]);
      prisma.vacationBalance.upsert.mockResolvedValue({} as any);

      await service.initializeYearBalances(2026);
      await service.carryOverBalances(2025, 2026);

      // 统计口径（getAttendanceStatistics）已含 probation，若初始化/结转只取 active，
      // 试用期员工会在统计里出现但「应休」恒为 0。
      expect(prisma.employee.findMany).toHaveBeenNthCalledWith(1, {
        where: { status: { in: ['active', 'probation'] } },
      });
      expect(prisma.employee.findMany).toHaveBeenLastCalledWith({
        where: { status: { in: ['active', 'probation'] } },
      });
    });

    it('初始化与跨年结转均通过分布式锁串行化', async () => {
      prisma.vacationType.findMany.mockResolvedValue([]);

      await service.initializeYearBalances(2026);
      await service.carryOverBalances(2025, 2026);

      expect(lockService.withLock).toHaveBeenCalledWith(
        'vacation:initialize-balances',
        expect.any(Number),
        expect.any(Function),
      );
      expect(lockService.withLock).toHaveBeenCalledWith(
        'vacation:carry-over',
        expect.any(Number),
        expect.any(Function),
      );
    });

    it('跨年结转命中已存在的结转流水时跳过，避免重复执行二次累加', async () => {
      // 1) initializeYearBalances(toYear)：无启用的假期类型，直接返回
      prisma.vacationType.findMany.mockResolvedValueOnce([]);
      // 2) carryOverBalances：取支持结转的假期类型 + 在职员工
      prisma.vacationType.findMany.mockResolvedValueOnce([
        { ...annualType, carryOverMaxDays: null, carryOverRatio: null },
      ]);
      prisma.employee.findMany.mockResolvedValue([{ id: 10 }]);
      // 3) 上年余额：总 5 天、已用 1 天 → 剩余 4 天
      prisma.vacationBalance.findUnique
        .mockResolvedValueOnce({ id: 11, totalDays: new Prisma.Decimal(5), usedDays: new Prisma.Decimal(1) })
        .mockResolvedValueOnce({ id: 20, totalDays: new Prisma.Decimal(10), usedDays: new Prisma.Decimal(0) });
      // 4) 该 (员工, 目标额度, 来源额度) 已有结转流水 → 跳过
      prisma.vacationBalanceChange.count.mockResolvedValue(1);

      await service.carryOverBalances(2025, 2026);

      expect(prisma.vacationBalanceChange.count).toHaveBeenCalledWith({
        where: { referenceType: 'vacation_carry_over', referenceId: 11 },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
    });

    it('跨年结转在无重复流水时正常累加，并写入可幂等识别的流水', async () => {
      prisma.vacationType.findMany.mockResolvedValueOnce([]);
      prisma.vacationType.findMany.mockResolvedValueOnce([
        { ...annualType, carryOverMaxDays: null, carryOverRatio: null },
      ]);
      prisma.employee.findMany.mockResolvedValue([{ id: 10 }]);
      prisma.vacationBalance.findUnique
        .mockResolvedValueOnce({ id: 11, totalDays: new Prisma.Decimal(5), usedDays: new Prisma.Decimal(1) })
        .mockResolvedValueOnce({ id: 20, totalDays: new Prisma.Decimal(10), usedDays: new Prisma.Decimal(2) });
      prisma.vacationBalanceChange.count.mockResolvedValue(0);
      prisma._mockTx.vacationBalance.update.mockResolvedValue({});
      prisma._mockTx.vacationBalanceChange.create.mockResolvedValue({});

      await service.carryOverBalances(2025, 2026);

      // 结转 4 天 → 目标额度总天数 10 + 4 = 14
      expect(prisma._mockTx.vacationBalance.update).toHaveBeenCalledWith({
        where: { id: 20 },
        data: { totalDays: new Prisma.Decimal(14) },
      });
      const change = prisma._mockTx.vacationBalanceChange.create.mock.calls[0][0].data;
      expect(Number(change.amount)).toBe(4);
      // 流水口径为「剩余天」：调整前 10-2=8，调整后 14-2=12
      expect(Number(change.balanceBefore)).toBe(8);
      expect(Number(change.balanceAfter)).toBe(12);
      expect(change.reason).toBe('2025年假期余额结转');
      // 幂等标识：来源额度 id + 专用 referenceType
      expect(change.referenceType).toBe('vacation_carry_over');
      expect(change.referenceId).toBe(11);
    });
  });

  // ------------------------------------------------------------------
  // exportLeaveRecords - 导出件时间口径
  // ------------------------------------------------------------------
  describe('exportLeaveRecords - 导出件时间口径', () => {
    const loadSheet = async (buffer: Buffer) => {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      return workbook.worksheets[0];
    };

    /**
     * createdAt 是真实时刻而非 @db.Date，用 toISOString() 取日期得到的是 UTC 日历日：
     * 北京时间 2026-10-01 01:30 的记录会被导出成「2026-09-30」，落在前一天。
     */
    it('「申请日期」按北京时间取日历日（凌晨记录不落到前一天）', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
      prisma.leaveRecord.findMany.mockResolvedValue([
        {
          id: 5,
          startDate: new Date('2026-10-01'),
          endDate: new Date('2026-10-02'),
          days: new Prisma.Decimal(2),
          status: 'approved',
          createdAt: new Date('2026-09-30T17:30:00.000Z'), // 北京时间 2026-10-01 01:30
          vacationType: { id: 1, code: 'annual', name: '年假' },
          employee: { id: 9, name: '张三', department: { id: 3, name: '技术部' } },
        },
      ]);

      const sheet = await loadSheet(await service.exportLeaveRecords(1, {}));

      // 第 9 列为「申请日期」
      expect(sheet.getRow(2).getCell(9).value).toBe('2026-10-01');
      // 第 5/6 列为开始/结束日期（@db.Date，UTC 午夜写入，按 UTC 取日期即正确）
      expect(sheet.getRow(2).getCell(5).value).toBe('2026-10-01');
      expect(sheet.getRow(2).getCell(6).value).toBe('2026-10-02');
    });
  });

  // ------------------------------------------------------------------
  // 零范围用户越权写入：{all:false, ids:[], selfEmployeeId:undefined}
  // 既无 admin/hr、又无部门范围、又未关联员工的用户，
  // convertOvertimeToCompensatory / adjustBalance 缺少 createLeaveRecord 同款
  // fail-closed 守卫时会静默放行任意 employeeId（横向越权）。
  // ------------------------------------------------------------------
  describe('convertOvertimeToCompensatory - 零范围用户不得越权兑换', () => {
    it('零范围用户为任意员工兑换调休：应抛 FORBIDDEN', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: undefined });

      await expect(
        service.convertOvertimeToCompensatory({
          employeeId: 1,
          overtimeId: 1,
          vacationTypeId: 1,
          hours: 8,
          userId: 1,
        }),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工操作调休转换' },
      });
      expect(prisma._mockTx.overtimeRecord.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('adjustBalance - 零范围用户不得越权调整', () => {
    it('零范围用户调整任意员工额度：应抛 FORBIDDEN', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [], selfEmployeeId: undefined });

      await expect(
        service.adjustBalance({
          employeeId: 10,
          vacationTypeId: 1,
          year: 2025,
          changeDays: 5,
          reason: '测试',
          userId: 1,
        }),
      ).rejects.toMatchObject({
        response: { code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权调整其他员工的假期余额' },
      });
      expect(prisma._mockTx.vacationBalance.update).not.toHaveBeenCalled();
    });
  });
});
