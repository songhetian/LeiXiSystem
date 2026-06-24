import { create } from 'zustand'
import type { User } from '@/types'

interface UserState {
  token: string
  user: User | null
  permissions: string[]
  setToken: (token: string) => void
  setUser: (user: User) => void
  setPermissions: (permissions: string[]) => void
  logout: () => void
}

export const useUserStore = create<UserState>((set) => ({
  token: localStorage.getItem('token') || '',
  user: null,
  permissions: [],

  setToken: (token) => {
    localStorage.setItem('token', token)
    set({ token })
  },

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user))
    set({ user })
  },

  setPermissions: (permissions) => {
    set({ permissions })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    set({ token: '', user: null, permissions: [] })
  },
}))
