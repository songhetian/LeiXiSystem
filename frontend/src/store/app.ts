import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface AppState {
  theme: Theme
  sidebarCollapsed: boolean
  sidebarWidth: number
  breadcrumb: string[]
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setBreadcrumb: (items: string[]) => void
}

const THEME_KEY = 'theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(THEME_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: getInitialTheme(),
      sidebarCollapsed: false,
      sidebarWidth: 220,
      breadcrumb: [],

      toggleTheme: () => {
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light'
          document.body.classList.toggle('arco-theme-dark', newTheme === 'dark')
          return { theme: newTheme }
        })
      },

      setTheme: (theme) => {
        set({ theme })
        document.body.classList.toggle('arco-theme-dark', theme === 'dark')
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      },

      setSidebarCollapsed: (collapsed) => {
        set({ sidebarCollapsed: collapsed })
      },

      setBreadcrumb: (items) => {
        set({ breadcrumb: items })
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          document.body.classList.toggle('arco-theme-dark', state.theme === 'dark')
        }
      },
    },
  ),
)

export default useAppStore
