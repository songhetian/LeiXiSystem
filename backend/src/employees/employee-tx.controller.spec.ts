// 三个自助入口在「账号未绑定员工档案」时抛错，此前分别复用了离职申请(9101)、
// 申诉(9404)、调岗调薪(9801) 的码，全局过滤器会用中央文案把「员工档案不存在」
// 覆盖成「离职申请不存在」「调岗调薪记录不存在」等完全不相干的实体名。
import { EmployeeTxController } from './employee-tx.controller';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';

function createController() {
  const txService = { getEmployeeByUserId: jest.fn() };
  const employeesService = {};
  const controller = new EmployeeTxController(txService as any, employeesService as any);
  return { controller, txService };
}

async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('预期抛出异常，但未抛出');
}

describe('EmployeeTxController — 员工档案缺失时的错误码语义', () => {
  const req = { user: { id: 7 } } as any;

  it('发起离职申请：档案缺失必须提示「员工不存在」，不得复用 9101（离职申请不存在）', async () => {
    const { controller, txService } = createController();
    txService.getEmployeeByUserId.mockResolvedValue(null);

    const payload = await catchPayload(() => controller.createMyResignation({}, req));

    expect(payload.code).toBe(ERROR_CODES.EMPLOYEE_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('员工不存在');
  });

  it('发起申诉：档案缺失必须提示「员工不存在」，不得留裸码 9404', async () => {
    const { controller, txService } = createController();
    txService.getEmployeeByUserId.mockResolvedValue(null);

    const payload = await catchPayload(() => controller.createMyAppeal({}, req));

    expect(payload.code).toBe(ERROR_CODES.EMPLOYEE_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('员工不存在');
  });

  it('发起证明申请：档案缺失必须提示「员工不存在」，不得复用 9801（调岗调薪记录不存在）', async () => {
    const { controller, txService } = createController();
    txService.getEmployeeByUserId.mockResolvedValue(null);

    const payload = await catchPayload(() => controller.createMyCertRequest({}, req));

    expect(payload.code).toBe(ERROR_CODES.EMPLOYEE_NOT_FOUND);
    expect(messageOf(payload.code)).toBe('员工不存在');
  });
});
