import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useMyVacation = (year = 2026) => {
  return useQuery({
    queryKey: ['vacation', 'my', year],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any }>(`/vacation/my-balance?year=${year}`);
      return response.data.data;
    },
  });
};

export const useAllVacationBalances = (filters: any) => {
  return useQuery({
    queryKey: ['vacation', 'all', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => v && params.append(k, String(v)));
      const response = await api.get<{ success: boolean; data: any[]; total: number }>(`/vacation/balances?${params.toString()}`);
      return response.data;
    },
  });
};

export const useVacationActions = () => {
  const queryClient = useQueryClient();

  const adjust = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/vacation/adjust', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation'] });
    },
  });

  return { adjust };
};
