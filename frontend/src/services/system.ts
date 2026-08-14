import request from '@/lib/request';

// ========== 用户管理 ==========

export interface SysRoleBrief {
  id: number;
  code: string;
  name: string;
}

export interface SysUser {
  id: number;
  username: string;
  name: string;
  status: string;
  createdAt: string;
  roles: SysRoleBrief[];
}

export interface SysUserCreateDto {
  username: string;
  password: string;
  name: string;
  roleIds?: number[];
}

export interface SysUserUpdateDto {
  name?: string;
  status?: string;
  password?: string;
}

// ========== 角色与权限 ==========

export interface SysPermission {
  id: number;
  code: string;
  name: string;
  module: string;
  type: string;
}

export interface SysRole {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  permissions: { permission: SysPermission }[];
}

export interface SysRoleCreateDto {
  code: string;
  name: string;
  description?: string;
}

// ========== 操作日志 ==========

export interface OperationLog {
  id: number;
  userId?: number | null;
  username?: string | null;
  module: string;
  action: string;
  method?: string | null;
  url?: string | null;
  ip?: string | null;
  status: string;
  createdAt: string;
}

export interface ListResult<T> {
  code: number;
  message?: string;
  data?: { list: T[]; total: number; page: number; pageSize: number };
}

export interface RoleListResult {
  code: number;
  message?: string;
  data?: SysRole[];
}

export interface PermissionListResult {
  code: number;
  message?: string;
  data?: SysPermission[];
}

export interface SimpleResult {
  code: number;
  message?: string;
  data?: { success?: boolean } | SysUser | SysRole;
}

export const systemApi = {
  // ---- 用户 ----
  listUsers(params: { page?: number; pageSize?: number; keyword?: string; roleId?: number } = {}): Promise<ListResult<SysUser>> {
    return request.get('/system/users', { params });
  },
  createUser(data: SysUserCreateDto): Promise<SimpleResult> {
    return request.post('/system/users', data);
  },
  updateUser(id: number, data: SysUserUpdateDto): Promise<SimpleResult> {
    return request.put(`/system/users/${id}`, data);
  },
  assignUserRoles(id: number, roleIds: number[]): Promise<SimpleResult> {
    return request.post(`/system/users/${id}/roles`, { roleIds });
  },
  // ---- 角色/权限 ----
  listRoles(): Promise<RoleListResult> {
    return request.get('/system/roles');
  },
  listPermissions(): Promise<PermissionListResult> {
    return request.get('/system/permissions');
  },
  createRole(data: SysRoleCreateDto): Promise<SimpleResult> {
    return request.post('/system/roles', data);
  },
  assignRolePermissions(id: number, permissionIds: number[]): Promise<SimpleResult> {
    return request.post(`/system/roles/${id}/permissions`, { permissionIds });
  },
  // ---- 操作日志 ----
  listLogs(params: { page?: number; pageSize?: number; module?: string; userId?: number; startDate?: string; endDate?: string } = {}): Promise<ListResult<OperationLog>> {
    return request.get('/system/logs', { params });
  },
};
