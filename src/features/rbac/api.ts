import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useRoles = () => {
  return useQuery({
    queryKey: ['rbac', 'roles'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>('/rbac/roles');
      return response.data.data;
    },
  });
};

export const useRoleDetail = (id: number | null) => {
  return useQuery({
    queryKey: ['rbac', 'roles', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await api.get<{ success: boolean; data: any }>(`/rbac/roles/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
};

export const useRBACActions = () => {
  const queryClient = useQueryClient();

  const updatePermissions = useMutation({
    mutationFn: async ({ id, permissionIds }: { id: number; permissionIds: number[] }) => {
      const response = await api.put(`/rbac/roles/${id}/permissions`, { permissionIds });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rbac', 'roles', variables.id] });
    },
  });

  return { updatePermissions };
};
