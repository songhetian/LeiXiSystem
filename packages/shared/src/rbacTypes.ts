/** 与后端角色/权限分配接口相关的共享类型 */

/** 权限点（页面级 menu + 动作级 action） */
export interface PermissionPoint {
  id: number;
  code: string;
  name: string;
  type: 'menu' | 'action';
  module: string;
}

/** 角色（含已绑定的权限 id） */
export interface RoleWithPermissions {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionIds: number[];
}

/** GET /api/roles 响应 data：全部角色 + 全部权限点 */
export interface RolesOverview {
  roles: RoleWithPermissions[];
  permissions: PermissionPoint[];
}

/** 用户（含已绑定的角色 id）*/
export interface UserWithRoles {
  id: number;
  username: string;
  realName: string;
  status: string;
  roleIds: number[];
  departmentId: number | null;
}

/** GET /api/users 响应 data：全部用户（含角色 id）*/
export interface UsersWithRoles {
  users: UserWithRoles[];
}