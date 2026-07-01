import prisma from '../prisma'

export async function getMessageStatsOverview() {
  const [totalSent, totalRead, byType, byPriority] = await Promise.all([
    prisma.notification.count(),
    prisma.notification.count({ where: { isRead: true } }),
    prisma.notification.groupBy({
      by: ['type'],
      _count: { type: true },
    }),
    prisma.notification.groupBy({
      by: ['priority'],
      _count: { priority: true },
    }),
  ])

  const unread = totalSent - totalRead
  const readRate = totalSent > 0 ? Math.round((totalRead / totalSent) * 100) : 0

  return {
    totalSent,
    totalRead,
    unread,
    readRate,
    byType: byType.map(item => ({
      type: item.type,
      count: item._count.type,
    })),
    byPriority: byPriority.map(item => ({
      priority: item.priority,
      count: item._count.priority,
    })),
  }
}

export async function getMessageStatsByTime(params: {
  startDate: string
  endDate: string
  groupBy?: 'day' | 'week' | 'month'
  type?: string
}) {
  const { startDate, endDate, type } = params

  const where: any = {
    createdAt: {
      gte: new Date(startDate),
      lte: new Date(endDate),
    },
  }
  if (type) where.type = type

  const notifications = await prisma.notification.findMany({
    where,
    select: { createdAt: true, isRead: true, type: true },
    orderBy: { createdAt: 'asc' },
  })

  const dayMap = new Map<string, { sent: number; read: number }>()

  for (const n of notifications) {
    const day = n.createdAt.toISOString().split('T')[0]
    if (!dayMap.has(day)) {
      dayMap.set(day, { sent: 0, read: 0 })
    }
    const data = dayMap.get(day)!
    data.sent++
    if (n.isRead) data.read++
  }

  const list = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date,
      sent: data.sent,
      read: data.read,
      readRate: data.sent > 0 ? Math.round((data.read / data.sent) * 100) : 0,
    }))

  return { list }
}

export async function getMessageStatsBySender(params: {
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}) {
  const { page = 1, pageSize = 20 } = params

  const tasks = await prisma.messageSendTask.findMany({
    where: {
      status: 'sent',
      ...(params.startDate ? { sentAt: { gte: new Date(params.startDate) } } : {}),
      ...(params.endDate ? { sentAt: { lte: new Date(params.endDate) } } : {}),
    },
    include: {
      createdBy: { select: { id: true, realName: true, avatar: true } },
    },
  })

  const senderMap = new Map<number, {
    senderId: number
    senderName: string
    senderAvatar: string | null
    taskCount: number
    totalSent: number
    totalRead: number
  }>()

  for (const task of tasks) {
    const senderId = task.createdById
    if (!senderMap.has(senderId)) {
      senderMap.set(senderId, {
        senderId,
        senderName: task.createdBy.realName,
        senderAvatar: task.createdBy.avatar,
        taskCount: 0,
        totalSent: 0,
        totalRead: 0,
      })
    }
    const data = senderMap.get(senderId)!
    data.taskCount++
    data.totalSent += task.sentCount
    data.totalRead += task.readCount
  }

  const list = Array.from(senderMap.values())
    .sort((a, b) => b.totalSent - a.totalSent)

  const total = list.length
  const paginated = list.slice((page - 1) * pageSize, page * pageSize)

  return { total, list: paginated, page, pageSize }
}

export async function getUserMessageStats(userId: number) {
  const [total, unread, byType, unreadByType, byPriority, unreadByPriority] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
    prisma.notification.groupBy({
      by: ['type'],
      where: { userId },
      _count: { type: true },
    }),
    prisma.notification.groupBy({
      by: ['type'],
      where: { userId, isRead: false },
      _count: { type: true },
    }),
    prisma.notification.groupBy({
      by: ['priority'],
      where: { userId },
      _count: { priority: true },
    }),
    prisma.notification.groupBy({
      by: ['priority'],
      where: { userId, isRead: false },
      _count: { priority: true },
    }),
  ])

  const typeStats: Record<string, { total: number; unread: number }> = {}
  for (const t of byType) {
    typeStats[t.type] = { total: t._count.type, unread: 0 }
  }
  for (const t of unreadByType) {
    if (typeStats[t.type]) {
      typeStats[t.type].unread = t._count.type
    }
  }

  const priorityStats: Record<string, { total: number; unread: number }> = {}
  for (const p of byPriority) {
    priorityStats[p.priority] = { total: p._count.priority, unread: 0 }
  }
  for (const p of unreadByPriority) {
    if (priorityStats[p.priority]) {
      priorityStats[p.priority].unread = p._count.priority
    }
  }

  return {
    total,
    unread,
    read: total - unread,
    byType: typeStats,
    byPriority: priorityStats,
  }
}
