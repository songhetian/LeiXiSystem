import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';
import { 
  DeviceInstance, 
  AssetCategory, 
  AssetRequest, 
  AssetFilters 
} from './types';

// 1. 获取物理设备明细 (TanStack Query v5)
export const useAssetInstances = (filters: AssetFilters) => {
  return useQuery({
    queryKey: ['assets', 'instances', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.device_status) params.append('device_status', filters.device_status);
      if (filters.keyword) params.append('keyword', filters.keyword);
      
      const response = await api.get<{ success: boolean; data: DeviceInstance[] }>(`/assets/instances?${params.toString()}`);
      return response.data.data;
    },
  });
};

// 2. 获取分类 (带缓存优化)
export const useAssetCategories = () => {
  return useQuery({
    queryKey: ['assets', 'categories'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: AssetCategory[] }>('/assets/categories');
      return response.data.data;
    },
  });
};

// 3. 资产申请与审批
export const useAssetActions = () => {
  const queryClient = useQueryClient();

  const auditRequest = useMutation({
    mutationFn: async ({ id, action, notes }: { id: number; action: string; notes?: string }) => {
      const response = await api.put(`/assets/requests/${id}/audit`, { action, admin_notes: notes });
      return response.data;
    },
    onSuccess: () => {
      // 规约执行：多模块缓存失效闭环
      queryClient.invalidateQueries({ queryKey: ['assets', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['assets', 'instances'] });
    },
  });

  return { auditRequest };
};
