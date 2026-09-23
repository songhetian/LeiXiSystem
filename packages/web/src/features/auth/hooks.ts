import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@leixi/shared';
import { authApi } from './api';
import { reconnectSocket, disconnectSocket } from '../../lib/socket';

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      authApi.login(username, password),
    onSuccess: () => {
      // 用新 token 重建 socket，使通知房间跟随最新身份
      reconnectSocket();
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      // 登出即断开，避免旧身份连接残留
      disconnectSocket();
      void qc.resetQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export type { AuthUser };