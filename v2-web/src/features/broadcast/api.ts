import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useMyBroadcasts = () => {
  return useQuery({
    queryKey: ['broadcasts', 'my'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>('/broadcasts/my');
      return response.data.data;
    },
  });
};

export const useBroadcastActions = () => {
  const queryClient = useQueryClient();

  const publish = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post<{ success: boolean; jobId: string }>('/broadcasts', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts', 'created'] });
    },
  });

  return { publish };
};
