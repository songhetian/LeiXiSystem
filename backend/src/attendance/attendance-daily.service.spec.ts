import { AttendanceDailyService } from './attendance-daily.service';

function createMockPrisma() {
  return {
    schedule: {
      findMany: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    leaveRecord: {
      findMany: jest.fn(),
    },
    punchLog: {
      findMany: jest.fn(),
    },
    punchMakeup: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    attendanceDaily: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    shift: {
      findUnique: jest.fn(),
    },
  };
}

function createMockDataScope() {
  return { visibleScope: jest.fn().mockResolvedValue({ all: true }) };
}

function createMockMonthlyService() {
  return {
    checkDateRangeHasConfirmedMonthly: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AttendanceDailyService', () => {
  describe('recalculate - 唯一约束 upsert', () => {
    let service: AttendanceDailyService;
    let prisma: ReturnType<typeof createMockPrisma>;

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const monthlyService = createMockMonthlyService();
      service = new AttendanceDailyService(prisma as any, dataScope as any, monthlyService as any);
    });

    it('使用 upsert 而非 create，依赖 (employeeId, workDate) 唯一约束', async () => {
      prisma.schedule.findMany.mockResolvedValue([
        {
          id: 1,
          employeeId: 1,
          shiftId: 1,
          workDate: new Date('2025-06-01'),
          employee: { id: 1, employeeNo: 'EMP0001' },
          shift: {
            id: 1,
            startTime: '09:00',
            endTime: '18:00',
            isNextDay: false,
          },
        },
      ]);

      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.punchLog.findMany.mockResolvedValue([]);
      prisma.attendanceDaily.upsert.mockResolvedValue({ id: 1 });

      await service.recalculate({
        startDate: '2025-06-01',
        endDate: '2025-06-01',
        userId: 1,
      });

      expect(prisma.attendanceDaily.upsert).toHaveBeenCalled();
      const upsertCall = prisma.attendanceDaily.upsert.mock.calls[0][0];
      expect(upsertCall.where).toEqual({
        employeeId_workDate: {
          employeeId: 1,
          workDate: new Date('2025-06-01'),
        },
      });
    });

    it('同一员工同一天重复计算不会产生重复记录（upsert 语义）', async () => {
      prisma.schedule.findMany.mockResolvedValue([
        {
          id: 1,
          employeeId: 1,
          shiftId: 1,
          workDate: new Date('2025-06-01'),
          employee: { id: 1, employeeNo: 'EMP0001' },
          shift: {
            id: 1,
            startTime: '09:00',
            endTime: '18:00',
            isNextDay: false,
          },
        },
      ]);

      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.punchLog.findMany.mockResolvedValue([]);
      prisma.attendanceDaily.upsert.mockResolvedValue({ id: 1 });

      await service.recalculate({
        startDate: '2025-06-01',
        endDate: '2025-06-01',
        userId: 1,
      });
      await service.recalculate({
        startDate: '2025-06-01',
        endDate: '2025-06-01',
        userId: 1,
      });

      expect(prisma.attendanceDaily.upsert).toHaveBeenCalledTimes(2);
      const where1 = prisma.attendanceDaily.upsert.mock.calls[0][0].where;
      const where2 = prisma.attendanceDaily.upsert.mock.calls[1][0].where;
      expect(where1).toEqual(where2);
    });
  });

  describe('recalculate - 已通过补卡须参与状态归并', () => {
    let service: AttendanceDailyService;
    let prisma: ReturnType<typeof createMockPrisma>;

    const schedule = {
      id: 1,
      employeeId: 1,
      shiftId: 1,
      workDate: new Date('2025-06-02'),
      employee: { id: 1, employeeNo: 'EMP0001' },
      shift: { id: 1, startTime: '09:00', endTime: '18:00', isNextDay: false },
    };

    beforeEach(() => {
      prisma = createMockPrisma();
      const dataScope = createMockDataScope();
      const monthlyService = createMockMonthlyService();
      service = new AttendanceDailyService(prisma as any, dataScope as any, monthlyService as any);
      prisma.schedule.findMany.mockResolvedValue([schedule]);
      prisma.leaveRecord.findMany.mockResolvedValue([]);
      prisma.attendanceDaily.upsert.mockResolvedValue({ id: 1 });
    });

    it('当日存在已通过补卡时，重算结果须标记为 makeup，不得被无补卡口径覆盖', async () => {
      // 北京时间 09:16 的一次真实打卡 → 引擎判定迟到 16 分钟
      prisma.punchLog.findMany.mockResolvedValue([
        { employeeNo: 'EMP0001', punchTime: new Date('2025-06-02T01:16:00.000Z') },
      ]);
      prisma.punchMakeup.findMany.mockResolvedValue([
        {
          employeeId: 1,
          punchDate: new Date('2025-06-02'),
          status: 'approved',
          makeupTime: new Date('2025-06-02T10:00:00.000Z'),
        },
      ]);

      await service.recalculate({ startDate: '2025-06-02', endDate: '2025-06-02', userId: 1 });

      const upsertCall = prisma.attendanceDaily.upsert.mock.calls[0][0];
      // 未接入补卡时，mergeLeaveMakeupIntoDaily 收到的是硬编码 []，状态会被覆盖成 late
      expect(upsertCall.update.status).toBe('makeup');
    });

    it('其他员工的补卡不得串到本员工日报上', async () => {
      prisma.punchLog.findMany.mockResolvedValue([]);
      prisma.punchMakeup.findMany.mockResolvedValue([
        {
          employeeId: 999,
          punchDate: new Date('2025-06-02'),
          status: 'approved',
          makeupTime: new Date('2025-06-02T10:00:00.000Z'),
        },
      ]);

      await service.recalculate({ startDate: '2025-06-02', endDate: '2025-06-02', userId: 1 });

      expect(prisma.attendanceDaily.upsert.mock.calls[0][0].update.status).toBe('absent');
    });
  });

  describe('list - 部门维度过滤（报表按部门导出）', () => {
    let service: AttendanceDailyService;
    let prisma: ReturnType<typeof createMockPrisma>;
    let dataScope: { visibleScope: jest.Mock };

    beforeEach(() => {
      prisma = createMockPrisma();
      dataScope = { visibleScope: jest.fn() };
      const monthlyService = createMockMonthlyService();
      service = new AttendanceDailyService(prisma as any, dataScope as any, monthlyService as any);
      prisma.attendanceDaily.findMany.mockResolvedValue([]);
      prisma.attendanceDaily.count.mockResolvedValue(0);
    });

    it('管理员传入 departmentId 时按部门过滤日报', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });

      await service.list({
        departmentId: 5,
        userId: 9,
        page: 1,
        pageSize: 20,
      });

      const where = prisma.attendanceDaily.findMany.mock.calls[0][0].where;
      expect(where.employee.departmentId).toBe(5);
    });

    it('部门受限时，日报过滤为其可见部门与查询部门的交集（不越权）', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: false, ids: [1, 2] });

      await service.list({
        departmentId: 3,
        userId: 9,
        page: 1,
        pageSize: 20,
      });

      const where = prisma.attendanceDaily.findMany.mock.calls[0][0].where;
      // 同时满足“仅可见部门”与“指定部门”，交集后必然空，但不应泄露越权数据
      expect(where.employee.departmentId).toEqual({ in: [1, 2] });
      expect(where.AND[0].employee.departmentId).toBe(3);
    });

    it('未传 departmentId 时不追加部门过滤', async () => {
      dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });

      await service.list({ userId: 9, page: 1, pageSize: 20 });

      const where = prisma.attendanceDaily.findMany.mock.calls[0][0].where;
      expect(where.employee).toBeUndefined();
    });
  });
});
