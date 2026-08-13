import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  name: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
  logout: () => void;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true }),

  clearUser: () => set({ user: null, isAuthenticated: false }),

  logout: () => {
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: () => {
    const hasToken = document.cookie.split(';').some((item) =>
      item.trim().startsWith('token='),
    );
    if (hasToken) {
      set({ isAuthenticated: true });
      return true;
    }
    return false;
  },
}));
