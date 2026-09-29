/**
 * 以 UTC（=生产容器时区）运行。
 *
 * 开发机是 GMT+8，`new Date()+setHours(0,0,0,0)` 与 `new Date('YYYY-MM-DD')`
 * 在 GMT+8 上「碰巧」接近北京口径，只有非北京时区才能暴露偏移。
 *
 * @jest-environment ./jest-utc-environment
 */
import * as ExcelJS from 'exceljs';
import { OperationLogService } from './operation-log.service';

function createMockPrisma() {
  return {
    operationLog: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    user: { findMany: jest.fn() },
    employee: { findMany: jest.fn() },
    department: { findMany: jest.fn() },
  } as any;
}

describe('OperationLogService — 日期口径按北京时间（生产容器 TZ=UTC）', () => {
  let service: OperationLogService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new OperationLogService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  /**
   * 北京时间 2026-10-01 01:30 = UTC 2026-09-30 17:30。
   *
   * `createdAt` 是**真实时刻**列，「今日」起点必须是北京时间当天 00:00，
   * 即 UTC 2026-09-30T16:00:00Z。
   *
   * 旧断言写成业务日 UTC 午夜 2026-10-01T00:00:00Z（= 北京 08:00），
   * 会把北京当天 00:00~08:00 的操作日志整段漏掉（业务日口径只适用于 @db.Date 列）。
   */
  it('getStats 的「今日」起点 = 北京当日 00:00（真实时刻列，非业务日 UTC 午夜）', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-09-30T17:30:00.000Z'));

    prisma.operationLog.count.mockResolvedValue(0);
    prisma.operationLog.groupBy.mockResolvedValue([]);

    await service.getStats();

    const todayWhere = prisma.operationLog.count.mock.calls[1][0];
    expect(todayWhere.where.createdAt.gte.toISOString()).toBe('2026-09-30T16:00:00.000Z');
  });

  it('listLogs 的日期范围 = 北京日历日左闭右开区间', async () => {
    prisma.operationLog.findMany.mockResolvedValue([]);
    prisma.operationLog.count.mockResolvedValue(0);

    await service.listLogs({
      page: 1,
      pageSize: 20,
      startDate: '2026-09-30',
      endDate: '2026-09-30',
    });

    const where = prisma.operationLog.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe('2026-09-29T16:00:00.000Z');
    expect(where.createdAt.lt.toISOString()).toBe('2026-09-30T16:00:00.000Z');
  });

  it('exportExcel 的「操作时间」按北京时间输出，且不再出现 UTC 串', async () => {
    prisma.operationLog.count.mockResolvedValue(1);
    prisma.operationLog.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 9,
        username: 'admin',
        module: 'auth',
        action: 'login',
        method: 'POST',
        url: '/auth/login',
        ip: '10.0.0.1',
        status: 'success',
        createdAt: new Date('2026-09-28T10:36:44.000Z'),
      },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 9, realName: '管理员', username: 'admin' }]);
    prisma.employee.findMany.mockResolvedValue([{ userId: 9, departmentId: 3 }]);
    prisma.department.findMany.mockResolvedValue([{ id: 3, name: '技术部' }]);

    const buffer = await service.exportExcel({});

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const row = workbook.worksheets[0].getRow(2);
    expect(row.getCell(1).value).toBe('2026-09-28 18:36:44');
  });
});
