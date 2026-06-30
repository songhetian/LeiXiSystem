import { get, post } from './request'

export interface Notification {
  id: number
  userId: number
  type: string
  title: string
  content: string
  isRead: boolean
  readAt?: string
  createdAt: string
  relatedId?: number
  relatedType?: string
}

export interface NotificationListResponse {
  code: 0
  data: {
    list: Notification[]
    total: number
    page: number
    pageSize: number
    unreadCount: number
  }
}

export function getNotificationList(params?: {
  page?: number
  pageSize?: number
  type?: string
  isRead?: boolean
}) {
  return get<NotificationListResponse>('/notifications', { params })
}

export function markNotificationRead(id: number) {
  return post(`/notification/${id}/read`)
}

export function markAllNotificationsRead() {
  return post('/notification/read-all')
}
