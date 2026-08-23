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
});
