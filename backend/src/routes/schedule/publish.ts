import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { setAudit } from '../../plugins/audit'
import { enqueueNotifications } from '../../plugins/notification'
import { idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

// 发布排班待确认
const publishSchema = z.object({
  departmentId: positiveIntSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// 确认排班
const confirmSchema = z.object({
  scheduleIds: z.array(positiveIntSchema).min(1),
  note: z.string().max(500).optional(),
})

// 申诉排班
const appealSchema = z.object({
  scheduleId: positiveIntSchema,
  reason: z.string().min(1).max(500),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expectedShiftId: positiveIntSchema.optional(),
})

// 处理申诉
const handleAppealSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  handlerNote: z.string().max(500).optional(),
})

// 查询参数
const querySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: z.enum(['pending', 'confirmed', 'appealed', 'auto_confirmed']).optional(),
  keyword: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function normalizePagination(query: any) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

export default async function schedulePublishRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // ============ 管理端 ============

  // 发布排班待确认
  fastify.post('/publish', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { departmentId, startDate, endDate } = validateData(publishSchema, request.body)

    const scheduleWhere: any = {
      scheduleDate: { gte: new Date(startDate), lte: new Date(endDate) },
    }
    if (departmentId) {
      scheduleWhere.employee = { user: { departmentId } }
    }

    // 获取所有待发布的排班
    const schedules = await prisma.schedule.findMany({
      where: scheduleWhere,
      include: {
        confirmation: { select: { id: true, status: true } },
      },
    })

    // 过滤已发布或有确认记录的
    const toPublish = schedules.filter((s) => !s.confirmation)

    if (toPublish.length === 0) {
      return { code: 400, message: '没有需要发布的排班' }
    }

    const periodStart = new Date(startDate)
    const periodEnd = new Date(endDate)

    // 批量创建确认记录
    await prisma.scheduleConfirmation.createMany({
      data: toPublish.map((s) => ({
        userId: s.userId,
        scheduleId: s.id,
        periodStart,
        periodEnd,
        status: 'pending',
      })),
    })

    setAudit(request, {
      action: 'schedule.publish',
      module: 'schedule',
      requestData: { departmentId, startDate, endDate, count: toPublish.length },
    })

    const notifications = toPublish.map((s) => ({
      userId: s.userId,
      title: '新排班待确认',
      content: `您有新的排班待确认，周期：${startDate} 至 ${endDate}`,
      type: 'system' as const,
      relatedId: s.id,
      relatedType: 'schedule',
    }))
    enqueueNotifications(request, notifications)

    return {
      code: 0,
      message: `已发布 ${toPublish.length} 条排班等待确认`,
      data: { count: toPublish.length },
    }
  })

  // 查询确认状态列表（管理端）
  fastify.get('/confirmations', { preHandler: [requirePermission('schedule:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(querySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.startDate) where.periodStart = { gte: new Date(query.startDate) }
    if (query.endDate) where.periodEnd = { lte: new Date(query.endDate) }
    if (query.keyword) {
      where.schedule = { employee: { user: { realName: { contains: query.keyword } } } }
    }

    const [total, list] = await Promise.all([
      prisma.scheduleConfirmation.count({ where }),
      prisma.scheduleConfirmation.findMany({
        where,
        skip,
        take,
        orderBy: [{ periodStart: 'desc' }, { id: 'desc' }],
        include: {
          user: { select: { id: true, realName: true, departmentId: true, department: { select: { name: true } } } },
          schedule: {
            select: {
              id: true,
              scheduleDate: true,
              shift: { select: { id: true, name: true, color: true, startTime: true, endTime: true } },
            },
          },
        },
      }),
    ])

    // 统计各状态数量
    const statusStats = await prisma.scheduleConfirmation.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { periodStart: where.periodStart, periodEnd: where.periodEnd },
    })

    return {
      code: 0,
      data: {
        list,
        total,
        page,
        pageSize,
        stats: Object.fromEntries(statusStats.map((s) => [s.status, s._count.id])),
      },
    }
  })

  // 查询申诉列表（管理端）
  fastify.get('/appeals', { preHandler: [requirePermission('schedule:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(querySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = {}
    if (query.status) where.status = query.status
    if (query.startDate) where.createdAt = { gte: new Date(query.startDate) }

    const [total, list] = await Promise.all([
      prisma.scheduleAppeal.count({ where }),
      prisma.scheduleAppeal.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: {
          user: { select: { id: true, realName: true, departmentId: true, department: { select: { name: true } } } },
          schedule: {
            select: {
              id: true,
              scheduleDate: true,
              shift: { select: { id: true, name: true, color: true, startTime: true, endTime: true } },
            },
          },
          handler: { select: { id: true, realName: true } },
          expectedShift: { select: { id: true, name: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 处理申诉
  fastify.put('/appeals/:id', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(handleAppealSchema, request.body)

    const appeal = await prisma.scheduleAppeal.findUnique({ where: { id } })
    if (!appeal) return { code: 404, message: '申诉不存在' }
    if (appeal.status !== 'pending') return { code: 400, message: '该申诉已处理' }

    const updated = await prisma.scheduleAppeal.update({
      where: { id },
      data: {
        status: body.status,
        handlerId: request.user.id,
        handlerNote: body.handlerNote,
        handledAt: new Date(),
      },
    })

    setAudit(request, {
      action: 'schedule.appeal.handle',
      module: 'schedule',
      requestData: { id, status: body.status },
    })

    return { code: 0, message: '处理成功', data: updated }
  })

  // 批量确认（管理端代确认）
  fastify.post('/confirm-batch', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { scheduleIds, note } = validateData(confirmSchema, request.body)

    await prisma.scheduleConfirmation.updateMany({
      where: { scheduleId: { in: scheduleIds }, status: { in: ['pending', 'appealed'] } },
      data: { status: 'confirmed', confirmAt: new Date(), note },
    })

    setAudit(request, {
      action: 'schedule.confirm.batch',
      module: 'schedule',
      requestData: { count: scheduleIds.length },
    })

    return { code: 0, message: `已确认 ${scheduleIds.length} 条` }
  })

  // 自动确认过期排班（定时任务）
  fastify.post('/auto-confirm', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 3) // 3天前未确认自动确认

    const result = await prisma.scheduleConfirmation.updateMany({
      where: {
        status: 'pending',
        periodEnd: { lt: cutoffDate },
      },
      data: { status: 'auto_confirmed', confirmAt: new Date() },
    })

    setAudit(request, {
      action: 'schedule.auto_confirm',
      module: 'schedule',
      requestData: { count: result.count },
    })

    return { code: 0, message: `自动确认 ${result.count} 条`, data: { count: result.count } }
  })

  // ============ 员工端 ============

  // 获取我的待确认排班
  fastify.get('/my/pending', async (request: FastifyRequest) => {
    const userId = request.user.id!

    const confirmations = await prisma.scheduleConfirmation.findMany({
      where: { userId, status: 'pending' },
      orderBy: { schedule: { scheduleDate: 'asc' } },
      include: {
        schedule: {
          include: {
            shift: true,
            employee: { select: { employeeNo: true } },
          },
        },
      },
    })

    // 按周期分组
    const grouped = confirmations.reduce((acc, c) => {
      const key = `${c.periodStart.toISOString().split('T')[0]}_${c.periodEnd.toISOString().split('T')[0]}`
      if (!acc[key]) acc[key] = { periodStart: c.periodStart, periodEnd: c.periodEnd, items: [] }
      acc[key].items.push(c)
      return acc
    }, {} as Record<string, any>)

    return { code: 0, data: Object.values(grouped) }
  })

  // 获取我的已确认排班
  fastify.get('/my/confirmed', async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const userId = request.user.id!
    const query = validateData(z.object({
      page: z.unknown().optional(),
      pageSize: z.unknown().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = { userId, status: { in: ['confirmed', 'auto_confirmed'] } }
    if (query.startDate) where.schedule = { ...where.schedule, scheduleDate: { gte: new Date(query.startDate) } }
    if (query.endDate) where.schedule = { ...where.schedule, scheduleDate: { ...where.schedule?.scheduleDate, lte: new Date(query.endDate) } }

    const [total, list] = await Promise.all([
      prisma.scheduleConfirmation.count({ where }),
      prisma.scheduleConfirmation.findMany({
        where,
        skip,
        take,
        orderBy: { schedule: { scheduleDate: 'desc' } },
        include: {
          schedule: {
            include: { shift: true },
          },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 确认排班（员工端）
  fastify.post('/my/confirm', async (request: FastifyRequest<{ Body: unknown }>) => {
    const userId = request.user.id!
    const { scheduleIds, note } = validateData(confirmSchema, request.body)

    const result = await prisma.scheduleConfirmation.updateMany({
      where: { userId, scheduleId: { in: scheduleIds }, status: 'pending' },
      data: { status: 'confirmed', confirmAt: new Date(), note },
    })

    return {
      code: 0,
      message: `成功确认 ${result.count} 条排班`,
      data: { count: result.count },
    }
  })

  // 一键确认本周
  fastify.post('/my/confirm-week', async (request: FastifyRequest) => {
    const userId = request.user.id!

    // 获取当前周的起止日期
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    const result = await prisma.scheduleConfirmation.updateMany({
      where: {
        userId,
        status: 'pending',
        periodStart: { lte: sunday },
        periodEnd: { gte: monday },
      },
      data: { status: 'confirmed', confirmAt: new Date() },
    })

    return {
      code: 0,
      message: `成功确认 ${result.count} 条排班`,
      data: { count: result.count },
    }
  })

  // 我的申诉记录
  fastify.get('/my/appeals', async (request: FastifyRequest) => {
    const userId = request.user.id!

    const appeals = await prisma.scheduleAppeal.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: {
        schedule: { include: { shift: true } },
        handler: { select: { realName: true } },
        expectedShift: { select: { name: true } },
      },
    })

    return { code: 0, data: appeals }
  })

  // 发起申诉
  fastify.post('/my/appeal', async (request: FastifyRequest<{ Body: unknown }>) => {
    const userId = request.user.id!
    const { scheduleId, reason, expectedDate, expectedShiftId } = validateData(appealSchema, request.body)

    // 验证排班属于该用户
    const schedule = await prisma.schedule.findUnique({
      where: { id: scheduleId },
      include: { confirmation: true },
    })
    if (!schedule) return { code: 404, message: '排班不存在' }
    if (schedule.userId !== userId) return { code: 403, message: '无权申诉此排班' }
    if (schedule.confirmation?.status === 'appealed') return { code: 400, message: '该排班已在申诉中' }

    // 创建申诉
    const appeal = await prisma.scheduleAppeal.create({
      data: {
        userId,
        scheduleId,
        reason,
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        expectedShiftId,
      },
    })

    // 更新确认状态为appealed
    if (schedule.confirmation) {
      await prisma.scheduleConfirmation.update({
        where: { id: schedule.confirmation.id },
        data: { status: 'appealed' },
      })
    }

    return { code: 0, message: '申诉已提交', data: appeal }
  })

  // 取消申诉
  fastify.delete('/my/appeal/:id', async (request: FastifyRequest<{ Params: unknown }>) => {
    const userId = request.user.id!
    const { id } = validateData(idParamsSchema, request.params)

    const appeal = await prisma.scheduleAppeal.findUnique({ where: { id } })
    if (!appeal) return { code: 404, message: '申诉不存在' }
    if (appeal.userId !== userId) return { code: 403, message: '无权操作' }
    if (appeal.status !== 'pending') return { code: 400, message: '该申诉已处理，无法取消' }

    await prisma.scheduleAppeal.delete({ where: { id } })

    // 恢复确认状态为pending
    await prisma.scheduleConfirmation.update({
      where: { scheduleId: appeal.scheduleId },
      data: { status: 'pending' },
    })

    return { code: 0, message: '申诉已取消' }
  })
}
