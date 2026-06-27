import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { writeAuditLog } from '../services/audit'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'
import { parseSafeHttpUrl } from '../utils/security'

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
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'closed']).default('draft'),
})

const openingSchema = z.object({
  requestId: positiveIntSchema.optional().nullable(),
  title: z.string().trim().min(1).max(200),
  departmentId: positiveIntSchema,
  positionId: positiveIntSchema.optional().nullable(),
  headcount: z.coerce.number().int().min(1).max(999).default(1),
  description: z.string().trim().max(3000).optional().nullable(),
  requirements: z.string().trim().max(3000).optional().nullable(),
  status: z.enum(['draft', 'open', 'paused', 'closed']).default('open'),
})

const candidateSchema = z.object({
  jobOpeningId: positiveIntSchema,
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email().max(100).optional().nullable(),
  source: z.string().trim().max(50).optional().nullable(),
  resumeUrl: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['new', 'screening', 'interviewing', 'offered', 'hired', 'rejected']).default('new'),
  rating: z.coerce.number().int().min(0).max(5).default(0),
  note: z.string().trim().max(2000).optional().nullable(),
})

const interviewSchema = z.object({
  candidateId: positiveIntSchema,
  roundName: z.string().trim().min(1).max(100),
  interviewAt: z.string().optional().nullable(),
  interviewerId: positiveIntSchema.optional().nullable(),
  result: z.enum(['pending', 'passed', 'failed', 'cancelled']).default('pending'),
  feedback: z.string().trim().max(3000).optional().nullable(),
})

const offerSchema = z.object({
  candidateId: positiveIntSchema,
  salary: z.coerce.number().min(0).max(99999999).optional().nullable(),
  startDate: dateStringSchema.optional().nullable(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'cancelled']).default('draft'),
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
    const record = await prisma.recruitmentRequest.create({
      data: { ...body, positionId: body.positionId ?? undefined, createdBy: request.user.id },
    })
    await writeAuditLog(request, { action: 'recruitment_request_create', module: 'recruitment', requestData: body, responseData: { id: record.id } })
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
    const record = await prisma.jobOpening.create({
      data: {
        ...body,
        requestId: body.requestId ?? undefined,
        positionId: body.positionId ?? undefined,
        publishedAt: body.status === 'open' ? new Date() : undefined,
        createdBy: request.user.id,
      },
    })
    await writeAuditLog(request, { action: 'job_opening_create', module: 'recruitment', requestData: body, responseData: { id: record.id } })
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

    await writeAuditLog(request, { action: 'offer_accept', module: 'recruitment', requestData: { id }, responseData: { id: updated.id } })
    return { code: 0, message: employeeId ? 'Offer 已接受并生成入职准备事件' : 'Offer 已接受', data: updated }
  })
}
