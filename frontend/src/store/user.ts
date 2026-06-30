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
  isLoggedIn: boolean
  user: User | null
  permissions: string[]
  setUser: (user: User) => void
  setPermissions: (permissions: string[]) => void
  setLoggedIn: (value: boolean) => void
  logout: () => void
  logoutRemote: () => Promise<void>
}

export const useUserStore = create<UserState>((set) => ({
  isLoggedIn: false,
  user: storedUser,
  permissions: storedUser?.permissions || [],

  setLoggedIn: (value) => {
    set({ isLoggedIn: value })
  },

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, permissions: user.permissions || [], isLoggedIn: true })
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
    localStorage.removeItem('user')
    set({ isLoggedIn: false, user: null, permissions: [] })
  },

  logoutRemote: async () => {
    try {
      await logoutApi()
    } finally {
      localStorage.removeItem('user')
      set({ isLoggedIn: false, user: null, permissions: [] })
    }
  },
}))
