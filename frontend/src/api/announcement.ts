import { get, post, put, del } from './request'

export interface Announcement {
  id: number
  title: string
  content: string
  type: string
  status: string
  priority: string
  targetType: string
  targetConfig?: any
  totalReceivers: number
  readCount: number
  createdById: number
  createdByName?: string
  publishedAt?: string
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export interface AnnouncementStats {
  totalReceivers: number
  readCount: number
  unreadCount: number
  readRate: number
}

export function getAnnouncements(params?: {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  keyword?: string
}) {
  return get('/announcements', { params })
}

export function getAnnouncement(id: number) {
  return get(`/announcements/${id}`)
}

export function createAnnouncement(data: {
  title: string
  content: string
  type?: string
  priority?: string
  targetType: string
  targetConfig?: any
  expiresAt?: string
}) {
  return post('/announcements', data)
}

export function updateAnnouncement(id: number, data: any) {
  return put(`/announcements/${id}`, data)
}

export function deleteAnnouncement(id: number) {
  return del(`/announcements/${id}`)
}

export function publishAnnouncement(id: number) {
  return post(`/announcements/${id}/publish`)
}

export function getAnnouncementStats(id: number) {
  return get<{ code: 0; data: AnnouncementStats }>(`/announcements/${id}/stats`)
}

export function getMyAnnouncements(params?: {
  page?: number
  pageSize?: number
  type?: string
  isRead?: boolean
}) {
  return get('/announcements/my', { params })
}

export function markAnnouncementRead(id: number) {
  return post(`/announcements/${id}/read`)
}
