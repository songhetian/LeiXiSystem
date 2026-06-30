import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { getAccessibleHelpdeskTicket } from '../services/objectAuthorization'
import { enqueueNotification, enqueueNotifications } from '../plugins/notification'
import { normalizePagination } from '../utils/pagination'
import { HttpError, dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'
import { helpdeskTicketStatusSchema, helpdeskPrioritySchema } from '../utils/schemas'
import type { AuthUser } from '../types/fastify'

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '分类编码只能包含字母、数字、下划线和横线'),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
})

const ticketListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  categoryId: z.coerce.number().int().positive().optional(),
  status: helpdeskTicketStatusSchema,
  priority: helpdeskPrioritySchema,
  assignedTo: z.coerce.number().int().positive().optional(),
  onlyMine: z.coerce.boolean().optional().default(false),
})

const ticketCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  categoryId: positiveIntSchema,
  priority: helpdeskPrioritySchema.optional().default('medium'),
  employeeId: positiveIntSchema.optional().nullable(),
  sourceType: z.string().trim().max(50).optional().nullable(),
  sourceId: positiveIntSchema.optional().nullable(),
})

const ticketUpdateSchema = z.object({
  status: helpdeskTicketStatusSchema,
  assignedTo: positiveIntSchema.optional().nullable(),
  priority: helpdeskPrioritySchema,
  resolution: z.string().trim().max(1000).optional().nullable(),
  slaDeadline: dateStringSchema.optional().nullable(),
  feedbackRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const commentSchema = z.object({
  content: z.string().trim().min(1).max(3000),
  isInternal: z.coerce.boolean().optional().default(false),
})

async function getTicketWithAccess(user: AuthUser, ticketId: number, canHandle: boolean) {
  const ticket = await getAccessibleHelpdeskTicket(
    user,
    () => prisma.helpdeskTicket.findUnique({
      where: { id: ticketId },
      include: {
        category: true,
        creator: { select: { id: true, realName: true } },
        assignee: { select: { id: true, realName: true } },
        employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
        comments: {
          where: canHandle ? {} : { isInternal: false },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { realName: true } } },
        },
      },
    }),
    (item) => item.id,
  )

  if (!ticket) throw new HttpError(404, '工单不存在')
  return ticket
}

function buildTicketNo() {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `HD-${date}-${now.getTime().toString().slice(-6)}`
}

export default async function helpdeskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/categories', { preHandler: [requireAnyPermission(['helpdesk:view', 'helpdesk:handle', 'helpdesk:manage'])] }, async () => {
    const list = await prisma.helpdeskCategory.findMany({
      where: { status: { not: 'deleted' } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
    })
    return { code: 0, data: list }
  })

  fastify.post('/categories', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(categorySchema, request.body)
    setAudit(request, { action: 'helpdesk.category.create', module: 'helpdesk', requestData: body })
    const category = await prisma.helpdeskCategory.create({ data: body })
    setAfter(request, { id: category.id })
    return { code: 0, message: '创建成功', data: category }
  })

  fastify.delete('/categories/:id', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const category = await prisma.helpdeskCategory.findUnique({ where: { id } })
    if (!category) return { code: 404, message: '分类不存在' }

    const ticketCount = await prisma.helpdeskTicket.count({ where: { categoryId: id } })
    if (ticketCount > 0) {
      return { code: 400, message: '该分类下有工单，无法删除' }
    }

    await prisma.helpdeskCategory.delete({ where: { id } })
    setAudit(request, {
      action: 'helpdesk.category.delete',
      module: 'helpdesk',
      beforeData: { id, name: category.name },
      requestData: { id },
    })
    return { code: 0, message: '删除成功' }
  })

  fastify.get('/tickets', { preHandler: [requireAnyPermission(['helpdesk:view', 'helpdesk:handle'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(ticketListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const canHandle = hasPermission(request, 'helpdesk:handle')
    const where: any = {}

    if (!canHandle || query.onlyMine) {
      where.OR = [{ createdBy: request.user.id }, { assignedTo: request.user.id }]
    }
    if (query.categoryId) where.categoryId = query.categoryId
    if (query.status) where.status = query.status
    if (query.priority) where.priority = query.priority
    if (query.assignedTo) where.assignedTo = query.assignedTo
    if (query.keyword) {
      where.AND = [
        ...(where.AND || []),
        { OR: [{ ticketNo: { contains: query.keyword } }, { title: { contains: query.keyword } }] },
      ]
    }

    const [total, list] = await Promise.all([
      prisma.helpdeskTicket.count({ where }),
      prisma.helpdeskTicket.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          creator: { select: { realName: true } },
          assignee: { select: { realName: true } },
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/tickets', { preHandler: [requirePermission('helpdesk:view')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(ticketCreateSchema, request.body)
    setAudit(request, { action: 'helpdesk.ticket.create', module: 'helpdesk', requestData: body })
    const ticket = await prisma.helpdeskTicket.create({
      data: {
        ...body,
        employeeId: body.employeeId ?? undefined,
        sourceId: body.sourceId ?? undefined,
        ticketNo: buildTicketNo(),
        createdBy: request.user.id,
      },
    })
    setAfter(request, { id: ticket.id, ticketNo: ticket.ticketNo })

    // 通知所有有处理权限的人
    const handlers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: { permission: { code: 'helpdesk:handle' } },
              },
            },
          },
        },
        status: 'active',
      },
      select: { id: true },
    })
    const notifications = handlers.map((handler) => ({
      userId: handler.id,
      title: '新的工单待处理',
      content: `工单 ${ticket.ticketNo}：${body.title}`,
      type: 'task' as const,
      relatedId: ticket.id,
      relatedType: 'helpdesk_ticket' as const,
    }))
    enqueueNotifications(request, notifications)

    return { code: 0, message: '提交成功', data: ticket }
  })

  fastify.get('/tickets/:id', { preHandler: [requireAnyPermission(['helpdesk:view', 'helpdesk:handle'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const ticket = await getTicketWithAccess(request.user, id, hasPermission(request, 'helpdesk:handle'))
    return { code: 0, data: ticket }
  })

  fastify.put('/tickets/:id', { preHandler: [requirePermission('helpdesk:handle')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(ticketUpdateSchema, request.body)
    setAudit(request, { action: 'helpdesk.ticket.update', module: 'helpdesk', requestData: { id, ...body } })

    const existingTicket = await getAccessibleHelpdeskTicket(
      request.user,
      () => prisma.helpdeskTicket.findUnique({ where: { id } }),
      (item) => item.id,
    )

    if (!existingTicket) {
      return { code: 404, message: '工单不存在' }
    }

    const statusDates: Record<string, Date> = {}
    if (body.status === 'resolved') statusDates.resolvedAt = new Date()
    if (body.status === 'closed') statusDates.closedAt = new Date()

    captureBefore(request, existingTicket)
    const ticket = await prisma.helpdeskTicket.update({
      where: { id },
      data: {
        ...body,
        assignedTo: body.assignedTo ?? undefined,
        ...statusDates,
      },
    })
    setAfter(request, { id: ticket.id })

    // 通知创建人状态变更
    if (body.status && ticket.createdBy && ticket.createdBy !== request.user.id) {
      const statusText: Record<string, string> = {
        processing: '处理中',
        resolved: '已解决',
        closed: '已关闭',
        cancelled: '已取消',
      }
      enqueueNotification(request, {
        userId: ticket.createdBy,
        title: '工单状态已更新',
        content: `工单 ${ticket.ticketNo} 状态更新为 ${statusText[body.status] || body.status}`,
        type: 'system',
        relatedId: ticket.id,
        relatedType: 'helpdesk_ticket',
      })
    }

    // 通知被分配人
    if (body.assignedTo && body.assignedTo !== request.user.id) {
      enqueueNotification(request, {
        userId: body.assignedTo,
        title: '工单分配通知',
        content: `您被分配处理工单 ${ticket.ticketNo}：${ticket.title}`,
        type: 'task',
        relatedId: ticket.id,
        relatedType: 'helpdesk_ticket',
      })
    }

    return { code: 0, message: '更新成功', data: ticket }
  })

  fastify.post('/tickets/:id/comments', { preHandler: [requireAnyPermission(['helpdesk:view', 'helpdesk:handle'])] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(commentSchema, request.body)
    const canHandle = hasPermission(request, 'helpdesk:handle')
    await getTicketWithAccess(request.user, id, canHandle)

    if (body.isInternal && !canHandle) {
      throw new HttpError(403, '只有工单处理人可以添加内部备注')
    }

    const comment = await prisma.helpdeskTicketComment.create({
      data: {
        ticketId: id,
        userId: request.user.id,
        content: body.content,
        isInternal: body.isInternal,
      },
    })

    // 非内部评论通知对方
    if (!body.isInternal) {
      const ticket = await prisma.helpdeskTicket.findUnique({
        where: { id },
        select: { createdBy: true, assignedTo: true, ticketNo: true, title: true },
      })
      if (ticket) {
        const notifyUsers: number[] = []
        if (ticket.createdBy && ticket.createdBy !== request.user.id) notifyUsers.push(ticket.createdBy)
        if (ticket.assignedTo && ticket.assignedTo !== request.user.id) notifyUsers.push(ticket.assignedTo)
        const notifications = notifyUsers.map((uid) => ({
          userId: uid,
          title: '工单有新回复',
          content: `工单 ${ticket.ticketNo} 有新回复`,
          type: 'task' as const,
          relatedId: id,
          relatedType: 'helpdesk_ticket' as const,
        }))
        enqueueNotifications(request, notifications)
      }
    }

    return { code: 0, message: '回复成功', data: comment }
  })

  // 批量分配工单
  fastify.post('/tickets/batch-assign', { preHandler: [requirePermission('helpdesk:handle')] }, async (request: FastifyRequest<{
    Body: { ids: number[]; assignedTo: number }
  }>) => {
    const { ids, assignedTo } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个工单'),
      assignedTo: positiveIntSchema,
    }), request.body)

    const tickets = await prisma.helpdeskTicket.findMany({
      where: { id: { in: ids }, status: { in: ['open', 'processing'] } },
      select: { id: true, ticketNo: true, title: true },
    })

    let successCount = 0
    for (const ticket of tickets) {
      try {
        await prisma.helpdeskTicket.update({
          where: { id: ticket.id },
          data: {
            assignedTo,
            status: 'processing',
          },
        })
        enqueueNotification(request, {
          userId: assignedTo,
          title: '工单分配通知',
          content: `您被分配处理工单 ${ticket.ticketNo}：${ticket.title}`,
          type: 'task',
          relatedId: ticket.id,
          relatedType: 'helpdesk_ticket',
        })
        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    return { code: 0, message: `成功分配 ${successCount} 个工单`, data: { successCount, total: ids.length } }
  })

  // 批量解决工单
  fastify.post('/tickets/batch-resolve', { preHandler: [requirePermission('helpdesk:handle')] }, async (request: FastifyRequest<{
    Body: { ids: number[]; resolution?: string }
  }>) => {
    const { ids, resolution } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个工单'),
      resolution: z.string().max(1000).optional(),
    }), request.body)

    const tickets = await prisma.helpdeskTicket.findMany({
      where: { id: { in: ids }, status: { in: ['open', 'processing'] } },
      select: { id: true, createdBy: true, ticketNo: true },
    })

    let successCount = 0
    for (const ticket of tickets) {
      try {
        await prisma.helpdeskTicket.update({
          where: { id: ticket.id },
          data: {
            status: 'resolved',
            resolvedAt: new Date(),
            resolution: resolution || '已批量解决',
          },
        })
        if (ticket.createdBy && ticket.createdBy !== request.user.id) {
          enqueueNotification(request, {
            userId: ticket.createdBy,
            title: '工单已解决',
            content: `工单 ${ticket.ticketNo} 已解决`,
            type: 'system',
            relatedId: ticket.id,
            relatedType: 'helpdesk_ticket',
          })
        }
        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    return { code: 0, message: `成功解决 ${successCount} 个工单`, data: { successCount, total: ids.length } }
  })

  // 批量关闭工单
  fastify.post('/tickets/batch-close', { preHandler: [requirePermission('helpdesk:handle')] }, async (request: FastifyRequest<{
    Body: { ids: number[] }
  }>) => {
    const { ids } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个工单'),
    }), request.body)

    const tickets = await prisma.helpdeskTicket.findMany({
      where: { id: { in: ids }, status: { in: ['open', 'processing', 'resolved'] } },
      select: { id: true, createdBy: true, ticketNo: true },
    })

    let successCount = 0
    for (const ticket of tickets) {
      try {
        await prisma.helpdeskTicket.update({
          where: { id: ticket.id },
          data: {
            status: 'closed',
            closedAt: new Date(),
          },
        })
        if (ticket.createdBy && ticket.createdBy !== request.user.id) {
          enqueueNotification(request, {
            userId: ticket.createdBy,
            title: '工单已关闭',
            content: `工单 ${ticket.ticketNo} 已关闭`,
            type: 'system',
            relatedId: ticket.id,
            relatedType: 'helpdesk_ticket',
          })
        }
        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    return { code: 0, message: `成功关闭 ${successCount} 个工单`, data: { successCount, total: ids.length } }
  })
}
