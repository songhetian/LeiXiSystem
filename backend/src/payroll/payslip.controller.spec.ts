// RBAC 强制标准（REFACTOR_PLAN 11.6-3）：payslips/me/* 是工资条（高敏感）自助端点，
// 此前仅登录即可访问；统一按 seed 中的 payroll:my:view（我的工资条）收口。
import { Reflector } from '@nestjs/core';
import { PayslipController } from './payslip.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof PayslipController): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, PayslipController.prototype[method]);

describe('PayslipController — 端点权限矩阵', () => {
  it('me/* 自助端点全部挂 payroll:my:view（此前无守卫）', () => {
    expect(permOf('verifyPassword')).toBe('payroll:my:view');
    expect(permOf('myPayslips')).toBe('payroll:my:view');
    expect(permOf('myPayslipDetail')).toBe('payroll:my:view');
    expect(permOf('markViewed')).toBe('payroll:my:view');
    expect(permOf('myYearSummary')).toBe('payroll:my:view');
    expect(permOf('detail')).toBe('payroll:view');
  });

  it('管理列表保持 payroll:view（回归保护）', () => {
    expect(permOf('list')).toBe('payroll:view');
  });
});
