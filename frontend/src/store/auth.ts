import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { logout as logoutApi } from '@/api/auth'

interface AuthState {
  token: string | null
  isLoggedIn: boolean
  user: User | null
  permissions: string[]
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  setToken: (token: string) => void
  setLoggedIn: (value: boolean) => void
  setPermissions: (permissions: string[]) => void
  logout: () => void
  logoutRemote: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      isLoggedIn: false,
      user: null,
      permissions: [],

      setAuth: (token, user) => {
        set({
          token,
          user,
          permissions: user.permissions || [],
          isLoggedIn: true,
        })
      },

      setUser: (user) => {
        set({ user, permissions: user.permissions || get().permissions, isLoggedIn: true })
      },

      setToken: (token) => {
        set({ token })
      },

      setLoggedIn: (value) => {
        set({ isLoggedIn: value })
      },

      setPermissions: (permissions) => {
        set({ permissions })
      },

      logout: () => {
        set({
          token: null,
          user: null,
          permissions: [],
          isLoggedIn: false,
        })
      },

      logoutRemote: async () => {
        try {
          await logoutApi()
        } finally {
          set({
            token: null,
            user: null,
            permissions: [],
            isLoggedIn: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        permissions: state.permissions,
        isLoggedIn: state.isLoggedIn,
      }),
    },
  ),
)

export default useAuthStore
