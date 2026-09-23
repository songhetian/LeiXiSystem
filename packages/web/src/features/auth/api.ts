import type { AuthUser, LoginResult, MeResult } from '@leixi/shared';
import { api, setTokens, clearTokens } from '../../lib/api';

export const authApi = {
  async login(username: string, password: string): Promise<LoginResult> {
    const res = await api<LoginResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setTokens(res.accessToken, res.refreshToken);
    return res;
  },

  async me(): Promise<MeResult> {
    return api<MeResult>('/api/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await api<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },
};