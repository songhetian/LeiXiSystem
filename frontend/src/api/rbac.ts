import { get, post, put, del } from './request'

export interface Role {
  id: number
  name: string
  description?: string
  level: number
  isSystem: boolean
  canViewAllDepts: boolean
  userCount: number
  permissionCount: number
  permissions: string[]
  createdAt: string
}

export interface RoleListResponse {
  code: 0
  data: {
    list: Role[]
    total: number
    page: number
    pageSize: number
  }
}

export interface Permission {
  id: number
  name: string
  code: string
  resource?: string
  action?: string
  module?: string
  parentId?: number
  sortOrder?: number
  children?: Permission[]
}

export interface UserRole {
  id: number
  name: string
  description?: string
}

export interface UserRoleResponse {
  code: 0
  data: {
    assignedRoles: number[]
    roles: UserRole[]
  }
}

export function getRoles(params?: {
  page?: number
  pageSize?: number
  keyword?: string
}) {
  return get<RoleListResponse>('/rbac/roles', { params })
}

export function createRole(data: {
  name: string
  description?: string
  level?: number
  canViewAllDepts?: boolean
  permissions?: number[]
}) {
  return post('/rbac/roles', data)
}

export function updateRole(id: number, data: {
  name?: string
  description?: string
  level?: number
  canViewAllDepts?: boolean
  permissions?: number[]
}) {
  return put(`/rbac/roles/${id}`, data)
}

export function deleteRole(id: number) {
  return del(`/rbac/roles/${id}`)
}

export function getPermissionsTree() {
  return get<{ code: 0; data: Permission[] }>('/rbac/permissions/tree')
}

export function getPermissions() {
  return get<{ code: 0; data: Permission[] }>('/rbac/permissions')
}

export function getUserRoles(userId: number) {
  return get<UserRoleResponse>(`/rbac/user-roles/${userId}`)
}

export function assignUserRoles(userId: number, roleIds: number[]) {
  return post(`/rbac/user-roles/${userId}`, { roleIds })
}
