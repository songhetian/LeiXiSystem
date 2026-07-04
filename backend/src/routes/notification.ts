import { FastifyInstance, FastifyRequest } from 'fastify'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { markAsConfirmed, getNotificationDetail } from '../services/notification'

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      type?: string
      isRead?: boolean
      priority?: string
      keyword?: string
    }
  }>) => {
    const { page = 1, pageSize = 10, type, isRead, priority, keyword } = request.query
    const userId = request.user.id

    const where: any = { userId }
    if (type) where.type = type
    if (isRead !== undefined) where.isRead = isRead
    if (priority) where.priority = priority
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { content: { contains: keyword } },
      ]
    }

    const [total, list] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          attachments: true,
        },
      }),
    ])

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    })

    const unconfirmedCount = await prisma.notification.count({
      where: { userId, requiresConfirm: true, confirmedAt: null },
    })

    return {
      code: 0,
      data: { list, total, page, pageSize, unreadCount, unconfirmedCount },
    }
  })

  fastify.get('/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const notification = await getNotificationDetail(
      request.user.id,
      parseInt(request.params.id)
    )

    if (!notification) {
      return { code: 404, message: '通知不存在' }
    }

    if (!notification.isRead) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: true, readAt: new Date() },
      })
    }

    return { code: 0, data: notification }
  })

  fastify.post('/:id/read', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = request.params

    await prisma.notification.update({
      where: { id: parseInt(id), userId: request.user.id },
      data: { isRead: true, readAt: new Date() },
    })

    return { code: 0, message: '已读' }
  })

  fastify.post('/:id/confirm', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    await markAsConfirmed(request.user.id, parseInt(request.params.id))
    return { code: 0, message: '确认成功' }
  })

  fastify.post('/read-all', async (request) => {
    await prisma.notification.updateMany({
      where: { userId: request.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    return { code: 0, message: '全部已读' }
  })

  fastify.get('/stats', async (request) => {
    const userId = request.user.id

    const [total, unread, typeStats, unconfirmedCount] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true },
      }),
      prisma.notification.count({
        where: { userId, requiresConfirm: true, confirmedAt: null },
      }),
    ])

    const typeStatsMap: Record<string, { total: number; unread: number }> = {}
    for (const t of typeStats) {
      typeStatsMap[t.type] = { total: t._count.type, unread: 0 }
    }

    const unreadByType = await prisma.notification.groupBy({
      by: ['type'],
      where: { userId, isRead: false },
      _count: { type: true },
    })
    for (const t of unreadByType) {
      if (typeStatsMap[t.type]) {
        typeStatsMap[t.type].unread = t._count.type
      }
    }

    return {
      code: 0,
      data: {
        total,
        unread,
        read: total - unread,
        unconfirmed: unconfirmedCount,
        byType: typeStatsMap,
      },
    }
  })
}
