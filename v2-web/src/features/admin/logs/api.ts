import { useQuery } from '@tanstack/react-query';
import api from '@/core/api';

export interface LogFilters {
  module?: string;
  keyword?: string;
  status?: string;
  page?: number;
}

export const useSystemLogs = (filters: LogFilters) => {
  return useQuery({
    queryKey: ['admin', 'logs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.module) params.append('module', filters.module);
      if (filters.keyword) params.append('keyword', filters.keyword);
      if (filters.status) params.append('status', filters.status);
      params.append('page', String(filters.page || 1));
      
      const response = await api.get<{ success: boolean; data: any[]; total: number }>('/admin/logs?' + params.toString());
      return response.data;
    },
  });
};
