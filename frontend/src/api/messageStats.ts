import { get } from './request'

export function getMessageStatsOverview() {
  return get<{
    code: number
    data: {
      totalSent: number
      totalRead: number
      unread: number
      readRate: number
      byType: Array<{ type: string; count: number }>
      byPriority: Array<{ priority: string; count: number }>
    }
  }>('/message-stats/overview')
}

export function getMessageStatsByTime(params: {
  startDate: string
  endDate: string
  groupBy?: 'day' | 'week' | 'month'
  type?: string
}) {
  return get<{
    code: number
    data: {
      list: Array<{
        date: string
        sent: number
        read: number
        readRate: number
      }>
    }
  }>('/message-stats/by-time', { params })
}

export function getMessageStatsBySender(params?: {
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  return get<{
    code: number
    data: {
      total: number
      list: Array<{
        senderId: number
        senderName: string
        senderAvatar?: string
        taskCount: number
        totalSent: number
        totalRead: number
      }>
      page: number
      pageSize: number
    }
  }>('/message-stats/by-sender', { params })
}

export function getUserMessageStats() {
  return get<{
    code: number
    data: {
      total: number
      unread: number
      read: number
      byType: Record<string, { total: number; unread: number }>
      byPriority: Array<{ priority: string; count: number }>
    }
  }>('/message-stats/user')
}
