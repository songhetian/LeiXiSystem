import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_KEY = 'required_permission';

/**
 * 端点所需权限点。
 *
 * 传数组表示「满足任意一个即可」（OR）—— 用于同一动作存在多种合法身份的场景：
 * 例如发起请假，普通员工靠 `personal:leave:apply`，HR 代录靠 `attendance:manage`，
 * 只挂前者会让 HR 失去代录能力，只挂后者会让员工 403。
 */
export const RequirePermission = (permission: string | string[]) =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
