import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useReimbursements = (filters: { status?: string; keyword?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['reimbursement', 'list', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.keyword) params.append('keyword', filters.keyword);
      params.append('page', String(filters.page || 1));
      if (filters.limit) params.append('limit', String(filters.limit));
      
      const response = await api.get<{ success: boolean; data: any[]; total: number }>('/reimbursement/list?' + params.toString());
      return response.data;
    },
  });
};

export const useReimbursementDetail = (id: number | null) => {
  return useQuery({
    queryKey: ['reimbursement', 'detail', id],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any }>(`/reimbursement/${id}`);
      return response.data.data;
    },
    enabled: id !== null,
  });
};

export const useReimbursementTypes = () => {
  return useQuery({
    queryKey: ['reimbursement', 'types'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: { code: string | null; name: string }[] }>('/reimbursement/types');
      return response.data.data.length > 0
        ? response.data.data.map((item) => ({ code: item.code || 'other', name: item.name }))
        : [
            { code: 'travel', name: '差旅报销' },
            { code: 'office', name: '办公费用' },
            { code: 'entertainment', name: '商务招待' },
            { code: 'training', name: '学习培训' },
            { code: 'other', name: '其它杂项' },
          ];
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

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await api.put<{ success: boolean; id: number }>(`/reimbursement/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reimbursement', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['reimbursement', 'detail', variables.id] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.delete<{ success: boolean }>(`/reimbursement/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reimbursement', 'list'] });
    },
  });

  const submit = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post<{ success: boolean }>(`/reimbursement/${id}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reimbursement', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['reimbursement'] });
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post<{ success: boolean }>(`/reimbursement/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reimbursement', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['reimbursement'] });
    },
  });

  return { create, update, remove, submit, cancel };
};
