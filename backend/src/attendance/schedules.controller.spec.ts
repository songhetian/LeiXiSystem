// 排班读接口权限（审计修复）：
// 导航「排班管理」只要求 attendance:view，但读接口此前挂 attendance:manage，
// 导致只有查看权的用户能进页面却拿不到任何数据（403）。
// 读接口（list / matrix）放开到 attendance:view，写接口保持 attendance:manage。
import { Reflector } from '@nestjs/core';
import { SchedulesController } from './schedules.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof SchedulesController): string | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, SchedulesController.prototype[method]);

describe('SchedulesController — 读接口权限（排班审计）', () => {
  it('读接口挂 attendance:view，与导航权限一致', () => {
    expect(permOf('list')).toBe('attendance:view');
    expect(permOf('matrix')).toBe('attendance:view');
  });

  it('我的排班保持 attendance:view', () => {
    expect(permOf('my')).toBe('attendance:view');
  });

  it('写接口仍挂 attendance:manage（查看者不可改排班）', () => {
    expect(permOf('create')).toBe('attendance:manage');
    expect(permOf('batch')).toBe('attendance:manage');
    expect(permOf('update')).toBe('attendance:manage');
    expect(permOf('remove')).toBe('attendance:manage');
    expect(permOf('batchRemove')).toBe('attendance:manage');
  });
});
