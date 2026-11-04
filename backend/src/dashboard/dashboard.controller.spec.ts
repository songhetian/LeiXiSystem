// RBAC 强制标准（REFACTOR_PLAN 11.6-3）：dashboard 聚合端点此前仅登录即可访问。
// stats/attendance-trend 含全公司考勤聚合（出勤/迟到/加班）→ attendance:view；
// department-stats 为部门在职人数（员工数据）→ employee:view。
import { Reflector } from '@nestjs/core';
import { DashboardController } from './dashboard.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof DashboardController): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, DashboardController.prototype[method]);

describe('DashboardController — 端点权限矩阵', () => {
  it('含全公司考勤聚合的端点挂 attendance:view', () => {
    expect(permOf('getStats')).toBe('attendance:view');
    expect(permOf('getAttendanceTrend')).toBe('attendance:view');
  });

  it('部门人数统计挂 employee:view', () => {
    expect(permOf('getDepartmentStats')).toBe('employee:view');
  });
});
