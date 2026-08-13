import '@testing-library/jest-dom';
import { useAuthStore } from '@/store/auth';

beforeEach(() => {
  document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  useAuthStore.getState().clearUser();
});

describe('auth store', () => {
  it('starts with unauthenticated state', () => {
    const { isAuthenticated, user } = useAuthStore.getState();
    expect(isAuthenticated).toBe(false);
    expect(user).toBeNull();
  });

  it('sets user and marks authenticated on login', () => {
    const { setUser } = useAuthStore.getState();
    setUser({ id: 1, username: 'admin', name: '管理员' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual({ id: 1, username: 'admin', name: '管理员' });
  });

  it('clears user on logout', () => {
    const { setUser, logout } = useAuthStore.getState();
    setUser({ id: 1, username: 'admin', name: '管理员' });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('checks auth from cookie', () => {
    document.cookie = 'token=test-token-123; path=/;';
    const { checkAuth } = useAuthStore.getState();
    const result = checkAuth();
    expect(result).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('returns false when no auth cookie exists', () => {
    const { checkAuth } = useAuthStore.getState();
    const result = checkAuth();
    expect(result).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
