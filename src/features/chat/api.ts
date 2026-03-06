import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/core/api';

export const useChatGroups = () => {
  return useQuery({
    queryKey: ['chat', 'groups'],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: any[] }>('/chat/groups');
      return response.data.data;
    },
  });
};

export const useChatMessages = (groupId: number | null) => {
  return useQuery({
    queryKey: ['chat', 'messages', groupId],
    queryFn: async () => {
      if (!groupId) return [];
      const response = await api.get<{ success: boolean; data: any[] }>(`/chat/groups/${groupId}/messages`);
      return response.data.data;
    },
    enabled: !!groupId,
  });
};
