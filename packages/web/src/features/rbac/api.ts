import type { RolesOverview, UsersWithRoles } from '@leixi/shared';
import { api } from '../../lib/api';

/** 角色-权限相关接口 */
export const rbacApi = {
  async getRoles(): Promise<RolesOverview> {
    return api<RolesOverview>('/api/roles');
  },
  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    await api<void>(`/api/roles/${roleId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionIds }),
    });
  },
  async getUsers(): Promise<UsersWithRoles> {
    return api<UsersWithRoles>('/api/users');
  },
  async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    await api<void>(`/api/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roleIds }),
    });
  },
  async createUser(data: {
    username: string;
    password: string;
    realName: string;
    roleIds: number[];
  }): Promise<{ id: number }> {
    return api<{ id: number }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateUser(
    id: number,
    data: { realName: string; status: string; roleIds: number[]; password?: string },
  ): Promise<void> {
    await api<void>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  async deleteUser(id: number): Promise<void> {
    await api<void>(`/api/users/${id}`, { method: 'DELETE' });
  },
  async resetPassword(id: number, newPassword: string): Promise<void> {
    await api<void>(`/api/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  },
};