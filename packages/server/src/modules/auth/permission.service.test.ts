import { describe, it, expect } from 'vitest';
import { createPermissionService, type RolePermissionLoader } from './permission.service';

/** 独立数据源：给每个角色 id 显式声明权限码 */
const ROLE_PERMS: Record<number, string[]> = {
  1: ['user_create', 'user_delete', 'leave_approve', 'report_view'], // admin
  2: ['leave_approve', 'report_view'], // manager
  3: ['report_view'], // staff
};

function loader(roleIds: number[]): RolePermissionLoader {
  return {
    async loadPermissionCodes(ids) {
      const flat = ids.flatMap((id) => ROLE_PERMS[id] ?? []);
      return [...new Set(flat)]; // stack 模拟 loader 仅聚合，不去重排序
    },
  };
}

describe('permission.service (Seam B 权限解析纯函数)', () => {
  it('多角色权限并集去重、按码排序', async () => {
    const svc = createPermissionService(loader([1, 3]), [1, 3]);
    await expect(svc.permissionCodes()).resolves.toEqual([
      'leave_approve',
      'report_view',
      'user_create',
      'user_delete',
    ]);
  });

  it('has 正确判段单权限', async () => {
    const svc = createPermissionService(loader([2]), [2]);
    await expect(svc.has('leave_approve')).resolves.toBe(true);
    await expect(svc.has('user_create')).resolves.toBe(false);
  });

  it('空角色返回空列表，has 恒为 false', async () => {
    const svc = createPermissionService(loader([]), []);
    await expect(svc.permissionCodes()).resolves.toEqual([]);
    await expect(svc.has('report_view')).resolves.toBe(false);
  });
});