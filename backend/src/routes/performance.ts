import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safePartial } from '../utils/validation'
import { performanceReviewStatusSchema, performanceCycleStatusSchema, promotionRecommendationSchema, goalStatusSchema } from '../utils/schemas'

const listQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  status: performanceReviewStatusSchema,
  cycleId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
})

const cycleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  cycleType: z.enum(['month', 'quarter', 'half_year', 'year']).default('quarter'),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  status: performanceCycleStatusSchema,
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
  status: goalStatusSchema,
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
  developmentPlan: z.string().trim().max(1000).optional().nullable(),
  promotionRecommendation: promotionRecommendationSchema,
  status: performanceReviewStatusSchema,
  items: z.array(reviewItemSchema).max(20).optional().default([]),
})

const reviewUpdateSchema = partialUpdateSchema(reviewSchema.omit({ cycleId: true, employeeId: true }))

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
    setAudit(request, { action: 'performance.cycle.create', module: 'performance', requestData: body })
    const cycle = await prisma.performanceCycle.create({
      data: {
        ...body,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        createdBy: request.user.id,
      },
    })
    setAfter(request, { id: cycle.id })
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
    setAudit(request, { action: 'performance_review_create', module: 'performance', requestData: body })
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
        developmentPlan: body.developmentPlan,
        promotionRecommendation: body.promotionRecommendation,
        status: body.status,
        createdBy: request.user.id,
        items: { create: body.items },
      },
      include: { items: true },
    })
    setAfter(request, { id: review.id })
    return { code: 0, message: '创建成功', data: review }
  })

  fastify.put('/reviews/:id', { preHandler: [requireAnyPermission(['performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(reviewUpdateSchema, request.body)
    requireAtLeastOneField(data)
    setAudit(request, { action: 'performance.review.update', module: 'performance', requestData: { id, ...data } })
    const review = await prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.performanceReviewItem.deleteMany({ where: { reviewId: id } })
      }
      return tx.performanceReview.update({
        where: { id },
        data: {
          reviewerId: data.reviewerId ?? undefined,
          selfScore: data.selfScore ?? undefined,
          managerScore: data.managerScore ?? undefined,
          finalScore: data.finalScore ?? undefined,
          rating: data.rating || calcRating(data.finalScore),
          selfComment: data.selfComment,
          managerComment: data.managerComment,
          developmentPlan: data.developmentPlan,
          promotionRecommendation: data.promotionRecommendation,
          status: data.status,
          submittedAt: data.status === 'self_submitted' ? new Date() : undefined,
          reviewedAt: data.status === 'reviewed' ? new Date() : undefined,
          items: data.items ? { create: data.items } : undefined,
        },
        include: { items: true },
      })
    })
    setAfter(request, { id: review.id })
    return { code: 0, message: '更新成功', data: review }
  })

  // ===== 绩效周期详情/更新/删除 =====

  fastify.get('/cycles/:id', { preHandler: [requireAnyPermission(['performance:view', 'performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const cycle = await prisma.performanceCycle.findUnique({
      where: { id },
      include: { _count: { select: { goals: true, reviews: true } } },
    })
    if (!cycle) return { code: 404, message: '绩效周期不存在' }
    return { code: 0, data: cycle }
  })

  fastify.put('/cycles/:id', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const updateSchema = safePartial(cycleSchema)
    const body = validateData(updateSchema, request.body)
    setAudit(request, { action: 'performance_cycle_update', module: 'performance', requestData: body })
    const existing = await prisma.performanceCycle.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '绩效周期不存在' }
    captureBefore(request, existing)
    const updated = await prisma.performanceCycle.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      },
    })
    setAfter(request, { id: updated.id })
    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/cycles/:id', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.performanceCycle.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '绩效周期不存在' }
    setAudit(request, { action: 'performance_cycle_delete', module: 'performance', requestData: { id }, beforeData: existing })
    await prisma.performanceCycle.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  // 启用绩效周期
  fastify.post('/cycles/:id/activate', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const cycle = await prisma.performanceCycle.findUnique({ where: { id } })
    if (!cycle) return { code: 404, message: '绩效周期不存在' }
    if (cycle.status === 'active') return { code: 400, message: '绩效周期已启用' }

    setAudit(request, { action: 'performance.cycle.activate', module: 'performance', requestData: { id } })

    const updated = await prisma.performanceCycle.update({
      where: { id },
      data: { status: 'active' },
    })
    return { code: 0, message: '绩效周期已启用', data: updated }
  })

  // 关闭绩效周期
  fastify.post('/cycles/:id/close', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const cycle = await prisma.performanceCycle.findUnique({ where: { id } })
    if (!cycle) return { code: 404, message: '绩效周期不存在' }
    if (cycle.status === 'closed') return { code: 400, message: '绩效周期已关闭' }

    setAudit(request, { action: 'performance.cycle.close', module: 'performance', requestData: { id } })

    const updated = await prisma.performanceCycle.update({
      where: { id },
      data: { status: 'closed' },
    })
    return { code: 0, message: '绩效周期已关闭', data: updated }
  })

  // ===== 绩效目标详情/更新/删除 =====

  fastify.get('/goals/:id', { preHandler: [requireAnyPermission(['performance:view', 'performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const goal = await prisma.performanceGoal.findUnique({
      where: { id },
      include: { cycle: true, employee: { select: { employeeNo: true, user: { select: { realName: true } } } } },
    })
    if (!goal) return { code: 404, message: '绩效目标不存在' }
    return { code: 0, data: goal }
  })

  fastify.put('/goals/:id', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const updateSchema = goalSchema.omit({ cycleId: true, employeeId: true }).partial()
    const body = validateData(updateSchema, request.body)
    setAudit(request, { action: 'performance.goal.create', module: 'performance', requestData: body })
    const existing = await prisma.performanceGoal.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '绩效目标不存在' }
    captureBefore(request, existing)
    const updated = await prisma.performanceGoal.update({ where: { id }, data: body })
    setAfter(request, { id: updated.id })
    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/goals/:id', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.performanceGoal.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '绩效目标不存在' }
    setAudit(request, { action: 'performance_goal_delete', module: 'performance', requestData: { id }, beforeData: existing })
    await prisma.performanceGoal.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  // ===== 绩效评审详情 =====

  fastify.get('/reviews/:id', { preHandler: [requireAnyPermission(['performance:view', 'performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const review = await prisma.performanceReview.findUnique({
      where: { id },
      include: {
        cycle: true,
        employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
        reviewer: { select: { realName: true } },
        items: true,
        creator: { select: { realName: true } },
      },
    })
    if (!review) return { code: 404, message: '绩效评审不存在' }
    return { code: 0, data: review }
  })

  // 导出绩效结果
  fastify.post('/reviews/export', { preHandler: [requireAnyPermission(['performance:view', 'performance:manage', 'performance:review'])] }, async (request: FastifyRequest<{
    Body: {
      cycleId?: number
      departmentId?: number
      status?: string
      fields?: string[]
    }
  }>) => {
    const body = request.body as any
    const { cycleId, departmentId, status, fields = [] } = body || {}

    const where: any = {}
    if (cycleId) where.cycleId = cycleId
    if (status) where.status = status
    if (departmentId) where.employee = { departmentId }

    const reviews = await prisma.performanceReview.findMany({
      where,
      select: {
        id: true,
        finalScore: true,
        finalRating: true,
        status: true,
        reviewDate: true,
        cycle: { select: { name: true, startDate: true, endDate: true } },
        employee: {
          select: {
            employeeNo: true,
            department: { select: { name: true } },
            user: { select: { realName: true } },
          },
        },
        reviewer: { select: { realName: true } },
      },
      orderBy: { id: 'desc' },
    })

    const rows = reviews.map((r: any) => ({
      cycleName: r.cycle?.name || '-',
      cyclePeriod: r.cycle ? `${new Date(r.cycle.startDate).toISOString().split('T')[0]} ~ ${new Date(r.cycle.endDate).toISOString().split('T')[0]}` : '-',
      employeeNo: r.employee?.employeeNo || '-',
      employeeName: r.employee?.user?.realName || '-',
      department: r.employee?.department?.name || '-',
      reviewer: r.reviewer?.realName || '-',
      finalScore: r.finalScore != null ? Number(r.finalScore).toFixed(1) : '-',
      finalRating: r.finalRating || '-',
      status: r.status === 'draft' ? '草稿' : r.status === 'submitted' ? '已提交' : r.status === 'completed' ? '已完成' : r.status,
      reviewDate: r.reviewDate ? new Date(r.reviewDate).toISOString().split('T')[0] : '-',
    }))

    return {
      code: 0,
      message: `共 ${rows.length} 条数据`,
      data: {
        filename: `绩效结果_${new Date().toISOString().split('T')[0]}.xlsx`,
        fields: fields.length > 0 ? fields : ['cycleName', 'cyclePeriod', 'employeeNo', 'employeeName', 'department', 'reviewer', 'finalScore', 'finalRating', 'status', 'reviewDate'],
        rows,
      },
    }
  })
}
