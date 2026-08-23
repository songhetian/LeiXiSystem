import { useAuthStore } from '@/store/auth';
import { authApi } from '@/services/auth';

jest.mock('@/services/auth', () => ({
  authApi: {
    me: jest.fn(),
  },
}));

describe('useAuthStore · 权限与会话（T26）', () => {
  beforeEach(() => {
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
    useAuthStore.getState().clearUser();
    jest.clearAllMocks();
  });

  it('setUser 保存 permissions 并标记已登录', () => {
    useAuthStore.getState().setUser({
      id: 1,
      username: 'admin',
      name: '管理员',
      permissions: ['attendance:view', 'payroll:view'],
    });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.permissions).toEqual(['attendance:view', 'payroll:view']);
  });

  it('checkAuth 调用 /auth/me 验证 HttpOnly cookie（成功时标记已登录）', async () => {
    (authApi.me as jest.Mock).mockResolvedValue({
      code: 0,
      data: {
        user: { id: 1, username: 'admin', name: '管理员', permissions: ['attendance:view'] },
      },
    });

    const result = await useAuthStore.getState().checkAuth();
    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.username).toBe('admin');
    expect(authApi.me).toHaveBeenCalledTimes(1);
  });

  it('checkAuth 在 /auth/me 返回失败时标记未登录', async () => {
    (authApi.me as jest.Mock).mockResolvedValue({ code: 401, message: 'token 无效' });

    const result = await useAuthStore.getState().checkAuth();
    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('checkAuth 在已登录时直接放行，不重复调用 /auth/me', async () => {
    useAuthStore.getState().setUser({
      id: 1, username: 'admin', name: '管理员', permissions: [],
    });

    const result = await useAuthStore.getState().checkAuth();
    expect(result).toBe(true);
    expect(authApi.me).not.toHaveBeenCalled();
  });

  it('logout 清除 access_token cookie 并登出', () => {
    document.cookie = 'access_token=abc123; path=/';
    useAuthStore.getState().setUser({ id: 1, username: 'a', name: 'A', permissions: [] });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(document.cookie).not.toContain('access_token=abc123');
  });
});
