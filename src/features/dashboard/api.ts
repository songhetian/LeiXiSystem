import { useQuery } from '@tanstack/react-query';
import api from '@/core/api';

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any }>('/admin/dashboard/stats');
      return response.data.data;
    },
    refetchInterval: 120000, // 2分钟自动对齐 Redis 缓存
  });
};

export const useRealtimeAttendance = () => {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'realtime'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>('/admin/dashboard/realtime');
      return response.data.data;
    },
    refetchInterval: 30000, // 实时数据 30s 轮询
  });
};
