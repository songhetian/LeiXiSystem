import { create } from 'zustand'
import type { User } from '@/types'
import { logout as logoutApi } from '@/api/auth'

function getStoredUser() {
  const raw = localStorage.getItem('user')
  if (!raw) return null

  try {
    return JSON.parse(raw) as User
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

const storedUser = getStoredUser()

interface UserState {
  token: string
  user: User | null
  permissions: string[]
  setToken: (token: string) => void
  setUser: (user: User) => void
  setPermissions: (permissions: string[]) => void
  logout: () => void
  logoutRemote: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  token: localStorage.getItem('token') || '',
  user: storedUser,
  permissions: storedUser?.permissions || [],

  setToken: (token) => {
    localStorage.setItem('token', token)
    set({ token })
  },

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, permissions: user.permissions || [] })
  },

  setPermissions: (permissions) => {
    const raw = localStorage.getItem('user')
    if (raw) {
      try {
        const user = JSON.parse(raw)
        localStorage.setItem('user', JSON.stringify({ ...user, permissions }))
      } catch {
        localStorage.removeItem('user')
      }
    }
    set({ permissions })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: '', user: null, permissions: [] })
  },

  logoutRemote: async () => {
    try {
      await logoutApi()
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      set({ token: '', user: null, permissions: [] })
    }
  },
}))
