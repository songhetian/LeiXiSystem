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
