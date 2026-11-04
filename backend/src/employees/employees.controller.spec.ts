// RBAC 强制标准（REFACTOR_PLAN 11.6-3）：个人资料修改是写端点，此前无守卫；
// seed 已定义并给 staff 绑定 personal:profile:update（个人资料修改）。
import { Reflector } from '@nestjs/core';
import { EmployeesController } from './employees.controller';
import { EmployeeTxController } from './employee-tx.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (controller: any, method: string): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, controller.prototype[method]);

describe('个人资料端点 — 端点权限矩阵', () => {
  it('EmployeesController me/profile 挂 personal:profile:update（此前无守卫）', () => {
    expect(permOf(EmployeesController, 'updateMyProfile')).toBe('personal:profile:update');
  });

  it('EmployeeTxController me/profile 挂 personal:profile:update（方法级守卫需显式含 PermissionGuard）', () => {
    expect(permOf(EmployeeTxController, 'updateMyProfile')).toBe('personal:profile:update');
  });
});
