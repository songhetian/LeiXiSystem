import { PunchSyncService } from './punch-sync.service';

/** 同步按设备加锁；测试里直接放行 */
function createMockLock() {
  return { withLock: jest.fn(async (_key: string, _ttl: number, fn: () => Promise<unknown>) => fn()) };
}

// 「在职」口径：正式 + 试用期。设备同步若只认正式员工，试用期员工的打卡会被整体丢弃。
function createMockPrisma() {
  const prisma: any = {
    punchDevice: { findMany: jest.fn().mockResolvedValue([]) },
    punchSyncState: { findUnique: jest.fn(), upsert: jest.fn().mockResolvedValue({}) },
    employee: { findMany: jest.fn().mockResolvedValue([]) },
    punchLog: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
}

describe('PunchSyncService 在职口径', () => {
  let service: PunchSyncService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PunchSyncService(prisma, createMockLock() as never);
  });

  afterEach(() => jest.clearAllMocks());

  it('设备打卡的有效工号校验必须包含试用期员工', async () => {
    prisma.employee.findMany.mockResolvedValue([{ employeeNo: 'E001' }]);
    jest
      .spyOn(service, 'fetchFromDevice')
      .mockResolvedValue({ ret: 0, rows: [{ emp_code: 'E001', punch_time: '2026-09-01 09:00:00' }] });

    await service.syncNow();

    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['active', 'probation'] } }),
      }),
    );
  });

  it('不在花名册中的工号仍被丢弃', async () => {
    prisma.employee.findMany.mockResolvedValue([{ employeeNo: 'E001' }]);
    jest
      .spyOn(service, 'fetchFromDevice')
      .mockResolvedValue({
        ret: 0,
        rows: [
          { emp_code: 'E001', punch_time: '2026-09-01 09:00:00' },
          { emp_code: 'UNKNOWN', punch_time: '2026-09-01 09:05:00' },
        ],
      });

    const result = await service.syncNow();

    expect(result.newCount).toBe(1);
    // 落库改为 createMany + skipDuplicates（由唯一约束去重），只保留花名册内的工号
    expect(prisma.punchLog.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.punchLog.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: [expect.objectContaining({ employeeNo: 'E001' })],
      }),
    );
  });
});