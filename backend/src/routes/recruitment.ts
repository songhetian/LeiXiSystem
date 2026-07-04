import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'
import { parseSafeHttpUrl } from '../utils/security'
import { candidateStatusSchema, jobRequestStatusSchema, jobOpeningStatusSchema, interviewResultSchema, offerStatusSchema, helpdeskPrioritySchema } from '../utils/schemas'

const listQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  status: statusSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  jobOpeningId: z.coerce.number().int().positive().optional(),
})

const requestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  departmentId: positiveIntSchema,
  positionId: positiveIntSchema.optional().nullable(),
  headcount: z.coerce.number().int().min(1).max(999).default(1),
  reason: z.string().trim().max(2000).optional().nullable(),
  priority: helpdeskPrioritySchema,
  status: jobRequestStatusSchema,
})

const openingSchema = z.object({
  requestId: positiveIntSchema.optional().nullable(),
  title: z.string().trim().min(1).max(200),
  departmentId: positiveIntSchema,
  positionId: positiveIntSchema.optional().nullable(),
  headcount: z.coerce.number().int().min(1).max(999).default(1),
  description: z.string().trim().max(3000).optional().nullable(),
  requirements: z.string().trim().max(3000).optional().nullable(),
  status: jobOpeningStatusSchema,
})

const candidateSchema = z.object({
  jobOpeningId: positiveIntSchema,
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(100).optional().nullable(),
  source: z.string().trim().max(50).optional().nullable(),
  resumeUrl: z.string().trim().max(500).optional().nullable(),
  status: candidateStatusSchema,
  rating: z.coerce.number().int().min(0).max(5).default(0),
  note: z.string().trim().max(2000).optional().nullable(),
})

const interviewSchema = z.object({
  candidateId: positiveIntSchema,
  roundName: z.string().trim().min(1).max(100),
  interviewAt: z.string().optional().nullable(),
  interviewerId: positiveIntSchema.optional().nullable(),
  result: interviewResultSchema,
  feedback: z.string().trim().max(3000).optional().nullable(),
})

const offerSchema = z.object({
  candidateId: positiveIntSchema,
  salary: z.coerce.number().min(0).max(99999999).optional().nullable(),
  startDate: dateStringSchema.optional().nullable(),
  status: offerStatusSchema,
})

const acceptOfferSchema = z.object({
  employeeId: positiveIntSchema.optional(),
})

function buildOfferNo() {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `OF-${date}-${now.getTime().toString().slice(-6)}`
}

export default async function recruitmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/requests', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.keyword) where.title = { contains: query.keyword }
    const [total, list] = await Promise.all([
      prisma.recruitmentRequest.count({ where }),
      prisma.recruitmentRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { department: true, position: true, creator: { select: { realName: true } } },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/requests', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(requestSchema, request.body)
    setAudit(request, { action: 'recruitment.request.create', module: 'recruitment', requestData: body })
    const record = await prisma.recruitmentRequest.create({
      data: { ...body, positionId: body.positionId ?? undefined, createdBy: request.user.id },
    })
    setAfter(request, { id: record.id })
    return { code: 0, message: '创建成功', data: record }
  })

  fastify.get('/openings', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.keyword) where.title = { contains: query.keyword }
    const [total, list] = await Promise.all([
      prisma.jobOpening.count({ where }),
      prisma.jobOpening.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { department: true, position: true, _count: { select: { candidates: true } } },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/openings', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(openingSchema, request.body)
    setAudit(request, { action: 'recruitment.opening.create', module: 'recruitment', requestData: body })
    const record = await prisma.jobOpening.create({
      data: {
        ...body,
        requestId: body.requestId ?? undefined,
        positionId: body.positionId ?? undefined,
        publishedAt: body.status === 'open' ? new Date() : undefined,
        createdBy: request.user.id,
      },
    })
    setAfter(request, { id: record.id })
    return { code: 0, message: '创建成功', data: record }
  })

  fastify.get('/candidates', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.jobOpeningId) where.jobOpeningId = query.jobOpeningId
    if (query.keyword) where.OR = [{ name: { contains: query.keyword } }, { phone: { contains: query.keyword } }, { email: { contains: query.keyword } }]
    const [total, list] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { jobOpening: { select: { title: true } }, _count: { select: { interviews: true, offers: true } } },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/candidates', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(candidateSchema, request.body)
    const record = await prisma.candidate.create({
      data: {
        ...body,
        resumeUrl: body.resumeUrl ? parseSafeHttpUrl(body.resumeUrl, { allowPrivateHosts: true }) : undefined,
        createdBy: request.user.id,
      },
    })
    return { code: 0, message: '创建成功', data: record }
  })

  fastify.post('/interviews', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(interviewSchema, request.body)
    const record = await prisma.interviewRound.create({
      data: {
        ...body,
        interviewAt: body.interviewAt ? new Date(body.interviewAt) : undefined,
        interviewerId: body.interviewerId ?? undefined,
      },
    })
    await prisma.candidate.update({ where: { id: body.candidateId }, data: { status: 'interviewing' } })
    return { code: 0, message: '创建成功', data: record }
  })

  fastify.post('/offers', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(offerSchema, request.body)
    const record = await prisma.offer.create({
      data: {
        ...body,
        offerNo: buildOfferNo(),
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        createdBy: request.user.id,
      },
    })
    await prisma.candidate.update({ where: { id: body.candidateId }, data: { status: 'offered' } })
    return { code: 0, message: '创建成功', data: record }
  })

  fastify.post('/offers/:id/accept', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { employeeId } = validateData(acceptOfferSchema, request.body || {})
    const offer = await prisma.offer.findUnique({
      where: { id },
      include: { candidate: { include: { jobOpening: true } } },
    })
    if (!offer) return { code: 404, message: 'Offer 不存在' }

    setAudit(request, { action: 'offer_accept', module: 'recruitment', requestData: { id } })
    captureBefore(request, offer)
    const updated = await prisma.$transaction(async (tx) => {
      const accepted = await tx.offer.update({
        where: { id },
        data: { status: 'accepted', acceptedAt: new Date() },
      })
      await tx.candidate.update({ where: { id: offer.candidateId }, data: { status: 'hired' } })
      if (employeeId) {
        await tx.employeeLifecycleEvent.create({
          data: {
            employeeId,
            eventType: 'onboarding',
            title: `${offer.candidate.name} 录用入职准备`,
            description: `候选人已接受 Offer，职位：${offer.candidate.jobOpening.title}。`,
            effectiveDate: offer.startDate || new Date(),
            status: 'pending',
            createdBy: request.user.id,
          },
        })
      }
      return accepted
    })

    setAfter(request, { id: updated.id })
    return { code: 0, message: employeeId ? 'Offer 已接受并生成入职准备事件' : 'Offer 已接受', data: updated }
  })

  // ===== 招聘需求详情/更新/删除 =====

  fastify.get('/requests/:id', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const record = await prisma.recruitmentRequest.findUnique({
      where: { id },
      include: { department: true, position: true, creator: { select: { realName: true } } },
    })
    if (!record) return { code: 404, message: '招聘需求不存在' }
    return { code: 0, data: record }
  })

  fastify.put('/requests/:id', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const updateSchema = requestSchema.omit({}).partial()
    const body = validateData(updateSchema, request.body)
    const existing = await prisma.recruitmentRequest.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '招聘需求不存在' }
    setAudit(request, { action: 'recruitment_request_update', module: 'recruitment', requestData: body })
    captureBefore(request, existing)
    const updated = await prisma.recruitmentRequest.update({
      where: { id },
      data: { ...body, positionId: body.positionId !== undefined ? (body.positionId ?? null) : undefined },
    })
    setAfter(request, { id: updated.id })
    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/requests/:id', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.recruitmentRequest.findUnique({
      where: { id },
      include: { _count: { select: { jobOpenings: true } } },
    })
    if (!existing) return { code: 404, message: '招聘需求不存在' }
    if (existing._count.jobOpenings > 0) {
      return { code: 400, message: '该招聘需求下有职位，无法删除' }
    }
    if (existing.status === 'approved' || existing.status === 'submitted') {
      return { code: 400, message: '已审批或已提交的招聘需求无法删除' }
    }
    setAudit(request, { action: 'recruitment_request_delete', module: 'recruitment', requestData: { id }, beforeData: existing })
    await prisma.recruitmentRequest.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  // ===== 职位详情/更新/删除 =====

  fastify.get('/openings/:id', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const record = await prisma.jobOpening.findUnique({
      where: { id },
      include: { department: true, position: true, creator: { select: { realName: true } }, _count: { select: { candidates: true } } },
    })
    if (!record) return { code: 404, message: '职位不存在' }
    return { code: 0, data: record }
  })

  fastify.put('/openings/:id', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const updateSchema = openingSchema.omit({}).partial()
    const body = validateData(updateSchema, request.body)
    const existing = await prisma.jobOpening.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '职位不存在' }
    setAudit(request, { action: 'job_opening_update', module: 'recruitment', requestData: body })
    captureBefore(request, existing)
    const updated = await prisma.jobOpening.update({
      where: { id },
      data: {
        ...body,
        requestId: body.requestId !== undefined ? (body.requestId ?? null) : undefined,
        positionId: body.positionId !== undefined ? (body.positionId ?? null) : undefined,
        publishedAt: body.status === 'open' && existing.status !== 'open' ? new Date() : undefined,
      },
    })
    setAfter(request, { id: updated.id })
    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/openings/:id', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.jobOpening.findUnique({
      where: { id },
      include: { _count: { select: { candidates: true } } },
    })
    if (!existing) return { code: 404, message: '职位不存在' }
    if (existing._count.candidates > 0) {
      return { code: 400, message: '该职位下有候选人，无法删除' }
    }
    if (existing.status === 'open') {
      return { code: 400, message: '开放中的职位无法删除，请先关闭' }
    }
    setAudit(request, { action: 'job_opening_delete', module: 'recruitment', requestData: { id }, beforeData: existing })
    await prisma.jobOpening.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  // ===== 候选人详情/更新/删除 =====

  fastify.get('/candidates/:id', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const record = await prisma.candidate.findUnique({
      where: { id },
      include: {
        jobOpening: { select: { title: true, department: { select: { name: true } } } },
        interviews: { orderBy: { createdAt: 'asc' }, include: { interviewer: { select: { realName: true } } } },
        offers: { orderBy: { createdAt: 'desc' } },
        creator: { select: { realName: true } },
      },
    })
    if (!record) return { code: 404, message: '候选人不存在' }
    return { code: 0, data: record }
  })

  fastify.put('/candidates/:id', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const updateSchema = candidateSchema.omit({}).partial()
    const body = validateData(updateSchema, request.body)
    const existing = await prisma.candidate.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '候选人不存在' }
    setAudit(request, { action: 'candidate_update', module: 'recruitment', requestData: body })
    captureBefore(request, existing)
    const updated = await prisma.candidate.update({
      where: { id },
      data: {
        ...body,
        resumeUrl: body.resumeUrl !== undefined ? (body.resumeUrl ? parseSafeHttpUrl(body.resumeUrl, { allowPrivateHosts: true }) : null) : undefined,
      },
    })
    setAfter(request, { id: updated.id })
    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/candidates/:id', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.candidate.findUnique({
      where: { id },
      include: {
        _count: { select: { interviews: true, offers: true } },
        offers: { where: { status: 'accepted' } },
      },
    })
    if (!existing) return { code: 404, message: '候选人不存在' }
    if (existing.offers.some((o) => o.status === 'accepted')) {
      return { code: 400, message: '该候选人已有接受的 Offer，无法删除' }
    }
    if (existing._count.interviews > 0) {
      return { code: 400, message: '该候选人已有面试记录，无法删除' }
    }
    if (existing._count.offers > 0) {
      return { code: 400, message: '该候选人已有 Offer 记录，无法删除' }
    }
    if (existing.status === 'hired') {
      return { code: 400, message: '该候选人已被录用，无法删除' }
    }
    setAudit(request, { action: 'candidate_delete', module: 'recruitment', requestData: { id }, beforeData: existing })
    await prisma.candidate.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  // ===== 面试记录列表 =====

  fastify.get('/interviews', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.jobOpeningId) where.candidate = { jobOpeningId: query.jobOpeningId }
    if (query.keyword) where.candidate = { ...where.candidate, name: { contains: query.keyword } }
    if (query.status) where.result = query.status
    const [total, list] = await Promise.all([
      prisma.interviewRound.count({ where }),
      prisma.interviewRound.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          roundName: true,
          interviewAt: true,
          result: true,
          feedback: true,
          createdAt: true,
          candidate: { select: { id: true, name: true, phone: true, jobOpening: { select: { title: true } } } },
          interviewer: { select: { realName: true } },
        },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  // ===== Offer 列表 =====

  fastify.get('/offers', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.jobOpeningId) where.candidate = { jobOpeningId: query.jobOpeningId }
    if (query.keyword) where.candidate = { ...where.candidate, name: { contains: query.keyword } }
    const [total, list] = await Promise.all([
      prisma.offer.count({ where }),
      prisma.offer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          offerNo: true,
          salary: true,
          startDate: true,
          status: true,
          acceptedAt: true,
          createdAt: true,
          candidate: { select: { id: true, name: true, phone: true, jobOpening: { select: { title: true } } } },
        },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.get('/offers/:id', { preHandler: [requireAnyPermission(['recruitment:view', 'recruitment:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const record = await prisma.offer.findUnique({
      where: { id },
      include: {
        candidate: { select: { id: true, name: true, phone: true, jobOpening: { select: { title: true } } } },
        creator: { select: { realName: true } },
      },
    })
    if (!record) return { code: 404, message: 'Offer 不存在' }
    return { code: 0, data: record }
  })

  fastify.put('/offers/:id', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const updateSchema = offerSchema.omit({}).partial()
    const body = validateData(updateSchema, request.body)
    const existing = await prisma.offer.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: 'Offer 不存在' }
    setAudit(request, { action: 'offer_update', module: 'recruitment', requestData: body })
    captureBefore(request, existing)
    const updated = await prisma.offer.update({
      where: { id },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
      },
    })
    setAfter(request, { id: updated.id })
    return { code: 0, message: '更新成功', data: updated }
  })

  // 批量开启/关闭招聘需求
  fastify.post('/requests/batch-status', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { ids, status } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个招聘需求'),
      status: jobRequestStatusSchema,
    }), request.body)

    const { count } = await prisma.recruitmentRequest.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    setAudit(request, {
      module: 'recruitment',
      action: 'recruitment.request.batchStatusUpdate',
      requestData: { ids, status, count },
    })

    return {
      code: 0,
      message: `成功更新 ${count} 个招聘需求状态`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  // 批量开启/关闭职位空缺
  fastify.post('/openings/batch-status', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { ids, status } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个职位空缺'),
      status: jobOpeningStatusSchema,
    }), request.body)

    const { count } = await prisma.jobOpening.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        publishedAt: status === 'open' ? new Date() : undefined,
        closedAt: ['closed', 'filled'].includes(status) ? new Date() : undefined,
      },
    })

    setAudit(request, {
      module: 'recruitment',
      action: 'recruitment.opening.batchStatusUpdate',
      requestData: { ids, status, count },
    })

    return {
      code: 0,
      message: `成功更新 ${count} 个职位空缺状态`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  // 批量更新候选人状态
  fastify.post('/candidates/batch-status', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { ids, status } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个候选人'),
      status: candidateStatusSchema,
    }), request.body)

    const { count } = await prisma.candidate.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    setAudit(request, {
      module: 'recruitment',
      action: 'recruitment.candidate.batchStatusUpdate',
      requestData: { ids, status, count },
    })

    return {
      code: 0,
      message: `成功更新 ${count} 个候选人状态`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  // 开启招聘需求
  fastify.post('/requests/:id/open', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.recruitmentRequest.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '招聘需求不存在' }

    setAudit(request, { action: 'recruitment.request.open', module: 'recruitment', requestData: { id } })

    const updated = await prisma.recruitmentRequest.update({
      where: { id },
      data: { status: 'approved' },
    })
    return { code: 0, message: '招聘需求已开启', data: updated }
  })

  // 关闭招聘需求
  fastify.post('/requests/:id/close', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.recruitmentRequest.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '招聘需求不存在' }

    setAudit(request, { action: 'recruitment.request.close', module: 'recruitment', requestData: { id } })

    const updated = await prisma.recruitmentRequest.update({
      where: { id },
      data: { status: 'closed' },
    })
    return { code: 0, message: '招聘需求已关闭', data: updated }
  })

  // 开启职位空缺
  fastify.post('/openings/:id/open', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.jobOpening.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '职位空缺不存在' }

    setAudit(request, { action: 'recruitment.opening.open', module: 'recruitment', requestData: { id } })

    const updated = await prisma.jobOpening.update({
      where: { id },
      data: { status: 'open', publishedAt: existing.publishedAt || new Date() },
    })
    return { code: 0, message: '职位空缺已开启', data: updated }
  })

  // 关闭职位空缺
  fastify.post('/openings/:id/close', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.jobOpening.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '职位空缺不存在' }

    setAudit(request, { action: 'recruitment.opening.close', module: 'recruitment', requestData: { id } })

    const updated = await prisma.jobOpening.update({
      where: { id },
      data: { status: 'closed', closedAt: existing.closedAt || new Date() },
    })
    return { code: 0, message: '职位空缺已关闭', data: updated }
  })

  // 导出候选人列表
  fastify.post('/candidates/export', { preHandler: [requirePermission('recruitment:manage')] }, async (request: FastifyRequest<{
    Body: {
      status?: string
      departmentId?: number
      fields?: string[]
    }
  }>) => {
    const body = request.body as any
    const { status, departmentId, fields = [] } = body || {}

    const where: any = {}
    if (status) where.status = status

    const candidates = await prisma.candidate.findMany({
      where,
      select: {
        id: true,
        name: true,
        gender: true,
        phone: true,
        email: true,
        education: true,
        experience: true,
        status: true,
        source: true,
        appliedAt: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
      orderBy: { id: 'desc' },
    })

    const rows = candidates.map((c: any) => ({
      name: c.name || '-',
      gender: c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '-',
      phone: c.phone || '-',
      email: c.email || '-',
      education: c.education || '-',
      experience: c.experience || '-',
      department: c.department?.name || '-',
      position: c.position?.name || '-',
      status: c.status === 'new' ? '新增' : c.status === 'screening' ? '筛选中' : c.status === 'interview' ? '面试中' : c.status === 'offer' ? 'Offer' : c.status === 'hired' ? '已入职' : c.status === 'rejected' ? '已拒绝' : c.status,
      source: c.source || '-',
      appliedAt: c.appliedAt ? new Date(c.appliedAt).toISOString().split('T')[0] : '-',
    }))

    return {
      code: 0,
      message: `共 ${rows.length} 条数据`,
      data: {
        filename: `候选人列表_${new Date().toISOString().split('T')[0]}.xlsx`,
        fields: fields.length > 0 ? fields : ['name', 'gender', 'phone', 'email', 'education', 'experience', 'department', 'position', 'status', 'source', 'appliedAt'],
        rows,
      },
    }
  })
}
