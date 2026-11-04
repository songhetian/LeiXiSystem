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
  // ===== 隐私二级密码（工资条等高敏数据独立二次验证） =====
  getPrivacyPasswordStatus(): Promise<{ code: number; message?: string; data?: { enabled: boolean } }> {
    return request.get('/auth/privacy-password/status');
  },
  /** 已设置过二级密码时 oldPassword 必填（首次设置不传） */
  setPrivacyPassword(password: string, oldPassword?: string): Promise<{ code: number; message?: string }> {
    return request.post('/auth/privacy-password', { password, oldPassword });
  },
  /** 忘记二级密码：用登录密码核身后重置 */
  resetPrivacyPassword(loginPassword: string, password: string): Promise<{ code: number; message?: string }> {
    return request.post('/auth/privacy-password/reset', { loginPassword, password });
  },
};
