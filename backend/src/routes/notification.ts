import { FastifyInstance, FastifyRequest } from 'fastify'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      type?: string
      isRead?: boolean
    }
  }>) => {
    const { page = 1, pageSize = 10, type, isRead } = request.query
    const userId = request.user.id

    const where: any = { userId }
    if (type) where.type = type
    if (isRead !== undefined) where.isRead = isRead

    const [total, list] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    })

    return {
      code: 0,
      data: { list, total, page, pageSize, unreadCount },
    }
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

  fastify.post('/read-all', async (request) => {
    await prisma.notification.updateMany({
      where: { userId: request.user.id, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    return { code: 0, message: '全部已读' }
  })

  fastify.get('/stats', async (request) => {
    const userId = request.user.id

    const [total, unread, typeStats] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true },
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
        byType: typeStatsMap,
      },
    }
  })
}
