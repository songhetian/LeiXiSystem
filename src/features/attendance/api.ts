import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useMyAttendance = (month?: string) => {
  return useQuery({
    queryKey: ['attendance', 'my', month],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>(`/attendance/my-records?month=${month || ''}`);
      return response.data.data;
    },
  });
};

export const useAttendanceActions = () => {
  const queryClient = useQueryClient();

  const clock = useMutation({
    mutationFn: async ({ type, location }: { type: 'check_in' | 'check_out'; location?: string }) => {
      const response = await api.post('/attendance/clock', { type, location });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'my'] });
    },
  });

  const triggerExport = useMutation({
    mutationFn: async (payload: { dateRange: string[]; departmentId?: number }) => {
      const response = await api.post<{ success: boolean; jobId: string }>('/attendance/stats/export', payload);
      return response.data;
    },
  });

  return { clock, triggerExport };
};

export const useShifts = () => {
  return useQuery({
    queryKey: ['attendance', 'shifts'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>('/attendance/shifts');
      return response.data.data;
    },
  });
};

export const useShiftActions = () => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/attendance/shifts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'shifts'] });
    },
  });

  return { create };
};
