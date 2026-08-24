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
    employee: {
      findMany: jest.fn(),
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

describe('SchedulesService.matrix（部门×月份矩阵）', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = {
    visibleScope: jest.fn(),
  } as unknown as { visibleScope: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new SchedulesService(prisma, dataScope as unknown as DataScopeService);
    dataScope.visibleScope.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  const employees = [
    { id: 1, employeeNo: 'E001', name: '张三', departmentId: 2 },
    { id: 2, employeeNo: 'E002', name: '李四', departmentId: 2 },
  ];

  it('管理员可查看指定部门活跃员工的排班矩阵', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
    prisma.employee.findMany.mockResolvedValue(employees);
    const rows = [
      { id: 11, employeeId: 1, workDate: new Date('2026-08-05'), shift: { id: 3, name: '早班' } },
    ];
    prisma.schedule.findMany.mockResolvedValue(rows);

    const result = await service.matrix(9, { departmentId: 2, startDate: '2026-08-01', endDate: '2026-08-31' });

    // 员工按部门过滤且仅在职
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ departmentId: 2, status: 'active' }),
      }),
    );
    // 排班按员工集合 + 日期范围过滤，携带班次
    const scheduleWhere = prisma.schedule.findMany.mock.calls[0][0].where;
    expect(scheduleWhere.employeeId).toEqual({ in: [1, 2] });
    expect(scheduleWhere.workDate.gte).toEqual(new Date('2026-08-01'));
    expect(scheduleWhere.workDate.lte).toEqual(new Date('2026-08-31'));
    expect(prisma.schedule.findMany.mock.calls[0][0].include).toEqual({ shift: true });
    expect(result.employees).toEqual(employees);
    expect(result.schedules).toEqual(rows);
  });

  it('非管理员仅可查看其负责部门（非所属部门被拒绝）', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [3] });
    // 无权部门应抛 Forbidden，不应查询员工
    await expect(
      service.matrix(9, { departmentId: 2, startDate: '2026-08-01', endDate: '2026-08-31' }),
    ).rejects.toThrow('无权查看该部门排班');
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('部门无员工时不查询排班', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [] });
    prisma.employee.findMany.mockResolvedValue([]);

    const result = await service.matrix(9, { departmentId: 5, startDate: '2026-08-01', endDate: '2026-08-31' });

    expect(prisma.schedule.findMany).not.toHaveBeenCalled();
    expect(result.employees).toEqual([]);
    expect(result.schedules).toEqual([]);
  });
});