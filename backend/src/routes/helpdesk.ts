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
import { generateCode } from '../utils/codeGenerator'
import type { AuthUser } from '../types/fastify'

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(50).regex(/^[a-zA-Z0-9_-]+$/, '分类编码只能包含字母、数字、下划线和横线').optional(),
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
    const code = body.code || await generateCode('helpdeskCategory', prisma.helpdeskCategory)
    const category = await prisma.helpdeskCategory.create({ data: { ...body, code } })
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

  // ══════════════════════════════════════════════
  // N5: 客户档案管理
  // ══════════════════════════════════════════════

  const customerBodySchema = z.object({
    name: z.string().trim().min(1).max(200),
    contactName: z.string().trim().max(100).optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().email().max(200).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    slaId: z.coerce.number().int().positive().optional().nullable(),
    tags: z.string().trim().max(500).optional().nullable(),
    status: statusSchema,
  })

  const customerUpdateSchema = z.object({
    name: z.string().trim().min(1).max(200).optional(),
    contactName: z.string().trim().max(100).optional().nullable(),
    phone: z.string().trim().max(30).optional().nullable(),
    email: z.string().trim().email().max(200).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    slaId: z.coerce.number().int().positive().optional().nullable(),
    tags: z.string().trim().max(500).optional().nullable(),
    status: statusSchema.optional(),
  })

  // GET /api/helpdesk/customers
  fastify.get('/customers', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; keyword?: string; status?: string }
  }>) => {
    const query = request.query as any
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = {}
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { contactName: { contains: query.keyword } },
        { phone: { contains: query.keyword } },
        { email: { contains: query.keyword } },
      ]
    }
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where, skip, take,
        include: { _count: { select: { tickets: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return { code: 0, data: { total, page, pageSize, list } }
  })

  // POST /api/helpdesk/customers
  fastify.post('/customers', { preHandler: [requirePermission('helpdesk:manage')] }, async (request) => {
    const body = validateData(customerBodySchema, request.body)
    const data = await prisma.customer.create({ data: body })
    return { code: 0, data }
  })

  // GET /api/helpdesk/customers/:id
  fastify.get('/customers/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { tickets: { orderBy: { createdAt: 'desc' }, take: 20 } },
    })
    if (!customer) throw new HttpError(404, '客户不存在')
    return { code: 0, data: customer }
  })

  // PUT /api/helpdesk/customers/:id
  fastify.put('/customers/:id', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(customerUpdateSchema, request.body)
    const data = await prisma.customer.update({ where: { id: id }, data: body })
    return { code: 0, data }
  })

  // DELETE /api/helpdesk/customers/:id
  fastify.delete('/customers/:id', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    await prisma.customer.delete({ where: { id: id } })
    return { code: 0, message: '删除成功' }
  })

  // GET /api/helpdesk/customers/:id/tickets
  fastify.get('/customers/:id/tickets', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { page?: number; pageSize?: number } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const query = normalizePagination(request.query as any)
    const [total, list] = await Promise.all([
      prisma.helpdeskTicket.count({ where: { customerId: id } }),
      prisma.helpdeskTicket.findMany({
        where: { customerId: id },
        skip: query.skip, take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return { code: 0, data: { total, page: query.page, pageSize: query.pageSize, list } }
  })

  // ══════════════════════════════════════════════
  // N8: 快捷回复模板
  // ══════════════════════════════════════════════

  const cannedResponseBodySchema = z.object({
    title: z.string().trim().min(1).max(100),
    content: z.string().trim().min(1),
    category: z.string().trim().max(50).optional().nullable(),
    isGlobal: z.coerce.boolean().optional().default(true),
    departmentId: z.coerce.number().int().positive().optional().nullable(),
    status: statusSchema,
  })

  const cannedResponseUpdateSchema = z.object({
    title: z.string().trim().min(1).max(100).optional(),
    content: z.string().trim().min(1).optional(),
    category: z.string().trim().max(50).optional().nullable(),
    isGlobal: z.coerce.boolean().optional(),
    departmentId: z.coerce.number().int().positive().optional().nullable(),
    status: statusSchema.optional(),
  })

  // GET /api/helpdesk/canned-responses
  fastify.get('/canned-responses', async (request: FastifyRequest<{
    Querystring: { keyword?: string; category?: string; status?: string }
  }>) => {
    const query = request.query as any
    const { skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.keyword) where.title = { contains: query.keyword }
    if (query.category) where.category = query.category
    if (query.status) where.status = query.status
    else where.status = 'active'

    const list = await prisma.cannedResponse.findMany({
      where,
      skip, take,
      orderBy: [{ usageCount: 'desc' }, { title: 'asc' }],
    })
    return { code: 0, data: { list } }
  })

  // POST /api/helpdesk/canned-responses
  fastify.post('/canned-responses', { preHandler: [requirePermission('helpdesk:manage')] }, async (request) => {
    const body = validateData(cannedResponseBodySchema, request.body)
    const userId = (request as any).user.id
    const data = await prisma.cannedResponse.create({ data: { ...body, createdBy: userId } })
    return { code: 0, data }
  })

  // PUT /api/helpdesk/canned-responses/:id
  fastify.put('/canned-responses/:id', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(cannedResponseUpdateSchema, request.body)
    const data = await prisma.cannedResponse.update({ where: { id: id }, data: body })
    return { code: 0, data }
  })

  // DELETE /api/helpdesk/canned-responses/:id
  fastify.delete('/canned-responses/:id', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    await prisma.cannedResponse.delete({ where: { id: id } })
    return { code: 0, message: '删除成功' }
  })

  // GET /api/helpdesk/canned-responses/search
  fastify.get('/canned-responses/search', async (request: FastifyRequest<{
    Querystring: { q: string }
  }>) => {
    const q = (request.query as any).q
    if (!q) return { code: 0, data: { list: [] } }
    const list = await prisma.cannedResponse.findMany({
      where: {
        status: 'active',
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      },
      orderBy: { usageCount: 'desc' },
      take: 20,
    })
    return { code: 0, data: { list } }
  })

  // ══════════════════════════════════════════════
  // N3: 满意度调查
  // ══════════════════════════════════════════════

  // POST /api/helpdesk/tickets/:id/satisfaction
  fastify.post('/tickets/:id/satisfaction', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = request.body as any

    const rating = parseInt(body.rating)
    if (!rating || rating < 1 || rating > 5) {
      throw new HttpError(400, '评分必须在 1-5 之间')
    }

    const ticket = await prisma.helpdeskTicket.findUnique({ where: { id: id } })
    if (!ticket) throw new HttpError(404, '工单不存在')
    if (!['resolved', 'closed'].includes(ticket.status)) {
      throw new HttpError(400, '只有已解决或已关闭的工单才能评价')
    }

    const updated = await prisma.helpdeskTicket.update({
      where: { id: id },
      data: {
        satisfactionRating: rating,
        satisfactionComment: body.comment || null,
        satisfactionSubmittedAt: new Date(),
      },
    })

    return { code: 0, data: updated, message: '感谢您的评价' }
  })

  // GET /api/helpdesk/satisfaction/stats
  fastify.get('/satisfaction/stats', async (request: FastifyRequest<{
    Querystring: { periodType?: string; startDate?: string; endDate?: string }
  }>) => {
    const query = request.query as any
    const periodType = query.periodType || 'monthly'
    const startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    const endDate = query.endDate ? new Date(query.endDate) : new Date()

    const tickets = await prisma.helpdeskTicket.findMany({
      where: {
        satisfactionRating: { not: null },
        satisfactionSubmittedAt: { gte: startDate, lte: endDate },
      },
      select: { satisfactionRating: true, assignedTo: true },
    })

    const total = tickets.length
    const avgRating = total > 0 ? tickets.reduce((s, t) => s + (t.satisfactionRating || 0), 0) / total : 0
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    tickets.forEach(t => {
      if (t.satisfactionRating) distribution[t.satisfactionRating]++
    })

    return {
      code: 0,
      data: { total, avgRating: Math.round(avgRating * 100) / 100, distribution, periodType, startDate, endDate },
    }
  })

  // ══════════════════════════════════════════════
  // G1: 工单分配引擎
  // ══════════════════════════════════════════════

  // GET /api/helpdesk/tickets/assignable-employees
  fastify.get('/tickets/assignable-employees', async (request) => {
    // 获取当前当班 + 已签到的员工
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const onDutyEmployees = await prisma.employee.findMany({
      where: {
        status: 'active',
        isOnduty: true,
      },
      select: {
        id: true,
        userId: true,
        maxTickets: true,
        user: { select: { realName: true } },
      },
    })

    // 获取每个员工的活跃工单数
    const activeTickets = await prisma.helpdeskTicket.groupBy({
      by: ['assignedTo'],
      where: {
        assignedTo: { not: null },
        status: { in: ['open', 'processing'] },
      },
      _count: { id: true },
    })

    const ticketCountMap = new Map<number, number>()
    activeTickets.forEach(t => {
      if (t.assignedTo) ticketCountMap.set(t.assignedTo, t._count.id)
    })

    const defaultMax = 5
    const result = onDutyEmployees
      .map(e => {
        const activeCount = ticketCountMap.get(e.userId) || 0
        const maxTickets = e.maxTickets || defaultMax
        return {
          employeeId: e.id,
          userId: e.userId,
          realName: e.user.realName,
          activeTickets: activeCount,
          maxTickets,
          available: activeCount < maxTickets,
        }
      })
      .sort((a, b) => a.activeTickets - b.activeTickets)

    return { code: 0, data: result }
  })

  // POST /api/helpdesk/tickets/:id/auto-assign
  fastify.post('/tickets/:id/auto-assign', { preHandler: [requirePermission('helpdesk:assign')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const ticket = await prisma.helpdeskTicket.findUnique({
      where: { id: id },
      include: { customer: { select: { slaId: true } } },
    })
    if (!ticket) throw new HttpError(404, '工单不存在')

    // 获取可分配坐席
    const { data } = await (fastify as any).inject({
      method: 'GET',
      url: '/api/helpdesk/tickets/assignable-employees',
      headers: request.headers,
    })

    const employees = JSON.parse(data.payload).data || []
    const available = employees.filter((e: any) => e.available)

    if (available.length === 0) {
      // 进入排队队列
      const priorityScore = calculatePriorityScore(ticket, null)
      await prisma.ticketQueue.create({
        data: {
          ticketId: id,
          priority: priorityScore,
          status: 'waiting',
        },
      })
      return { code: 0, message: '当前无可分配坐席，工单已加入排队队列', data: { queued: true, priorityScore } }
    }

    // 分配给活跃工单最少的坐席
    const assignee = available[0]
    const updated = await prisma.helpdeskTicket.update({
      where: { id: id },
      data: {
        assignedTo: assignee.userId,
        status: 'processing',
      },
    })

    return { code: 0, message: `已分配给 ${assignee.realName}`, data: updated }
  })

  // GET /api/helpdesk/tickets/queue-status
  fastify.get('/tickets/queue-status', async (request) => {
    const queueItems = await prisma.ticketQueue.findMany({
      where: { status: 'waiting' },
      orderBy: { priority: 'desc' },
    })

    const queueLength = queueItems.length
    const priorities = { high: 0, medium: 0, low: 0 }
    const now = new Date()
    let totalWaitMinutes = 0

    queueItems.forEach(q => {
      if (q.priority >= 80) priorities.high++
      else if (q.priority >= 40) priorities.medium++
      else priorities.low++
      totalWaitMinutes += (now.getTime() - q.queueTime.getTime()) / 60000
    })

    return {
      code: 0,
      data: {
        queueLength,
        avgWaitMinutes: queueLength > 0 ? Math.round(totalWaitMinutes / queueLength) : 0,
        priorities,
      },
    }
  })

  // ══════════════════════════════════════════════
  // G2: SLA 策略管理
  // ══════════════════════════════════════════════

  const slaBodySchema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional().nullable(),
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    priority: z.string().optional().nullable(),
    customerTier: z.string().optional().nullable(),
    responseTime: z.coerce.number().int().min(1),
    resolutionTime: z.coerce.number().int().min(1),
    workdaysOnly: z.coerce.boolean().optional().default(true),
    holidayListId: z.coerce.number().int().positive().optional().nullable(),
    pauseOnStatus: z.string().optional().nullable(),
    completeOnStatus: z.string().optional().nullable(),
    escalationEnabled: z.coerce.boolean().optional().default(true),
    escalationQueueThreshold: z.coerce.number().int().optional().default(5),
    escalationBreachMinutes: z.coerce.number().int().optional().default(30),
    status: statusSchema,
  })

  const slaUpdateSchema = z.object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    categoryId: z.coerce.number().int().positive().optional().nullable(),
    priority: z.string().optional().nullable(),
    customerTier: z.string().optional().nullable(),
    responseTime: z.coerce.number().int().min(1).optional(),
    resolutionTime: z.coerce.number().int().min(1).optional(),
    workdaysOnly: z.coerce.boolean().optional(),
    holidayListId: z.coerce.number().int().positive().optional().nullable(),
    pauseOnStatus: z.string().optional().nullable(),
    completeOnStatus: z.string().optional().nullable(),
    escalationEnabled: z.coerce.boolean().optional(),
    escalationQueueThreshold: z.coerce.number().int().optional(),
    escalationBreachMinutes: z.coerce.number().int().optional(),
    status: statusSchema.optional(),
  })

  // GET /api/helpdesk/slas
  fastify.get('/slas', async (request) => {
    const list = await prisma.helpdeskSLA.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    })
    return { code: 0, data: { list } }
  })

  // POST /api/helpdesk/slas
  fastify.post('/slas', { preHandler: [requirePermission('helpdesk:manage')] }, async (request) => {
    const body = validateData(slaBodySchema, request.body)
    const data = await prisma.helpdeskSLA.create({ data: body })
    return { code: 0, data }
  })

  // PUT /api/helpdesk/slas/:id
  fastify.put('/slas/:id', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(slaUpdateSchema, request.body)
    const data = await prisma.helpdeskSLA.update({ where: { id: id }, data: body })
    return { code: 0, data }
  })

  // DELETE /api/helpdesk/slas/:id
  fastify.delete('/slas/:id', { preHandler: [requirePermission('helpdesk:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    await prisma.helpdeskSLA.delete({ where: { id: id } })
    return { code: 0, message: '删除成功' }
  })

  // GET /api/helpdesk/tickets/:id/sla-status
  fastify.get('/tickets/:id/sla-status', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const ticket = await prisma.helpdeskTicket.findUnique({
      where: { id: id },
      select: {
        id: true, ticketNo: true, status: true,
        slaId: true, slaStatus: true, firstResponseDue: true,
        resolutionDue: true, firstRespondedAt: true, slaBreachAlertSent: true,
        createdAt: true,
      },
    })
    if (!ticket) throw new HttpError(404, '工单不存在')

    const now = new Date()
    let responseRemaining: number | null = null
    let resolutionRemaining: number | null = null

    if (ticket.firstResponseDue && !ticket.firstRespondedAt) {
      responseRemaining = Math.max(0, (ticket.firstResponseDue.getTime() - now.getTime()) / 60000)
    }
    if (ticket.resolutionDue) {
      resolutionRemaining = Math.max(0, (ticket.resolutionDue.getTime() - now.getTime()) / 60000)
    }

    return {
      code: 0,
      data: {
        ...ticket,
        responseRemaining: responseRemaining ? Math.round(responseRemaining) : null,
        resolutionRemaining: resolutionRemaining ? Math.round(resolutionRemaining) : null,
      },
    }
  })
}

// ─── Helper Functions ───

function calculatePriorityScore(ticket: any, customer: any): number {
  const urgencyWeight = { urgent: 100, high: 70, medium: 40, low: 10 }[ticket.priority as string] || 40
  const vipWeight = customer?.slaId ? 100 : 50
  const waitWeight = 0 // 初始入队，无等待时间
  return vipWeight * 0.4 + urgencyWeight * 0.35 + waitWeight * 0.25
}
