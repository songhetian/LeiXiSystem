import request from '@/lib/request';

// ========== 静态参考数据内存缓存 ==========
// 部门/职位这类几乎不变的基础数据，每次切页都重复请求会放大"不丝滑"。
// 这里按 key 缓存 5 分钟，变更（增删改）时主动失效，避免下拉数据来回重拉。

const REFERENCE_CACHE_TTL = 5 * 60 * 1000;

interface ReferenceCacheEntry<T> {
  data: T;
  timestamp: number;
}

const referenceCache: Record<string, ReferenceCacheEntry<unknown>> = {};

function cachedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const entry = referenceCache[key];
  if (entry && Date.now() - entry.timestamp < REFERENCE_CACHE_TTL) {
    return Promise.resolve(entry.data as T);
  }
  return fetcher().then((data) => {
    referenceCache[key] = { data, timestamp: Date.now() };
    return data;
  });
}

function invalidateReferenceCache(key?: string) {
  if (key) {
    delete referenceCache[key];
  } else {
    Object.keys(referenceCache).forEach((k) => delete referenceCache[k]);
  }
}

/** 清空静态参考数据缓存（登出/测试时调用） */
export function clearSystemCache() {
  invalidateReferenceCache();
}

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

export interface SysRoleUpdateDto {
  name?: string;
  description?: string;
}

export interface SysDepartment {
  id: number;
  name: string;
  parentId?: number | null;
}

export interface SysPosition {
  id: number;
  name: string;
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

export interface DepartmentListResult {
  code: number;
  message?: string;
  data?: SysDepartment[];
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
  // DELETE /system/users/:id
  deleteUser(id: number): Promise<SimpleResult> {
    return request.delete(`/system/users/${id}`);
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
  // PUT /system/roles/:id
  updateRole(id: number, data: SysRoleUpdateDto): Promise<SimpleResult> {
    return request.put(`/system/roles/${id}`, data);
  },
  // DELETE /system/roles/:id
  deleteRole(id: number): Promise<SimpleResult> {
    return request.delete(`/system/roles/${id}`);
  },
  assignRolePermissions(id: number, permissionIds: number[]): Promise<SimpleResult> {
    return request.post(`/system/roles/${id}/permissions`, { permissionIds });
  },
  // GET /system/departments
  listDepartments(): Promise<DepartmentListResult> {
    return cachedGet('departments', () => request.get('/system/departments'));
  },
  createDepartment(data: { name: string; parentId?: number }): Promise<{ code: number; message?: string; data: SysDepartment }> {
    invalidateReferenceCache('departments');
    return request.post('/system/departments', data);
  },
  updateDepartment(id: number, data: { name?: string; parentId?: number | null }): Promise<{ code: number; message?: string; data: SysDepartment }> {
    invalidateReferenceCache('departments');
    return request.put(`/system/departments/${id}`, data);
  },
  deleteDepartment(id: number): Promise<{ code: number; message?: string; data: { success: boolean } }> {
    invalidateReferenceCache('departments');
    return request.delete(`/system/departments/${id}`);
  },
  listPositions(): Promise<{ code: number; message?: string; data: SysPosition[] }> {
    return cachedGet('positions', () => request.get('/system/positions'));
  },
  createPosition(data: { name: string }): Promise<{ code: number; message?: string; data: SysPosition }> {
    invalidateReferenceCache('positions');
    return request.post('/system/positions', data);
  },
  updatePosition(id: number, data: { name: string }): Promise<{ code: number; message?: string; data: SysPosition }> {
    invalidateReferenceCache('positions');
    return request.put(`/system/positions/${id}`, data);
  },
  deletePosition(id: number): Promise<{ code: number; message?: string; data: { success: boolean } }> {
    invalidateReferenceCache('positions');
    return request.delete(`/system/positions/${id}`);
  },
  // ---- 操作日志 ----
  listLogs(params: { page?: number; pageSize?: number; module?: string; userId?: number; startDate?: string; endDate?: string } = {}): Promise<ListResult<OperationLog>> {
    return request.get('/system/logs', { params });
  },
};
