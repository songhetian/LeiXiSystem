import { AttendanceMonthlyService } from './attendance-monthly.service';
import { Prisma } from '@prisma/client';

function createMockPrisma() {
  return {
    attendanceDaily: {
      findMany: jest.fn(),
    },
    attendanceMonthly: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

function createMockDataScope() {
  return { visibleScope: jest.fn() };
}

function createMockEventEmitter() {
  return { emit: jest.fn() };
}

function createMockLockService() {
  return {
    withLock: jest.fn((key, ttl, fn) => fn()),
  };
}

describe('AttendanceMonthlyService', () => {
  describe('list - 部门维度过滤（报表按部门导出）', () => {
    let service: AttendanceMonthlyService;
    let prisma: ReturnType<typeof createMockPrisma>;
    let dataScope: { visibleScope: jest.Mock };

    beforeEach(() => {
      prisma = createMockPrisma();
      dataScope = createMockDataScope();
      service = new AttendanceMonthlyService(
        prisma as any,
        dataScope as any,
        createMockEventEmitter() as any,
        createMockLockService() as any,
      );
      prisma.attendanceMonthly.findMany.mockResolvedValue([]);
      prisma.attendanceMonthly.count.mockResolvedValue(0);
    });

    it('管理员传入 departmentId 时按部门过滤月报', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });

      await service.list({ departmentId: 5, userId: 9, page: 1, pageSize: 20 });

      const where = prisma.attendanceMonthly.findMany.mock.calls[0][0].where;
      expect(where.employee.departmentId).toBe(5);
    });

    it('部门受限时，月报过滤为其可见部门与查询部门的交集（不越权）', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [1, 2] });

      await service.list({ departmentId: 3, userId: 9, page: 1, pageSize: 20 });

      const where = prisma.attendanceMonthly.findMany.mock.calls[0][0].where;
      expect(where.employee.departmentId).toEqual({ in: [1, 2] });
      expect(where.AND[0].employee.departmentId).toBe(3);
    });

    it('未传 departmentId 时不追加部门过滤', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });

      await service.list({ userId: 9, page: 1, pageSize: 20 });

      const where = prisma.attendanceMonthly.findMany.mock.calls[0][0].where;
      expect(where.employee).toBeUndefined();
    });
  });

  // 业务日（workDate）以 UTC 午夜存储，月度区间必须用 Date.UTC 构造。
  // `new Date(year, monthNum - 1, 1)` 按宿主机本地时区构造：GMT+8 开发机上区间
  // 整体前移 8 小时，`lte 当月最后一天 00:00` 会把最后一天（UTC 午夜）排除掉，
  // 月报少算一天；UTC 容器下则"碰巧"正确，故该用例在 UTC 环境下失效、在 GMT+8 有效。
  describe('generate - 月度区间口径', () => {
    let service: AttendanceMonthlyService;
    let prisma: ReturnType<typeof createMockPrisma>;
    let dataScope: { visibleScope: jest.Mock };

    beforeEach(() => {
      prisma = createMockPrisma();
      dataScope = createMockDataScope();
      service = new AttendanceMonthlyService(
        prisma as any,
        dataScope as any,
        createMockEventEmitter() as any,
        createMockLockService() as any,
      );
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
      prisma.attendanceMonthly.findFirst.mockResolvedValue(null);
      prisma.attendanceDaily.findMany.mockResolvedValue([]);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    });

    it('按月查询日报使用 UTC 月区间，不因宿主机时区漏掉当月最后一天', async () => {
      await service.generate({ month: '2026-09', userId: 9 });

      const where = prisma.attendanceDaily.findMany.mock.calls[0][0].where;
      expect(where.workDate.gte.toISOString()).toBe('2026-09-01T00:00:00.000Z');
      expect(where.workDate.lt.toISOString()).toBe('2026-10-01T00:00:00.000Z');
      // 当月最后一天（UTC 午夜）必须落在左闭右开区间内
      const lastDay = new Date('2026-09-30T00:00:00.000Z').getTime();
      expect(lastDay).toBeGreaterThanOrEqual(where.workDate.gte.getTime());
      expect(lastDay).toBeLessThan(where.workDate.lt.getTime());
    });

    // 引擎 buildMonthly 已算出 totalLateMinutes / totalEarlyMinutes，
    // 但 upsert 的 create/update 都没有写入这两个字段，导致月报「迟到总分钟」「早退总分钟」
    // 永远取 Prisma 默认值 0，迟到/早退统计口径失真。
    it('generate 必须把日报迟到/早退分钟数汇总写入月报，不得恒为默认 0', async () => {
      prisma.attendanceDaily.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDate: new Date('2026-09-02T00:00:00.000Z'),
          status: 'late',
          lateMinutes: 12,
          earlyMinutes: 0,
          overtimeMinutes: 0,
        },
        {
          employeeId: 1,
          workDate: new Date('2026-09-03T00:00:00.000Z'),
          status: 'early',
          lateMinutes: 0,
          earlyMinutes: 8,
          overtimeMinutes: 0,
        },
      ] as any);
      prisma.attendanceMonthly.upsert.mockResolvedValue({} as any);

      await service.generate({ month: '2026-09', userId: 9 });

      const create = prisma.attendanceMonthly.upsert.mock.calls[0][0].create;
      expect(create.totalLateMinutes).toBe(12);
      expect(create.totalEarlyMinutes).toBe(8);
      const update = prisma.attendanceMonthly.upsert.mock.calls[0][0].update;
      expect(update.totalLateMinutes).toBe(12);
      expect(update.totalEarlyMinutes).toBe(8);
    });
  });

  // 日报里的请假是「天」（AttendanceDaily.leaveDays Decimal），月报列是「分钟」
  // （AttendanceMonthly.leaveMinutes Int），聚合时必须折算（口径：8 小时 = 1 天 = 480 分钟）。
  // 此前组装 DailyRecord 时硬编码 leaveMinutes: 0，导致：
  //   1) 月报「请假时长(小时)」永远显示 0.0h（用户可见）；
  //   2) 算薪 noLeave = (leaveMinutes === 0) 恒为 true，有请假的员工照样拿全勤奖（多发钱）。
  describe('generate - 请假时长折算（8 小时 = 1 天）', () => {
    let service: AttendanceMonthlyService;
    let prisma: ReturnType<typeof createMockPrisma>;
    let dataScope: { visibleScope: jest.Mock };

    beforeEach(() => {
      prisma = createMockPrisma();
      dataScope = createMockDataScope();
      service = new AttendanceMonthlyService(
        prisma as any,
        dataScope as any,
        createMockEventEmitter() as any,
        createMockLockService() as any,
      );
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
      prisma.attendanceMonthly.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    });

    it('日报 leaveDays 需折算为月报 leaveMinutes，不得恒为 0', async () => {
      prisma.attendanceDaily.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDate: new Date('2026-09-02T00:00:00.000Z'),
          status: 'leave',
          lateMinutes: 0,
          earlyMinutes: 0,
          overtimeMinutes: 0,
          leaveDays: new Prisma.Decimal(1),
        },
        {
          employeeId: 1,
          workDate: new Date('2026-09-03T00:00:00.000Z'),
          status: 'normal',
          lateMinutes: 0,
          earlyMinutes: 0,
          overtimeMinutes: 0,
          leaveDays: new Prisma.Decimal(0.5),
        },
      ] as any);
      prisma.attendanceMonthly.upsert.mockResolvedValue({} as any);

      await service.generate({ month: '2026-09', userId: 9 });

      // 1 天 + 0.5 天 = 1.5 天 = 720 分钟
      const create = prisma.attendanceMonthly.upsert.mock.calls[0][0].create;
      const update = prisma.attendanceMonthly.upsert.mock.calls[0][0].update;
      expect(create.leaveMinutes).toBe(720);
      expect(update.leaveMinutes).toBe(720);
    });

    it('无请假日报折算后 leaveMinutes 仍为 0', async () => {
      prisma.attendanceDaily.findMany.mockResolvedValue([
        {
          employeeId: 1,
          workDate: new Date('2026-09-02T00:00:00.000Z'),
          status: 'normal',
          lateMinutes: 0,
          earlyMinutes: 0,
          overtimeMinutes: 0,
          leaveDays: new Prisma.Decimal(0),
        },
      ] as any);
      prisma.attendanceMonthly.upsert.mockResolvedValue({} as any);

      await service.generate({ month: '2026-09', userId: 9 });

      expect(prisma.attendanceMonthly.upsert.mock.calls[0][0].create.leaveMinutes).toBe(0);
    });
  });

  // 数据范围兜底：账号既无全量权限、又无部门范围、又未绑定员工时，
  // 不得静默放行为任意员工的月报确认/取消确认（横向越权）。
  describe('confirm / unconfirm - 无任何数据范围时拒绝', () => {
    let service: AttendanceMonthlyService;
    let prisma: ReturnType<typeof createMockPrisma>;
    let dataScope: { visibleScope: jest.Mock };

    beforeEach(() => {
      prisma = createMockPrisma();
      dataScope = createMockDataScope();
      service = new AttendanceMonthlyService(
        prisma as any,
        dataScope as any,
        createMockEventEmitter() as any,
        createMockLockService() as any,
      );
      prisma.attendanceMonthly.findUnique.mockResolvedValue({
        id: 7,
        employeeId: 99,
        month: '2026-09',
        status: 'draft',
      });
    });

    it('confirm：无任何可见范围时抛 403，且不写库', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [] });

      await expect(service.confirm(7, 9)).rejects.toMatchObject({ status: 403 });

      expect(prisma.attendanceMonthly.updateMany).not.toHaveBeenCalled();
    });

    it('unconfirm：无任何可见范围时抛 403，且不写库', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [] });

      await expect(service.unconfirm(7, 9)).rejects.toMatchObject({ status: 403 });

      expect(prisma.attendanceMonthly.updateMany).not.toHaveBeenCalled();
    });

    it('confirm：本人月报（selfEmployeeId 命中）仍可确认', async () => {
      dataScope.visibleScope.mockResolvedValue({
        all: false,
        ids: [],
        selfEmployeeId: 99,
      });
      prisma.attendanceMonthly.updateMany.mockResolvedValue({ count: 1 });
      prisma.attendanceMonthly.findMany.mockResolvedValue([]);

      await service.confirm(7, 9);

      expect(prisma.attendanceMonthly.updateMany).toHaveBeenCalled();
    });
  });
});