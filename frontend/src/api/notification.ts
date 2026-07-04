import { get, post } from './request'

export interface NotificationAttachment {
  id: number
  fileName: string
  fileUrl: string
  fileSize?: number
  fileType?: string
}

export interface Notification {
  id: number
  userId: number
  type: string
  title: string
  content: string
  priority: string
  category?: string
  isRead: boolean
  readAt?: string
  requiresConfirm: boolean
  confirmedAt?: string
  createdAt: string
  relatedId?: number
  relatedType?: string
  sendTaskId?: number
  attachments?: NotificationAttachment[]
}

export interface NotificationListResponse {
  code: 0
  data: {
    list: Notification[]
    total: number
    page: number
    pageSize: number
    unreadCount: number
    unconfirmedCount?: number
  }
}

export function getNotificationList(params?: {
  page?: number
  pageSize?: number
  type?: string
  isRead?: boolean
  priority?: string
}) {
  return get<NotificationListResponse>('/notifications', { params })
}

export function getNotificationDetail(id: number) {
  return get<{ code: number; data: Notification }>(`/notifications/${id}`)
}

export function markNotificationRead(id: number) {
  return post(`/notifications/${id}/read`)
}

export function markNotificationConfirmed(id: number) {
  return post(`/notifications/${id}/confirm`)
}

export function markAllNotificationsRead() {
  return post('/notifications/read-all')
}

export function getNotificationStats() {
  return get<{
    code: number
    data: {
      total: number
      unread: number
      read: number
      unconfirmed: number
      byType: Record<string, { total: number; unread: number }>
    }
  }>('/notifications/stats')
}
