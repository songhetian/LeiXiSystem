import { useAuthStore } from '@/store/auth';

describe('useAuthStore · 权限与会话（T26）', () => {
  beforeEach(() => {
    // 清空 jsdom 中的 cookie
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim();
      if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
    useAuthStore.getState().clearUser();
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

  it('checkAuth 识别 access_token cookie（与后端 httpOnly cookie 名一致）', () => {
    document.cookie = 'access_token=abc123; path=/';
    expect(useAuthStore.getState().checkAuth()).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('logout 清除 access_token cookie 并登出', () => {
    document.cookie = 'access_token=abc123; path=/';
    useAuthStore.getState().setUser({ id: 1, username: 'a', name: 'A', permissions: [] });
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(document.cookie).not.toContain('access_token=abc123');
  });
});
