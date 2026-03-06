import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@/features/auth/types';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoggedIn: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoggedIn: false,
      setAuth: (user, token) => set({ user, token, isLoggedIn: true }),
      clearAuth: () => set({ user: null, token: null, isLoggedIn: false }),
      updateUser: (userData) => 
        set((state) => ({ 
          user: state.user ? { ...state.user, ...userData } : null 
        })),
    }),
    {
      name: 'leixi-auth-storage',
    }
  )
);
