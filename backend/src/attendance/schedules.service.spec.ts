import { SchedulesService } from './schedules.service';
import { DataScopeService } from '../common/data-scope.service';

function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
    },
    schedule: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  } as any;
}

describe('SchedulesService.mySchedule', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const dataScope = {} as DataScopeService;
    service = new SchedulesService(prisma, dataScope);
  });

  afterEach(() => jest.clearAllMocks());

  it('用户未绑定员工时返回空列表，不查询 schedule', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 10, employees: [] });

    const result = await service.mySchedule(10, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      page: 1,
      pageSize: 200,
    });

    expect(result.list).toEqual([]);
    expect(result.total).toBe(0);
    expect(prisma.schedule.findMany).not.toHaveBeenCalled();
  });

  it('只查询当前登录用户本人绑定员工的排班（含班次），并按日期范围过滤', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 10, employees: [{ id: 7 }] });
    const rows = [{ id: 1, employeeId: 7, workDate: new Date('2026-08-05'), shift: { id: 3, name: '早班' } }];
    prisma.schedule.findMany.mockResolvedValue(rows);
    prisma.schedule.count.mockResolvedValue(1);

    const result = await service.mySchedule(10, {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      page: 1,
      pageSize: 200,
    });

    const whereArg = prisma.schedule.findMany.mock.calls[0][0].where;
    expect(whereArg.employeeId).toBe(7);
    expect(whereArg.workDate.gte).toEqual(new Date('2026-08-01'));
    expect(whereArg.workDate.lte).toEqual(new Date('2026-08-31'));
    // 该查询携带班次信息
    expect(prisma.schedule.findMany.mock.calls[0][0].include).toEqual({ shift: true });
    expect(result.list).toBe(rows);
    expect(result.total).toBe(1);
  });

  it('未提供日期范围时不构造 workDate 过滤条件', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 10, employees: [{ id: 7 }] });
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.count.mockResolvedValue(0);

    await service.mySchedule(10, { page: 1, pageSize: 200 });

    const whereArg = prisma.schedule.findMany.mock.calls[0][0].where;
    expect(whereArg.employeeId).toBe(7);
    expect(whereArg.workDate).toBeUndefined();
  });
});