import { AttendanceMonthlyService } from './attendance-monthly.service';

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
});