import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../../utils/validation'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { handleOffboardingCompletion, handleOnboardingCompletion } from './helpers'

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

const lifecycleEventUpdateSchema = lifecycleEventSchema.omit({ employeeId: true }).partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

export default async function eventsRoutes(fastify: FastifyInstance) {
  fastify.get('/events', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(eventListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.employeeId) {
      const access = await canAccessEmployee(request.user, query.employeeId, { allowSelf: true })
      if (!access) return { code: 403, message: '无权查看该员工的事件' }
      where.employeeId = query.employeeId
    }
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
        select: {
          id: true,
          employeeId: true,
          eventType: true,
          title: true,
          description: true,
          effectiveDate: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          creator: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.get('/events/:id', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const event = await prisma.employeeLifecycleEvent.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeNo: true, user: { select: { realName: true } } } },
        creator: { select: { realName: true } },
      },
    })
    if (!event) return { code: 404, message: '事件不存在' }

    const access = await canAccessEmployee(request.user, event.employeeId, { allowSelf: true })
    if (!access) return { code: 403, message: '无权查看该事件' }

    return { code: 0, data: event }
  })

  fastify.post('/events', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(lifecycleEventSchema, request.body)
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    setAudit(request, {
      action: 'lifecycle.event.create',
      module: 'lifecycle',
      requestData: body,
    })

    const event = await prisma.employeeLifecycleEvent.create({
      data: {
        ...body,
        effectiveDate: new Date(body.effectiveDate),
        createdBy: request.user.id,
      },
    })

    setAfter(request, { id: event.id })

    return { code: 0, message: '创建成功', data: event }
  })

  fastify.put('/events/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(lifecycleEventUpdateSchema, request.body)

    setAudit(request, {
      action: 'lifecycle.event.update',
      module: 'lifecycle',
      requestData: body,
    })

    const before = await prisma.employeeLifecycleEvent.findUnique({ where: { id }, select: { employeeId: true, status: true } })
    if (!before) return { code: 404, message: '事件不存在' }

    captureBefore(request, before)

    const updated = await prisma.employeeLifecycleEvent.update({
      where: { id },
      data: {
        ...body,
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : undefined,
      },
    })

    setAfter(request, updated)

    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/events/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const event = await prisma.employeeLifecycleEvent.findUnique({ where: { id } })
    if (!event) return { code: 404, message: '事件不存在' }
    if (event.status === 'completed') {
      return { code: 400, message: '已完成的生命周期事件无法删除' }
    }

    setAudit(request, {
      action: 'lifecycle.event.delete',
      module: 'lifecycle',
      requestData: { id },
      beforeData: event,
    })

    await prisma.employeeLifecycleEvent.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })

  fastify.post('/events/:id/complete', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    setAudit(request, {
      action: 'lifecycle.event.complete',
      module: 'lifecycle',
      requestData: { id },
    })

    const before = await prisma.employeeLifecycleEvent.findUnique({ where: { id } })
    if (!before) return { code: 404, message: '事件不存在' }

    captureBefore(request, before)

    const event = await prisma.employeeLifecycleEvent.update({
      where: { id },
      data: { status: 'completed' },
    })

    if (before.status !== 'completed') {
      if (before.eventType === 'offboarding') {
        await handleOffboardingCompletion(request, before.employeeId)
      } else if (before.eventType === 'onboarding') {
        await handleOnboardingCompletion(request, before.employeeId)
      }
    }

    setAfter(request, event)

    return { code: 0, message: '已完成', data: event }
  })
}
