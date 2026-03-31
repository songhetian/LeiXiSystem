import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';
import { QualityRule, QualityFilters } from '../types';

// 1. 获取质检评分规则
export const useQualityRules = (filters: { category?: string; is_active?: boolean }) => {
  return useQuery({
    queryKey: ['quality', 'rules', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category && filters.category !== 'all') params.append('category', filters.category);
      if (filters.is_active !== undefined) params.append('is_active', String(filters.is_active));
      
      const response = await api.get<{ success: boolean; data: QualityRule[] }>(`/quality/rules?${params.toString()}`);
      return response.data.data;
    },
  });
};

// 2. 状态切换
export const useQualityActions = () => {
  const queryClient = useQueryClient();

  const createRule = useMutation({
    mutationFn: async (payload: { name: string; category?: string; description?: string; criteria?: string; score_weight: number; is_active?: boolean }) => {
      const response = await api.post<{ success: boolean; id: number }>('/quality/rules', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'rules'] });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: { name: string; category?: string; description?: string; criteria?: string; score_weight: number; is_active?: boolean } }) => {
      const response = await api.put<{ success: boolean }>(`/quality/rules/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'rules'] });
    },
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      const response = await api.put(`/quality/rules/${id}/toggle`, { is_enabled });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'rules'] });
    },
  });

  return { createRule, updateRule, toggleRule };
};

// 3. 异步导入会话 (Job ID 模式)
export const useImportQualitySessions = () => {
  return useMutation({
    mutationFn: async (formData: FormData) => {
      // 这里的接口将返回 { success: true, jobId: '...' }
      const response = await api.post<{ success: boolean; jobId: string }>('/quality/sessions/import', formData);
      return response.data;
    }
  });
};
