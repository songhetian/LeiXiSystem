import { create } from 'zustand';
import { authApi } from '@/services/auth';

export interface User {
  id: number;
  username: string;
  name: string;
  /** 当前用户的权限点 code 集合（后端 login/me 返回） */
  permissions: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isMockUser: boolean;
  setUser: (user: User) => void;
  setMockUser: (user: User) => void;
  clearUser: () => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  hydrate: () => void;
}

const MOCK_USER_STORAGE_KEY = 'lx_mock_user';

function loadMockUserFromStorage(): { user: User; isMockUser: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(MOCK_USER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.user && parsed.isMockUser) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveMockUserToStorage(user: User) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MOCK_USER_STORAGE_KEY, JSON.stringify({ user, isMockUser: true }));
  } catch {
    // ignore
  }
}

function clearMockUserFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(MOCK_USER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isMockUser: false,

  hydrate: () => {
    const stored = loadMockUserFromStorage();
    if (stored) {
      set({ user: stored.user, isAuthenticated: true, isMockUser: true });
    }
  },

  setUser: (user) => {
    clearMockUserFromStorage();
    set({ user, isAuthenticated: true, isMockUser: false });
  },

  setMockUser: (user) => {
    saveMockUserToStorage(user);
    set({ user, isAuthenticated: true, isMockUser: true });
  },

  clearUser: () => {
    clearMockUserFromStorage();
    set({ user: null, isAuthenticated: false, isMockUser: false });
  },

  logout: () => {
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    clearMockUserFromStorage();
    set({ user: null, isAuthenticated: false, isMockUser: false });
  },

  /**
   * 异步校验登录状态：调用 /auth/me（HttpOnly cookie 自动携带）。
   * 不再通过 document.cookie 读取 access_token（HttpOnly 不可被 JS 读取）。
   */
  checkAuth: async () => {
    if (get().isAuthenticated) return true;

    const stored = loadMockUserFromStorage();
    if (stored) {
      set({ user: stored.user, isAuthenticated: true, isMockUser: true });
      return true;
    }

    try {
      const res = await authApi.me();
      if (res.code === 0 && res.data?.user) {
        set({ user: res.data.user, isAuthenticated: true });
        return true;
      }
    } catch {
      // 网络错误等，忽略
    }
    set({ user: null, isAuthenticated: false });
    return false;
  },

  /** 强制刷新当前用户信息（用于页面从后台切回、权限变更后等场景） */
  refreshUser: async () => {
    if (!get().isAuthenticated) return;
    if (get().isMockUser) return;
    try {
      const res = await authApi.me();
      if (res.code === 0 && res.data?.user) {
        set({ user: res.data.user, isAuthenticated: true, isMockUser: false });
      } else {
        set({ user: null, isAuthenticated: false, isMockUser: false });
      }
    } catch {
      // 网络错误等，保持原状
    }
  },
}));
