import request from '@/lib/request';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  code: number;
  message?: string;
  data?: {
    user: {
      id: number;
      username: string;
      name: string;
      permissions: string[];
    };
  };
}

export const authApi = {
  login(params: LoginParams): Promise<LoginResult> {
    return request.post('/auth/login', params);
  },
  me(): Promise<LoginResult> {
    return request.get('/auth/me');
  },
  changePassword(oldPassword: string, newPassword: string): Promise<{ code: number; message?: string }> {
    return request.post('/auth/change-password', { oldPassword, newPassword });
  },
};
