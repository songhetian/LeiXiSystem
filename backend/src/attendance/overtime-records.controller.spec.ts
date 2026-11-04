// RBAC 强制标准（REFACTOR_PLAN 11.6-3）+ ADR-0019/0020：
// 员工自助发起加班挂个人自助权限点（personal:overtime:apply），不能用 attendance:manage
// —— staff 角色没绑 manage，会导致普通员工提交加班直接 403。
import { Reflector } from '@nestjs/core';
import { OvertimeRecordsController } from './overtime-records.controller';
import { REQUIRED_PERMISSION_KEY } from '../auth/require-permission.decorator';

const reflector = new Reflector();
const permOf = (method: keyof OvertimeRecordsController): string | string[] | undefined =>
  reflector.get(REQUIRED_PERMISSION_KEY, OvertimeRecordsController.prototype[method]);

describe('OvertimeRecordsController — 端点权限矩阵', () => {
  it('create 允许员工自助或 HR 代录（OR），submit 只能本人（员工自助权限点）', () => {
    expect(permOf('create')).toEqual(['personal:overtime:apply', 'attendance:manage']);
    expect(permOf('submit')).toBe('personal:overtime:apply');
  });

  it('审批动作保持 attendance:manage、查询保持 attendance:view（回归保护）', () => {
    expect(permOf('approve')).toBe('attendance:manage');
    expect(permOf('reject')).toBe('attendance:manage');
    expect(permOf('list')).toBe('attendance:view');
    expect(permOf('listMine')).toBe('attendance:view');
  });
});
