import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';
import { AuthUser } from '@/features/auth/types';

export const useProfile = (userId: number | undefined) => {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await api.get<{ success: boolean; data: AuthUser }>(`/personal/profile`);
      return response.data.data;
    },
    enabled: !!userId,
  });
};

export const useSalaryHistory = () => {
  return useQuery({
    queryKey: ['personal', 'salary'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>('/personal/salary');
      return response.data.data;
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: any }) => {
      const response = await api.put<{ success: boolean; message?: string }>(`/personal/profile`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.userId] });
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post<{ success: boolean; message?: string }>('/auth/change-password', data);
      return response.data;
    },
  });
};

export const useUploadFile = () => {
  return useMutation({
    mutationFn: async ({ file, bizType }: { file: File; bizType: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<{ success: boolean; bizPath: string }>(`/upload?bizType=${bizType}`, formData);
      return response.data;
    },
  });
};
