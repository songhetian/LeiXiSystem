import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rbacApi } from './api';

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: rbacApi.getRoles });
}

export function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: rbacApi.getUsers });
}

/** 更新角色权限后，使 /me 与角色列表失效（重新拉取各自的权限码） */
export function useSetRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: number; permissionIds: number[] }) =>
      rbacApi.setRolePermissions(roleId, permissionIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] });
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/** 更新用户角色后，使用户列表与 /me 失效 */
export function useSetUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      rbacApi.setUserRoles(userId, roleIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rbacApi.createUser,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof rbacApi.updateUser>[1] }) =>
      rbacApi.updateUser(id, data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rbacApi.deleteUser(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: number; newPassword: string }) =>
      rbacApi.resetPassword(id, newPassword),
  });
}