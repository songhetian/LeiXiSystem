import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { writeAuditLog } from '../services/audit'
import { normalizePagination } from '../utils/pagination'
import { HttpError, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'

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
  status: statusSchema,
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedTo: z.coerce.number().int().positive().optional(),
  onlyMine: z.coerce.boolean().optional().default(false),
})

const ticketCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  categoryId: positiveIntSchema,
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  employeeId: positiveIntSchema.optional().nullable(),
  sourceType: z.string().trim().max(50).optional().nullable(),
  sourceId: positiveIntSchema.optional().nullable(),
})

const ticketUpdateSchema = z.object({
  status: z.enum(['open', 'processing', 'resolved', 'closed', 'cancelled']).optional(),
  assignedTo: positiveIntSchema.optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const commentSchema = z.object({
  content: z.string().trim().min(1).max(3000),
  isInternal: z.coerce.boolean().optional().default(false),
})

async function assertTicketAccess(ticketId: number, userId: number, canHandle: boolean) {
  const ticket = await prisma.helpdeskTicket.findUnique({
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
  })

  if (!ticket) throw new HttpError(404, '工单不存在')
  if (!canHandle && ticket.createdBy !== userId && ticket.assignedTo !== userId) {
    throw new HttpError(403, '没有权限访问该工单')
  }
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
    const category = await prisma.helpdeskCategory.create({ data: body })
    await writeAuditLog(request, {
      action: 'helpdesk_category_create',
      module: 'helpdesk',
      requestData: body,
      responseData: { id: category.id },
    })
    return { code: 0, message: '创建成功', data: category }
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
    const ticket = await prisma.helpdeskTicket.create({
      data: {
        ...body,
        employeeId: body.employeeId ?? undefined,
        sourceId: body.sourceId ?? undefined,
        ticketNo: buildTicketNo(),
        createdBy: request.user.id,
      },
    })

    await writeAuditLog(request, {
      action: 'helpdesk_ticket_create',
      module: 'helpdesk',
      requestData: body,
      responseData: { id: ticket.id, ticketNo: ticket.ticketNo },
    })

    return { code: 0, message: '提交成功', data: ticket }
  })

  fastify.get('/tickets/:id', { preHandler: [requireAnyPermission(['helpdesk:view', 'helpdesk:handle'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const ticket = await assertTicketAccess(id, request.user.id, hasPermission(request, 'helpdesk:handle'))
    return { code: 0, data: ticket }
  })

  fastify.put('/tickets/:id', { preHandler: [requirePermission('helpdesk:handle')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(ticketUpdateSchema, request.body)
    const statusDates: any = {}
    if (body.status === 'resolved') statusDates.resolvedAt = new Date()
    if (body.status === 'closed') statusDates.closedAt = new Date()

    const ticket = await prisma.helpdeskTicket.update({
      where: { id },
      data: {
        ...body,
        assignedTo: body.assignedTo ?? undefined,
        ...statusDates,
      },
    })

    await writeAuditLog(request, {
      action: 'helpdesk_ticket_update',
      module: 'helpdesk',
      requestData: { id, ...body },
      responseData: { id: ticket.id },
    })

    return { code: 0, message: '更新成功', data: ticket }
  })

  fastify.post('/tickets/:id/comments', { preHandler: [requireAnyPermission(['helpdesk:view', 'helpdesk:handle'])] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(commentSchema, request.body)
    const canHandle = hasPermission(request, 'helpdesk:handle')
    await assertTicketAccess(id, request.user.id, canHandle)

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

    return { code: 0, message: '回复成功', data: comment }
  })
}
