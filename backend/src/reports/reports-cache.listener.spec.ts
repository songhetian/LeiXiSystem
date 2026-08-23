import { ReportsCacheListener } from './reports-cache.listener';
import { EVENT_PAYROLL_STATUS_CHANGED } from '../common/events';

/**
 * 薪资报表缓存失效链路（原缺口）：
 * 算薪批次状态变更（确认/发布/撤回）后，人力成本报表缓存必须被清除，
 * 否则确认后最多 5 分钟读到旧数据。
 * Seam：@OnEvent(EVENT_PAYROLL_STATUS_CHANGED) → clearReportCache('report:labor-cost:*')
 */
describe('ReportsCacheListener - 薪资报表缓存失效', () => {
  let listener: ReportsCacheListener;
  let reportsService: { clearReportCache: jest.Mock };

  beforeEach(() => {
    reportsService = {
      clearReportCache: jest.fn().mockResolvedValue(undefined),
    };
    listener = new ReportsCacheListener(reportsService as any);
    jest.clearAllMocks();
  });

  it('算薪批次确认后清除人力成本报表缓存', async () => {
    await listener.handlePayrollStatusChanged({
      runId: 1,
      month: '2026-08',
      from: 'draft',
      to: 'confirmed',
    });

    expect(reportsService.clearReportCache).toHaveBeenCalledWith('report:labor-cost:*');
  });

  it('算薪批次发布后清除人力成本报表缓存', async () => {
    await listener.handlePayrollStatusChanged({
      runId: 1,
      month: '2026-08',
      from: 'confirmed',
      to: 'published',
    });

    expect(reportsService.clearReportCache).toHaveBeenCalledWith('report:labor-cost:*');
  });

  it('算薪批次撤回后清除人力成本报表缓存', async () => {
    await listener.handlePayrollStatusChanged({
      runId: 1,
      month: '2026-08',
      from: 'published',
      to: 'recalled',
    });

    expect(reportsService.clearReportCache).toHaveBeenCalledWith('report:labor-cost:*');
  });

  it('处理器绑定的正是共享事件常量，避免两写字面量不匹配', () => {
    // 校验 @OnEvent 元数据引用了共享常量，验证「接线」本身存在
    const handler = ReportsCacheListener.prototype.handlePayrollStatusChanged;
    const boundEvent = Reflect.getMetadata('EVENT_LISTENER_METADATA', handler);
    expect(boundEvent).toBeDefined();
    expect(JSON.stringify(boundEvent)).toContain(EVENT_PAYROLL_STATUS_CHANGED);
  });
});