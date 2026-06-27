import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { writeAuditLog } from '../services/audit'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'
import { parseSafeHttpUrl } from '../utils/security'

const listQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  status: statusSchema,
  courseId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
})

const courseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '课程编码只能包含字母、数字、下划线和横线'),
  category: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(3000).optional().nullable(),
  durationHours: z.coerce.number().min(0).max(9999).optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
})

const sessionSchema = z.object({
  courseId: positiveIntSchema,
  title: z.string().trim().min(1).max(200),
  startTime: z.string().datetime().or(z.string().min(1)),
  endTime: z.string().optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  capacity: z.coerce.number().int().min(1).max(99999).optional().nullable(),
  instructorId: positiveIntSchema.optional().nullable(),
  status: z.enum(['planned', 'open', 'completed', 'cancelled']).default('planned'),
}).refine((value) => !value.endTime || new Date(value.startTime) <= new Date(value.endTime), {
  message: '开始时间不能晚于结束时间',
})

const enrollSchema = z.object({
  sessionId: positiveIntSchema,
  employeeId: positiveIntSchema,
})

const completeSchema = z.object({
  score: z.coerce.number().min(0).max(100).optional(),
  certificateUrl: z.string().trim().max(500).optional(),
})

export default async function trainingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/courses', { preHandler: [requireAnyPermission(['training:view', 'training:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.status) where.status = query.status
    if (query.keyword) where.OR = [{ title: { contains: query.keyword } }, { code: { contains: query.keyword } }]
    const [total, list] = await Promise.all([
      prisma.trainingCourse.count({ where }),
      prisma.trainingCourse.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { _count: { select: { sessions: true } } } }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/courses', { preHandler: [requirePermission('training:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(courseSchema, request.body)
    const course = await prisma.trainingCourse.create({ data: { ...body, createdBy: request.user.id } })
    await writeAuditLog(request, { action: 'training_course_create', module: 'training', requestData: body, responseData: { id: course.id } })
    return { code: 0, message: '创建成功', data: course }
  })

  fastify.get('/sessions', { preHandler: [requireAnyPermission(['training:view', 'training:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.courseId) where.courseId = query.courseId
    if (query.status) where.status = query.status
    if (query.keyword) where.title = { contains: query.keyword }
    const [total, list] = await Promise.all([
      prisma.trainingSession.count({ where }),
      prisma.trainingSession.findMany({
        where,
        skip,
        take,
        orderBy: { startTime: 'desc' },
        include: { course: true, instructor: { select: { realName: true } }, _count: { select: { enrollments: true } } },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/sessions', { preHandler: [requirePermission('training:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(sessionSchema, request.body)
    const session = await prisma.trainingSession.create({
      data: {
        ...body,
        startTime: new Date(body.startTime),
        endTime: body.endTime ? new Date(body.endTime) : undefined,
        instructorId: body.instructorId ?? undefined,
        createdBy: request.user.id,
      },
    })
    await writeAuditLog(request, { action: 'training_session_create', module: 'training', requestData: body, responseData: { id: session.id } })
    return { code: 0, message: '创建成功', data: session }
  })

  fastify.get('/enrollments', { preHandler: [requireAnyPermission(['training:view', 'training:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(listQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status
    const [total, list] = await Promise.all([
      prisma.trainingEnrollment.count({ where }),
      prisma.trainingEnrollment.findMany({
        where,
        skip,
        take,
        orderBy: { enrolledAt: 'desc' },
        include: { session: { include: { course: true } }, employee: { select: { employeeNo: true, user: { select: { realName: true } } } } },
      }),
    ])
    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/enrollments', { preHandler: [requirePermission('training:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(enrollSchema, request.body)
    const enrollment = await prisma.trainingEnrollment.create({ data: body })
    return { code: 0, message: '报名成功', data: enrollment }
  })

  fastify.post('/enrollments/:id/complete', { preHandler: [requirePermission('training:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(completeSchema, request.body || {})
    const enrollment = await prisma.trainingEnrollment.update({
      where: { id },
      data: {
        status: 'completed',
        score: body.score,
        certificateUrl: body.certificateUrl ? parseSafeHttpUrl(body.certificateUrl, { allowPrivateHosts: true }) : undefined,
        completedAt: new Date(),
      },
    })
    await writeAuditLog(request, { action: 'training_enrollment_complete', module: 'training', requestData: { id, ...body }, responseData: { id } })
    return { code: 0, message: '已完成培训', data: enrollment }
  })
}
