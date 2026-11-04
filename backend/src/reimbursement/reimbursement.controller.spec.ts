// RBAC 强制标准（REFACTOR_PLAN 11.6-3）：管理写端点必须有非 view 权限点守卫。
// 这里断言装饰器元数据绑定正确——PermissionGuard 以该元数据为唯一判定输入，
// 403/放行行为本身由 permission.guard.spec.ts 覆盖。
import { Reflector } from '@nestjs/core';
import { ReimbursementController } from './reimbursement.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof ReimbursementController): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, ReimbursementController.prototype[method]);

describe('ReimbursementController — 端点权限矩阵', () => {
  it('写端点 create/submit/cancel/remove 挂 reimbursement:create（此前只挂 view，可越权直调）', () => {
    expect(permOf('create')).toBe('reimbursement:create');
    expect(permOf('submit')).toBe('reimbursement:create');
    expect(permOf('cancel')).toBe('reimbursement:create');
    expect(permOf('remove')).toBe('reimbursement:create');
  });

  it('审批决策端点 approveForApprover/rejectForApprover 挂 reimbursement:approve（不是 create/view）', () => {
    expect(permOf('approveForApprover')).toBe('reimbursement:approve');
    expect(permOf('rejectForApprover')).toBe('reimbursement:approve');
  });

  it('读端点保持 reimbursement:view（回归保护）', () => {
    expect(permOf('listMine')).toBe('reimbursement:view');
    expect(permOf('listPending')).toBe('reimbursement:view');
    expect(permOf('getDetail')).toBe('reimbursement:view');
    expect(permOf('listTypes')).toBe('reimbursement:view');
    expect(permOf('exportExcel')).toBe('reimbursement:view');
  });

  it('类型配置端点保持 reimbursement:manage（回归保护）', () => {
    expect(permOf('createType')).toBe('reimbursement:manage');
    expect(permOf('updateType')).toBe('reimbursement:manage');
    expect(permOf('removeType')).toBe('reimbursement:manage');
    expect(permOf('createExpenseType')).toBe('reimbursement:manage');
  });
});
