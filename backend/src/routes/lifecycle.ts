import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { writeAuditLog } from '../services/audit'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, HttpError, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'
import { parseSafeHttpUrl } from '../utils/security'

const eventListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  eventType: z.string().trim().max(50).optional(),
  status: statusSchema,
  keyword: optionalKeywordSchema,
})

const lifecycleEventSchema = z.object({
  employeeId: positiveIntSchema,
  eventType: z.enum(['onboarding', 'probation', 'transfer', 'promotion', 'salary_adjustment', 'offboarding', 'rehire']),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  effectiveDate: dateStringSchema,
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).optional().default('pending'),
})

const taskListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  status: statusSchema,
})

const taskSchema = z.object({
  employeeId: positiveIntSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: dateStringSchema.optional().nullable(),
  assignedTo: positiveIntSchema.optional().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).optional().default('pending'),
})

const taskUpdateSchema = taskSchema.omit({ employeeId: true }).partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const documentSchema = z.object({
  employeeId: positiveIntSchema,
  name: z.string().trim().min(1).max(100),
  documentType: z.string().trim().min(1).max(50),
  fileUrl: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive', 'expired']).optional().default('active'),
  expiresAt: dateStringSchema.optional().nullable(),
})

const contractSchema = z.object({
  employeeId: positiveIntSchema,
  contractNo: z.string().trim().min(1).max(100),
  contractType: z.string().trim().min(1).max(50),
  startDate: dateStringSchema,
  endDate: dateStringSchema.optional().nullable(),
  status: z.enum(['active', 'inactive', 'expired', 'terminated']).optional().default('active'),
  fileUrl: z.string().trim().max(500).optional().nullable(),
}).refine((value) => !value.endDate || new Date(value.startDate) <= new Date(value.endDate), {
  message: '合同开始日期不能晚于结束日期',
})

function normalizeFileUrl(fileUrl?: string | null) {
  return fileUrl ? parseSafeHttpUrl(fileUrl, { allowPrivateHosts: true }) : undefined
}

async function ensureEmployee(employeeId: number) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employeeNo: true, user: { select: { realName: true } } },
  })
  if (!employee) {
    throw new HttpError(404, '员工不存在')
  }
  return employee
}

export default async function lifecycleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/events', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(eventListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.employeeId) where.employeeId = query.employeeId
    if (query.eventType) where.eventType = query.eventType
    if (query.status) where.status = query.status
    if (query.keyword) where.OR = [{ title: { contains: query.keyword } }, { description: { contains: query.keyword } }]

    const [total, list] = await Promise.all([
      prisma.employeeLifecycleEvent.count({ where }),
      prisma.employeeLifecycleEvent.findMany({
        where,
        skip,
        take,
        orderBy: { effectiveDate: 'desc' },
        include: {
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          creator: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/events', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(lifecycleEventSchema, request.body)
    await ensureEmployee(body.employeeId)

    const event = await prisma.employeeLifecycleEvent.create({
      data: {
        ...body,
        effectiveDate: new Date(body.effectiveDate),
        createdBy: request.user.id,
      },
    })

    await writeAuditLog(request, {
      action: 'lifecycle_event_create',
      module: 'lifecycle',
      requestData: body,
      responseData: { id: event.id },
    })

    return { code: 0, message: '创建成功', data: event }
  })

  fastify.post('/events/:id/complete', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const event = await prisma.employeeLifecycleEvent.update({
      where: { id },
      data: { status: 'completed' },
    })

    await writeAuditLog(request, {
      action: 'lifecycle_event_complete',
      module: 'lifecycle',
      requestData: { id },
      responseData: { id: event.id },
    })

    return { code: 0, message: '已完成', data: event }
  })

  fastify.get('/onboarding-tasks', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.onboardingTask.count({ where }),
      prisma.onboardingTask.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          assignee: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/onboarding-tasks', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(taskSchema, request.body)
    await ensureEmployee(body.employeeId)
    const task = await prisma.onboardingTask.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedTo: body.assignedTo ?? undefined,
        createdBy: request.user.id,
      },
    })

    return { code: 0, message: '创建成功', data: task }
  })

  fastify.put('/onboarding-tasks/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(taskUpdateSchema, request.body)
    const task = await prisma.onboardingTask.update({
      where: { id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedTo: body.assignedTo ?? undefined,
        completedAt: body.status === 'completed' ? new Date() : undefined,
      },
    })
    return { code: 0, message: '更新成功', data: task }
  })

  fastify.get('/offboarding-tasks', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.offboardingTask.count({ where }),
      prisma.offboardingTask.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          assignee: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/offboarding-tasks', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(taskSchema, request.body)
    await ensureEmployee(body.employeeId)
    const task = await prisma.offboardingTask.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedTo: body.assignedTo ?? undefined,
        createdBy: request.user.id,
      },
    })
    return { code: 0, message: '创建成功', data: task }
  })

  fastify.put('/offboarding-tasks/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(taskUpdateSchema, request.body)
    const task = await prisma.offboardingTask.update({
      where: { id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedTo: body.assignedTo ?? undefined,
        completedAt: body.status === 'completed' ? new Date() : undefined,
      },
    })
    return { code: 0, message: '更新成功', data: task }
  })

  fastify.get('/documents', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.employeeDocument.count({ where }),
      prisma.employeeDocument.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/documents', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(documentSchema, request.body)
    await ensureEmployee(body.employeeId)
    const document = await prisma.employeeDocument.create({
      data: {
        ...body,
        fileUrl: normalizeFileUrl(body.fileUrl),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })
    return { code: 0, message: '创建成功', data: document }
  })

  fastify.get('/contracts', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.employeeContract.count({ where }),
      prisma.employeeContract.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/contracts', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(contractSchema, request.body)
    await ensureEmployee(body.employeeId)
    const contract = await prisma.employeeContract.create({
      data: {
        ...body,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        fileUrl: normalizeFileUrl(body.fileUrl),
      },
    })
    return { code: 0, message: '创建成功', data: contract }
  })
}
