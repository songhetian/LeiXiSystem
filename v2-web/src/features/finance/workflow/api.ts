import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useWorkflowDefinitions = (type = 'reimbursement') => {
  return useQuery({
    queryKey: ['workflow', 'definitions', type],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>(`/workflow/definitions?type=${type}`);
      return response.data.data;
    },
  });
};

export const useWorkflowActions = () => {
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: async (payload: { targetId: number; action: string; opinion?: string }) => {
      const response = await api.post<{ success: boolean; message: string }>('/workflow/decide', payload);
      return response.data;
    },
    onSuccess: () => {
      // 规约执行：多模块缓存失效闭环
      queryClient.invalidateQueries({ queryKey: ['reimbursement'] });
      queryClient.invalidateQueries({ queryKey: ['workflow'] });
    },
  });

  return { decide };
};
