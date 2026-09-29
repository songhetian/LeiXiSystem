import { ReportsController } from './reports.controller';

/**
 * 员工列表导出文件名测试。
 *
 * 原实现用 `new Date().toISOString().slice(0, 10)` 取日期，那是 UTC 日期：
 * 生产容器 TZ=UTC，北京时间 00:00~08:00 期间导出，文件名会退回【昨天】，
 * 与用户在北京时间看到的导出日期不一致。
 */
describe('ReportsController · 导出文件名', () => {
  // 北京时间 2026-10-01 01:00（= UTC 2026-09-30 17:00）
  const BEIJING_CROSS_DAY = new Date('2026-09-30T17:00:00.000Z');

  function buildController() {
    const reportsService = {
      exportEmployeeListXlsx: jest.fn().mockResolvedValue(Buffer.from('x')),
      exportEmployeeListCsv: jest.fn().mockResolvedValue('csv'),
    };
    return {
      controller: new ReportsController(reportsService as any),
      reportsService,
    };
  }

  function buildRes() {
    return { header: jest.fn(), send: jest.fn() };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('xlsx 文件名应使用北京时间的当天日期', async () => {
    jest.useFakeTimers().setSystemTime(BEIJING_CROSS_DAY);
    const { controller } = buildController();
    const res = buildRes();

    await controller.exportEmployeeList('xlsx', { user: { id: 1 } }, res);

    expect(res.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="employee-list-2026-10-01.xlsx"',
    );
  });

  it('csv 文件名应使用北京时间的当天日期', async () => {
    jest.useFakeTimers().setSystemTime(BEIJING_CROSS_DAY);
    const { controller } = buildController();
    const res = buildRes();

    await controller.exportEmployeeList('csv', { user: { id: 1 } }, res);

    expect(res.header).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="employee-list-2026-10-01.csv"',
    );
  });
});
