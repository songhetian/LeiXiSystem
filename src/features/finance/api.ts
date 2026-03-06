import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useReimbursements = (filters: { status?: string; keyword?: string; page?: number }) => {
  return useQuery({
    queryKey: ['reimbursement', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.keyword) params.append('keyword', filters.keyword);
      params.append('page', String(filters.page || 1));
      
      const response = await api.get<{ success: boolean; data: any[]; total: number }>('/reimbursement/list?' + params.toString());
      return response.data;
    },
  });
};

export const useReimbursementActions = () => {
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post<{ success: boolean; id: number }>('/reimbursement', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reimbursement', 'list'] });
    },
  });

  return { create };
};
