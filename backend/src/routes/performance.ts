import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { writeAuditLog } from '../services/audit'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'

const listQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  status: statusSchema,
  cycleId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
})

const cycleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  cycleType: z.enum(['month', 'quarter', 'half_year', 'year']).default('quarter'),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  status: z.enum(['draft', 'active', 'closed']).default('draft'),
}).refine((value) => new Date(value.startDate) <= new Date(value.endDate), {
  message: '开始日期不能晚于结束日期',
})

const goalSchema = z.object({
  cycleId: positiveIntSchema,
  employeeId: positiveIntSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  metric: z.string().trim().max(200).optional().nullable(),
  targetValue: z.coerce.number().min(0).max(99999999).optional().nullable(),
  weight: z.coerce.number().min(0).max(100).default(0),
  progress: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(['active', 'completed', 'cancelled']).default('active'),
})

const reviewItemSchema = z.object({
  dimension: z.string().trim().min(1).max(100),
  score: z.coerce.number().min(0).max(100),
  weight: z.coerce.number().min(0).max(100).default(0),
  comment: z.string().trim().max(1000).optional().nullable(),
})

const reviewSchema = z.object({
  cycleId: positiveIntSchema,
  employeeId: positiveIntSchema,
  reviewerId: positiveIntSchema.optional().nullable(),
  selfScore: z.coerce.number().min(0).max(100).optional().nullable(),
  managerScore: z.coerce.number().min(0).max(100).optional().nullable(),
  finalScore: z.coerce.number().min(0).max(100).optional().nullable(),
  rating: z.string().trim().max(30).optional().nullable(),
  selfComment: z.string().trim().max(2000).optional().nullable(),
  managerComment: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(['draft', 'self_submitted', 'reviewed', 'confirmed']).default('draft'),
  items: z.array(reviewItemSchema).max(20).optional().default([]),
})

const reviewUpdateSchema = reviewSchema.omit({ cycleId: true, employeeId: true }).partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

function calcRating(score?: number | null) {
  if (score == null) return undefined
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'E'
}

export default async function performanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/cycles', { preHandler: [requireAnyPermission(['performance:view', 'performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.keyword) where.name = { contains: query.keyword }
    const [total, list] = await Promise.all([
      prisma.performanceCycle.count({ where }),
      prisma.performanceCycle.findMany({ where, skip, take, orderBy: { startDate: 'desc' }, include: { _count: { select: { goals: true, reviews: true } } } }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/cycles', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(cycleSchema, request.body)
    const cycle = await prisma.performanceCycle.create({
      data: {
        ...body,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        createdBy: request.user.id,
      },
    })
    await writeAuditLog(request, { action: 'performance_cycle_create', module: 'performance', requestData: body, responseData: { id: cycle.id } })
    return { code: 0, message: '创建成功', data: cycle }
  })

  fastify.get('/goals', { preHandler: [requireAnyPermission(['performance:view', 'performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.cycleId) where.cycleId = query.cycleId
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status
    if (query.keyword) where.title = { contains: query.keyword }
    const [total, list] = await Promise.all([
      prisma.performanceGoal.count({ where }),
      prisma.performanceGoal.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { cycle: true, employee: { select: { employeeNo: true, user: { select: { realName: true } } } } },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/goals', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(goalSchema, request.body)
    const goal = await prisma.performanceGoal.create({ data: { ...body, createdBy: request.user.id } })
    return { code: 0, message: '创建成功', data: goal }
  })

  fastify.get('/reviews', { preHandler: [requireAnyPermission(['performance:view', 'performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const canReview = hasPermission(request, 'performance:review') || hasPermission(request, 'performance:manage')
    const where: any = {}
    if (!canReview) {
      const employee = await prisma.employee.findUnique({ where: { userId: request.user.id }, select: { id: true } })
      where.employeeId = employee?.id || -1
    }
    if (query.cycleId) where.cycleId = query.cycleId
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status
    const [total, list] = await Promise.all([
      prisma.performanceReview.count({ where }),
      prisma.performanceReview.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          cycle: true,
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          reviewer: { select: { realName: true } },
          items: true,
        },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/reviews', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(reviewSchema, request.body)
    const review = await prisma.performanceReview.create({
      data: {
        cycleId: body.cycleId,
        employeeId: body.employeeId,
        reviewerId: body.reviewerId ?? undefined,
        selfScore: body.selfScore ?? undefined,
        managerScore: body.managerScore ?? undefined,
        finalScore: body.finalScore ?? undefined,
        rating: body.rating || calcRating(body.finalScore),
        selfComment: body.selfComment,
        managerComment: body.managerComment,
        status: body.status,
        createdBy: request.user.id,
        items: { create: body.items },
      },
      include: { items: true },
    })
    await writeAuditLog(request, { action: 'performance_review_create', module: 'performance', requestData: body, responseData: { id: review.id } })
    return { code: 0, message: '创建成功', data: review }
  })

  fastify.put('/reviews/:id', { preHandler: [requireAnyPermission(['performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(reviewUpdateSchema, request.body)
    const review = await prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.performanceReviewItem.deleteMany({ where: { reviewId: id } })
      }
      return tx.performanceReview.update({
        where: { id },
        data: {
          reviewerId: body.reviewerId ?? undefined,
          selfScore: body.selfScore ?? undefined,
          managerScore: body.managerScore ?? undefined,
          finalScore: body.finalScore ?? undefined,
          rating: body.rating || calcRating(body.finalScore),
          selfComment: body.selfComment,
          managerComment: body.managerComment,
          status: body.status,
          submittedAt: body.status === 'self_submitted' ? new Date() : undefined,
          reviewedAt: body.status === 'reviewed' ? new Date() : undefined,
          items: body.items ? { create: body.items } : undefined,
        },
        include: { items: true },
      })
    })
    await writeAuditLog(request, { action: 'performance_review_update', module: 'performance', requestData: { id, ...body }, responseData: { id: review.id } })
    return { code: 0, message: '更新成功', data: review }
  })
}
