import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/core/api';
import { 
  LoginInput, 
  RegisterInput, 
  AuthResponse, 
  SessionCheckResponse, 
  Department 
} from '../types';

export const useLogin = () => {
  return useMutation({
    mutationFn: async (data: LoginInput & { forceLogin?: boolean }) => {
      const response = await api.post<AuthResponse>('/auth/login', data);
      return response.data;
    },
  });
};

export const useCheckSession = () => {
  return useMutation({
    mutationFn: async (username: string) => {
      const response = await api.post<SessionCheckResponse>('/auth/check-session', { username });
      return response.data;
    },
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const response = await api.post<{ success: boolean; message?: string }>('/auth/register', data);
      return response.data;
    },
  });
};

export const useDepartments = () => {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get<Department[]>('/departments?forManagement=true');
      return response.data;
    },
  });
};

export const useCheckUsername = () => {
  return useMutation({
    mutationFn: async ({ username, realName }: { username: string; realName: string }) => {
      const response = await api.post<{ available: boolean; suggestions?: string[] }>('/auth/check-username', {
        username,
        realName,
      });
      return response.data;
    },
  });
};
