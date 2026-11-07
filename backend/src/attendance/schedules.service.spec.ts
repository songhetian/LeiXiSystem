import { SchedulesService } from './schedules.service';
import { AttendanceDailyService } from './attendance-daily.service';
import { DataScopeService } from '../common/data-scope.service';
import { messageOf } from '../common/error-messages';
import { ERROR_CODES } from '../common/error-codes';

/** 排班变更后的日报重算依赖 AttendanceDailyService，测试里只关心「有没有被调、怎么调」 */
function createMockDaily(): AttendanceDailyService {
  return { recalculate: jest.fn().mockResolvedValue({ count: 1 }) } as unknown as AttendanceDailyService;
}

function createMockPrisma() {
  const prisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    schedule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
    },
  };
  // 事务内操作直接落到同一个 mock 上，便于断言「一共查了几次」
  prisma.$transaction = jest.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma));
  return prisma;
}

describe('SchedulesService.mySchedule', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const dataScope = {} as DataScopeService;
    service = new SchedulesService(prisma, dataScope, createMockDaily());
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
    service = new SchedulesService(prisma, dataScope as unknown as DataScopeService, createMockDaily());
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

    // 员工按部门过滤且仅在职（在职 = 正式 + 试用期，否则试用期员工排不了班也就无法打卡）
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ departmentId: 2, status: { in: ['active', 'probation'] } }),
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

// 捕获异常 payload：全局过滤器会用 ERROR_MESSAGES[code] 覆盖抛出 message
async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('预期抛出异常，但未抛出');
}

describe('SchedulesService - 错误码语义（排班不存在不得复用 2002 排班重复）', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = { visibleScope: jest.fn() } as unknown as { visibleScope: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new SchedulesService(prisma, dataScope as unknown as DataScopeService, createMockDaily());
    dataScope.visibleScope.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('编辑时排班不存在：中央文案为「排班不存在」', async () => {
    prisma.schedule.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.update(999, { shiftId: 1 }, 9));

    expect(payload.code).not.toBe(2002);
    expect(messageOf(payload.code)).toBe('排班不存在');
  });

  it('删除时排班不存在：中央文案为「排班不存在」', async () => {
    prisma.schedule.findUnique.mockResolvedValue(null);

    const payload = await catchPayload(() => service.remove(999, 9));

    expect(payload.code).not.toBe(2002);
    expect(messageOf(payload.code)).toBe('排班不存在');
  });

  it('引用的员工/班次不存在：不得复用 1002（中央文案会覆盖成「员工不存在」，班次不存在时提示误导）', async () => {
    prisma.schedule.findUnique.mockResolvedValue({ id: 1, employeeId: 5, shiftId: 1 });
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
    prisma.schedule.update.mockRejectedValue({ code: 'P2003' });

    const payload = await catchPayload(() => service.update(1, { shiftId: 999 }, 9));

    expect(payload.code).not.toBe(1002);
    expect(payload.code).toBe(2019);
    expect(messageOf(payload.code)).toBe('员工或班次不存在');
  });
});

describe('SchedulesService — 批量操作不得产生 N+1 查询', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  const dataScope = { visibleScope: jest.fn() } as unknown as { visibleScope: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new SchedulesService(prisma, dataScope as unknown as DataScopeService, createMockDaily());
    dataScope.visibleScope.mockReset();
  });

  afterEach(() => jest.clearAllMocks());

  it('批量排班对 N 条只做一次员工范围查询，不再逐条查库', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [2], selfEmployeeId: null });
    prisma.employee.findMany.mockResolvedValue([
      { id: 1, departmentId: 2 },
      { id: 2, departmentId: 2 },
    ]);
    prisma.schedule.upsert.mockResolvedValue({});

    await service.batch(
      [
        { employeeId: 1, shiftId: 3, workDate: '2026-08-01' },
        { employeeId: 2, shiftId: 3, workDate: '2026-08-01' },
      ],
      9,
    );

    expect(dataScope.visibleScope).toHaveBeenCalledTimes(1);
    expect(prisma.employee.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.employee.findMany.mock.calls[0][0].where).toEqual({ id: { in: [1, 2] } });
  });

  it('批量排班里有不在负责部门的员工时整体拒绝，且不写任何排班', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [2], selfEmployeeId: null });
    prisma.employee.findMany.mockResolvedValue([
      { id: 1, departmentId: 2 },
      { id: 2, departmentId: 5 },
    ]);

    const payload = await catchPayload(() =>
      service.batch(
        [
          { employeeId: 1, shiftId: 3, workDate: '2026-08-01' },
          { employeeId: 2, shiftId: 3, workDate: '2026-08-01' },
        ],
        9,
      ),
    );

    expect(payload.code).toBe(5003);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('批量清除：一次查存在性 + 一次 deleteMany，不逐条 delete', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
    prisma.schedule.findMany.mockResolvedValue([
      { id: 11, employeeId: 1, workDate: new Date('2026-08-01') },
      { id: 12, employeeId: 2, workDate: new Date('2026-08-01') },
    ]);
    prisma.schedule.deleteMany.mockResolvedValue({ count: 2 });

    const result = await service.batchRemove([11, 12], 9);

    expect(result).toEqual({ count: 2 });
    expect(prisma.schedule.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.schedule.findMany.mock.calls[0][0].where).toEqual({ id: { in: [11, 12] } });
    expect(prisma.schedule.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.schedule.delete).not.toHaveBeenCalled();
  });

  it('批量清除里有不存在的排班时整体报「排班不存在」，不删除任何记录', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
    prisma.schedule.findMany.mockResolvedValue([{ id: 11, employeeId: 1 }]);

    const payload = await catchPayload(() => service.batchRemove([11, 99], 9));

    expect(payload.code).toBe(ERROR_CODES.SCHEDULE_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('排班不存在');
    expect(prisma.schedule.deleteMany).not.toHaveBeenCalled();
  });

  it('批量清除越权员工排班时整体拒绝，且不删除', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [2], selfEmployeeId: null });
    prisma.schedule.findMany.mockResolvedValue([{ id: 11, employeeId: 1 }]);
    prisma.employee.findMany.mockResolvedValue([{ id: 1, departmentId: 5 }]);

    const payload = await catchPayload(() => service.batchRemove([11], 9));

    expect(payload.code).toBe(5003);
    expect(prisma.schedule.deleteMany).not.toHaveBeenCalled();
  });
});
describe('SchedulesService — 排班变更后重算受影响日报', () => {
  let service: SchedulesService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let daily: ReturnType<typeof createMockDaily>;
  const dataScope = { visibleScope: jest.fn() } as unknown as { visibleScope: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrisma();
    daily = createMockDaily();
    service = new SchedulesService(prisma, dataScope as unknown as DataScopeService, daily);
    dataScope.visibleScope.mockReset();
    dataScope.visibleScope.mockResolvedValue({ all: true, ids: [], selfEmployeeId: null });
  });

  afterEach(() => jest.clearAllMocks());

  it('创建过去的排班后，重算该员工该日的日报', async () => {
    prisma.schedule.upsert.mockResolvedValue({ id: 1 });

    await service.create({ employeeId: 7, shiftId: 3, workDate: '2026-08-01' }, 9);

    expect(daily.recalculate).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 7, startDate: '2026-08-01', endDate: '2026-08-01' }),
    );
  });

  it('今天与未来的排班不触发重算（当天口径由打卡路径决定，次日定时重算兜底）', async () => {
    prisma.schedule.upsert.mockResolvedValue({ id: 1 });

    await service.create({ employeeId: 7, shiftId: 3, workDate: '2099-01-01' }, 9);

    expect(daily.recalculate).not.toHaveBeenCalled();
  });

  it('编辑挪动日期时，新旧两个日期都会重算', async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: 1,
      employeeId: 7,
      workDate: new Date('2026-08-01'),
    });
    prisma.schedule.update.mockResolvedValue({ id: 1, workDate: new Date('2026-08-02') });

    await service.update(1, { workDate: '2026-08-02' }, 9);

    const dates = (daily.recalculate as jest.Mock).mock.calls
      .map((c: any[]) => c[0].startDate as string)
      .sort();
    expect(dates).toEqual(['2026-08-01', '2026-08-02']);
  });

  it('删除排班后，所在日期重算', async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: 1,
      employeeId: 7,
      workDate: new Date('2026-08-01'),
    });
    prisma.schedule.delete.mockResolvedValue({});

    await service.remove(1, 9);

    expect(daily.recalculate).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 7, startDate: '2026-08-01', endDate: '2026-08-01' }),
    );
  });

  it('重算失败（如该月月报已确认）不影响排班写入本身', async () => {
    (daily.recalculate as jest.Mock).mockRejectedValue(new Error('该月已确认，不允许重算'));
    prisma.schedule.upsert.mockResolvedValue({ id: 1 });

    const saved = await service.create({ employeeId: 7, shiftId: 3, workDate: '2026-08-01' }, 9);

    expect(saved).toEqual({ id: 1 });
    expect(daily.recalculate).toHaveBeenCalledTimes(1);
  });

  it('批量排班后按 (员工, 日期) 去重重算，不重复调用', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 7, departmentId: 2 }]);
    prisma.schedule.upsert.mockResolvedValue({ id: 1 });

    await service.batch(
      [
        { employeeId: 7, shiftId: 3, workDate: '2026-08-01' },
        { employeeId: 7, shiftId: 4, workDate: '2026-08-01' },
      ],
      9,
    );

    expect(daily.recalculate).toHaveBeenCalledTimes(1);
  });
});
