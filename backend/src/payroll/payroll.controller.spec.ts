import { PayrollController } from './payroll.controller';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';

// 捕获异常 payload：全局过滤器会用 ERROR_MESSAGES[code] 覆盖抛出 message
async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('预期抛出异常，但未抛出');
}

// core-contracts §2：所有 zod 校验失败统一用 PARAM_INVALID(4000)。
// 旧实现在 confirm 中把 zod 失败写成 3008（PAYROLL_CHECK_INSUFFICIENT），
// 经全局过滤器覆盖后，任何提交体类型/必填错误都会被显示成
// 「确认前必须抽检至少3名员工对账」——与真实原因无关。
describe('PayrollController - confirm 参数校验须用统一校验码', () => {
  let controller: PayrollController;
  let payrollService: { confirmRun: jest.Mock };

  beforeEach(() => {
    payrollService = { confirmRun: jest.fn() };
    controller = new PayrollController(payrollService as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('提交体类型错误（非数组）时使用 PARAM_INVALID(4000)，不得复用 3008', async () => {
    const payload = await catchPayload(() =>
      controller.confirm(1, { checkedEmployeeIds: '1,2,3' } as any, { user: { id: 9 } }),
    );

    expect(payload.code).toBe(ERROR_CODES.PARAM_INVALID);
    expect(messageOf(payload.code)).toBe('参数校验失败');
    expect(payrollService.confirmRun).not.toHaveBeenCalled();
  });

  it('缺少 checkedEmployeeIds 时同样使用 PARAM_INVALID(4000)', async () => {
    const payload = await catchPayload(() =>
      controller.confirm(1, {} as any, { user: { id: 9 } }),
    );

    expect(payload.code).toBe(ERROR_CODES.PARAM_INVALID);
    expect(payrollService.confirmRun).not.toHaveBeenCalled();
  });

  it('合法提交体透传给 service（回归保护）', async () => {
    payrollService.confirmRun.mockResolvedValue({ ok: true });

    const result = await controller.confirm(1, { checkedEmployeeIds: [1, 2, 3] }, { user: { id: 9 } });

    expect(payrollService.confirmRun).toHaveBeenCalledWith(1, 9, [1, 2, 3]);
    expect(result).toEqual({ code: 0, data: { ok: true } });
  });
});

// B3 / B2：列表接口的信封与查询参数透传
describe('PayrollController - 列表接口信封与筛选透传', () => {
  let controller: PayrollController;
  let payrollService: { listSalaryItems: jest.Mock; listRuns: jest.Mock };

  beforeEach(() => {
    payrollService = { listSalaryItems: jest.fn(), listRuns: jest.fn() };
    controller = new PayrollController(payrollService as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('GET payroll/items 返回统一分页信封 { list, total, page, pageSize }，并透传 status/page', async () => {
    const envelope = { list: [{ id: 1, code: 'base' }], total: 1, page: 1, pageSize: 20 };
    payrollService.listSalaryItems.mockResolvedValue(envelope);

    const result = await controller.listItems('1', '20', 'active');

    expect(payrollService.listSalaryItems).toHaveBeenCalledWith({ page: 1, pageSize: 20, status: 'active' });
    // 前端 RunDetailsModal 读 data.list，裸数组会让调整项入口恒为空
    expect(result).toEqual({ code: 0, data: envelope });
  });

  it('GET payroll/runs 透传 month/status（B2：此前只接收 page/pageSize，筛选被丢弃）', async () => {
    const envelope = { list: [], total: 0, page: 1, pageSize: 20 };
    payrollService.listRuns.mockResolvedValue(envelope);

    const result = await controller.listRuns('1', '20', '2025-09', 'draft', { user: { id: 9 } } as any);

    expect(payrollService.listRuns).toHaveBeenCalledWith({
      userId: 9,
      page: 1,
      pageSize: 20,
      month: '2025-09',
      status: 'draft',
    });
    expect(result).toEqual({ code: 0, data: envelope });
  });
});
