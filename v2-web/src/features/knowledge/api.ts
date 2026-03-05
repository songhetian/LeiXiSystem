import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useKnowledgeCategories = (type = 'common') => {
  return useQuery({
    queryKey: ['knowledge', 'categories', type],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>(`/knowledge/categories?type=${type}`);
      return response.data.data;
    },
  });
};

export const useKnowledgeArticles = (filters: { category_id?: string; search?: string; page?: number }) => {
  return useQuery({
    queryKey: ['knowledge', 'articles', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.category_id) params.append('category_id', filters.category_id);
      if (filters.search) params.append('search', filters.search);
      params.append('page', String(filters.page || 1));
      
      const response = await api.get<{ success: boolean; data: any[]; total: number }>('/knowledge/articles?' + params.toString());
      return response.data;
    },
  });
};

export const useKnowledgeActions = () => {
  const queryClient = useQueryClient();

  const recordView = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.post(`/knowledge/articles/${id}/view`);
      return response.data;
    },
  });

  return { recordView };
};
