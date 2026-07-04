import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { wsClient } from '@/utils/websocket'
import { toast } from '@/utils/toast'
import { getNotificationList, markNotificationRead, markAllNotificationsRead } from '@/api/notification'
import type { Notification } from '@/api/notification'
import { logger } from '@/utils/logger'

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  wsConnected: boolean
  loading: boolean
  loaded: boolean
  fetchNotifications: () => Promise<void>
  addNotification: (notification: Notification) => void
  markAsRead: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  setWsConnected: (connected: boolean) => void
  clearAll: () => void
}

function getToastType(type: string): 'info' | 'success' | 'warning' | 'error' {
  const typeMap: Record<string, 'info' | 'success' | 'warning' | 'error'> = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    error: 'error',
    system: 'info',
    announcement: 'info',
    approval: 'info',
    attendance: 'info',
  }
  return typeMap[type] || 'info'
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      wsConnected: false,
      loading: false,
      loaded: false,

      fetchNotifications: async () => {
        if (get().loading) return
        set({ loading: true })
        try {
          const res = await getNotificationList({ page: 1, pageSize: 50 })
          if (res.code === 0 || (res as any).success) {
            set({
              notifications: res.data.list,
              unreadCount: res.data.unreadCount,
              loaded: true,
            })
          }
        } catch (err) {
          logger.warn('获取通知列表失败', err)
        } finally {
          set({ loading: false })
        }
      },

      addNotification: (notification) => {
        set((state) => {
          const exists = state.notifications.some((n) => n.id === notification.id)
          if (exists) return state

          const newNotifications = [notification, ...state.notifications].slice(0, 100)
          return {
            notifications: newNotifications,
            unreadCount: state.unreadCount + 1,
          }
        })

        const toastType = getToastType(notification.type)
        toast[toastType](notification.content, {
          closable: true,
          duration: 5000,
        })
      },

      markAsRead: async (id) => {
        try {
          await markNotificationRead(id)
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }))
          wsClient.ackNotification(id)
        } catch (err) {
          logger.warn('标记已读失败', err)
        }
      },

      markAllAsRead: async () => {
        try {
          await markAllNotificationsRead()
          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
          }))
          wsClient.readAllNotifications()
        } catch (err) {
          logger.warn('全部已读失败', err)
        }
      },

      setWsConnected: (connected) => {
        set({ wsConnected: connected })
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0, loaded: false })
      },
    }),
    {
      name: 'notification-storage',
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    },
  ),
)

export default useNotificationStore
