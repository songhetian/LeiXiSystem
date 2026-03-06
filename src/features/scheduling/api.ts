import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useSchedulePreview = (payload: any) => {
  return useQuery({
    queryKey: ['scheduling', 'preview', payload],
    queryFn: async () => {
      if (!payload.departmentId) return [];
      const response = await api.post<{ success: boolean; data: any[] }>('/smart-schedule/preview', payload);
      return response.data.data;
    },
    enabled: !!payload.departmentId,
  });
};

export const useSchedulingActions = () => {
  const queryClient = useQueryClient();

  const exportExcel = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post<{ success: boolean; url: string }>('/smart-schedule/export', payload);
      return response.data;
    },
  });

  return { exportExcel };
};
