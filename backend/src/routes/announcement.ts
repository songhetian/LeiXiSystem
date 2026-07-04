import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, validateData } from '../utils/validation'
import { sendAndPushBatchNotifications } from '../services/websocket'

const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().max(10000).optional().nullable(),
  type: z.enum(['notice', 'announcement', 'urgent']).optional().default('notice'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  targetType: z.enum(['all', 'department', 'role', 'tag', 'custom']).optional().default('all'),
  targetConfig: z.object({
    departmentIds: z.array(positiveIntSchema).optional(),
    roleIds: z.array(positiveIntSchema).optional(),
    tagIds: z.array(positiveIntSchema).optional(),
    userIds: z.array(positiveIntSchema).optional(),
  }).optional(),
  status: z.enum(['draft', 'published']).optional().default('published'),
})

const announcementUpdateSchema = announcementCreateSchema.partial()

export default async function announcementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/announcements', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      type?: string
      status?: string
      keyword?: string
    }
  }>) => {
    const { page, pageSize, skip, take } = normalizePagination(request.query)
    const { type, status, keyword } = request.query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (keyword) where.title = { contains: keyword }

    const [total, list] = await Promise.all([
      prisma.systemAnnouncement.count({ where }),
      prisma.systemAnnouncement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, realName: true } },
        },
      }),
    ])

    return {
      code: 0,
      data: { list, total, page, pageSize },
    }
  })

  fastify.get('/announcements/mine', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      type?: string
      isRead?: boolean
    }
  }>) => {
    const { page, pageSize, skip, take } = normalizePagination(request.query)
    const { type, isRead } = request.query
    const userId = request.user.id

    const publishedWhere: any = { status: 'published' }
    if (type) publishedWhere.type = type

    const announcements = await prisma.systemAnnouncement.findMany({
      where: publishedWhere,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, realName: true } },
        reads: { where: { userId }, select: { readAt: true } },
      },
    })

    const total = await prisma.systemAnnouncement.count({ where: publishedWhere })

    const list = announcements.map(a => ({
      ...a,
      isRead: a.reads.length > 0,
      readAt: a.reads[0]?.readAt,
      reads: undefined,
    }))

    const unreadCount = await prisma.systemAnnouncement.count({
      where: {
        ...publishedWhere,
        NOT: { reads: { some: { userId } } },
      },
    })

    return {
      code: 0,
      data: { list, total, page, pageSize, unreadCount },
    }
  })

  fastify.get('/announcements/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const announcement = await prisma.systemAnnouncement.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, realName: true } },
      },
    })

    if (!announcement) {
      return reply.status(404).send({ code: 404, message: '公告不存在' })
    }

    return { code: 0, data: announcement }
  })

  fastify.post('/announcements/:id/read', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const userId = request.user.id

    const existing = await prisma.announcementRead.findUnique({
      where: { announcementId_userId: { announcementId: id, userId } },
    })

    if (!existing) {
      await prisma.announcementRead.create({
        data: { announcementId: id, userId },
      })
      await prisma.systemAnnouncement.update({
        where: { id },
        data: { readCount: { increment: 1 } },
      })
    }

    return { code: 0, message: '已读' }
  })

  fastify.post('/announcements', { preHandler: [requirePermission('announcement:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(announcementCreateSchema, request.body)

    const targetUsers = await getTargetUsers(body.targetType || 'all', body.targetConfig)

    const announcement = await prisma.systemAnnouncement.create({
      data: {
      title: body.title,
      content: body.content,
      type: body.type,
      priority: body.priority,
      targetType: body.targetType,
      targetConfig: body.targetConfig ? JSON.stringify(body.targetConfig) : null,
      status: body.status,
      createdById: request.user.id,
      totalReceivers: targetUsers.length,
      publishedAt: body.status === 'published' ? new Date() : null,
    },
    })

    if (body.status === 'published' && targetUsers.length > 0) {
      const notifications = targetUsers.map(userId => ({
        userId,
        title: `[${getTypeName(body.type || 'notice')}] ${body.title}`,
        content: body.content?.slice(0, 100) || '',
        type: 'system' as const,
        relatedId: announcement.id,
        relatedType: 'announcement',
      }))
      sendAndPushBatchNotifications(notifications).catch(() => {})
    }

    return { code: 0, message: '创建成功', data: { ...announcement, targetCount: targetUsers.length } }
  })

  fastify.put('/announcements/:id', { preHandler: [requirePermission('announcement:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(announcementUpdateSchema, request.body)

    const existing = await prisma.systemAnnouncement.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '公告不存在' })
    }

    const updateData: any = { ...body }
    if (body.targetConfig) {
      updateData.targetConfig = JSON.stringify(body.targetConfig)
    }

    const announcement = await prisma.systemAnnouncement.update({
      where: { id },
      data: updateData,
    })

    return { code: 0, message: '更新成功', data: announcement }
  })

  fastify.delete('/announcements/:id', { preHandler: [requirePermission('announcement:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.systemAnnouncement.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '公告不存在' })
    }

    await prisma.systemAnnouncement.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  fastify.get('/announcements/:id/stats', { preHandler: [requirePermission('announcement:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const announcement = await prisma.systemAnnouncement.findUnique({ where: { id } })
    if (!announcement) {
      return reply.status(404).send({ code: 404, message: '公告不存在' })
    }

    const readCount = announcement.readCount
    const total = announcement.totalReceivers
    const unreadCount = Math.max(0, total - readCount)
    const readRate = total > 0 ? Math.round((readCount / total) * 100) : 0

    return {
      code: 0,
      data: {
        totalReceivers: total,
        readCount,
        unreadCount,
        readRate,
      },
    }
  })

  fastify.get('/stats/summary', { preHandler: [requirePermission('announcement:manage')] }, async () => {
    const [total, published, totalNotices, totalReads] = await Promise.all([
      prisma.systemAnnouncement.count(),
      prisma.systemAnnouncement.count({ where: { status: 'published' } }),
      prisma.notification.count(),
      prisma.announcementRead.count(),
    ])

    return {
      code: 0,
      data: {
        totalAnnouncements: total,
        publishedAnnouncements: published,
        totalNotifications: totalNotices,
        totalReads,
      },
    }
  })
}

async function getTargetUsers(targetType: string, targetConfig?: {
  departmentIds?: number[]
  roleIds?: number[]
  tagIds?: number[]
  userIds?: number[]
}): Promise<number[]> {
  switch (targetType) {
    case 'all': {
      const users = await prisma.user.findMany({
        where: { status: 'active' },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    case 'department': {
      if (!targetConfig?.departmentIds?.length) return []
      const users = await prisma.user.findMany({
        where: {
          status: 'active',
          departmentId: { in: targetConfig.departmentIds },
        },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    case 'role': {
      if (!targetConfig?.roleIds?.length) return []
      const userRoles = await prisma.userRole.findMany({
        where: {
          roleId: { in: targetConfig.roleIds },
          user: { status: 'active' },
        },
        select: { userId: true },
        distinct: ['userId'],
      })
      return userRoles.map(ur => ur.userId)
    }
    case 'custom': {
      if (!targetConfig?.userIds?.length) return []
      const users = await prisma.user.findMany({
        where: {
          id: { in: targetConfig.userIds },
          status: 'active',
        },
        select: { id: true },
      })
      return users.map(u => u.id)
    }
    case 'tag': {
      if (!targetConfig?.tagIds?.length) return []
      const assignments = await prisma.employeeTagAssignment.findMany({
        where: { tagId: { in: targetConfig.tagIds } },
        select: { employee: { select: { userId: true } } },
        distinct: ['employeeId'],
      })
      const userIds = assignments
        .map(a => a.employee.userId)
        .filter((id): id is number => id != null)
      return [...new Set(userIds)]
    }
    default:
      return []
  }
}

function getTypeName(type: string): string {
  const map: Record<string, string> = {
    notice: '通知',
    announcement: '公告',
    urgent: '紧急',
  }
  return map[type] || '通知'
}
