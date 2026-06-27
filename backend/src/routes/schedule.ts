import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { dateStringSchema, idParamsSchema, positiveIntSchema, validateData } from '../utils/validation'

const calendarQuerySchema = z.object({
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
}).refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

const assignScheduleSchema = z.object({
  userIds: z.array(positiveIntSchema).min(1).max(500),
  shiftId: positiveIntSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema,
}).refine((value) => new Date(value.startDate) <= new Date(value.endDate), {
  message: '开始日期不能晚于结束日期',
}).refine((value) => {
  const days = Math.ceil((new Date(value.endDate).getTime() - new Date(value.startDate).getTime()) / 86400000) + 1
  return days <= 366
}, {
  message: '排班日期范围不能超过 366 天',
})

const updateScheduleSchema = z.object({
  shiftId: positiveIntSchema.optional(),
  status: z.string().trim().max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  note: z.string().trim().max(500).optional().nullable(),
}).refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

export default async function scheduleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/calendar', { preHandler: [requirePermission('schedule:view')] }, async (request: FastifyRequest<{
    Querystring: {
      startDate?: string
      endDate?: string
      departmentId?: number
      userId?: number
    }
  }>) => {
    const { startDate, endDate, departmentId, userId } = validateData(calendarQuerySchema, request.query)

    const where: any = {}
    if (startDate && endDate) {
      where.scheduleDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    if (departmentId) {
      where.user = { departmentId }
    }
    if (userId) {
      where.userId = userId
    }

    const schedules = await prisma.schedule.findMany({
      where,
      orderBy: { scheduleDate: 'asc' },
      include: {
        user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } },
        shift: { select: { name: true, color: true } },
      },
    })

    return {
      code: 0,
      data: schedules.map((s) => ({
        id: s.id,
        userId: s.userId,
        userName: s.user.realName,
        departmentId: s.user.departmentId,
        departmentName: s.user.department?.name,
        shiftId: s.shiftId,
        shiftName: s.shift.name,
        shiftColor: s.shift.color,
        scheduleDate: s.scheduleDate,
        status: s.status,
        note: s.note,
      })),
    }
  })

  fastify.post('/assign', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{
    Body: {
      userIds: number[]
      shiftId: number
      startDate: string
      endDate: string
    }
  }>) => {
    const { userIds, shiftId, startDate, endDate } = validateData(assignScheduleSchema, request.body)

    const employees = await prisma.employee.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, userId: true },
    })

    const empMap = new Map(employees.map((e) => [e.userId, e.id]))

    const start = new Date(startDate)
    const end = new Date(endDate)
    const dates: Date[] = []

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay()
      if (day !== 0 && day !== 6) {
        dates.push(new Date(d))
      }
    }

    const records: any[] = []

    for (const userId of userIds) {
      const employeeId = empMap.get(userId)
      if (!employeeId) continue
      for (const date of dates) {
        records.push({
          userId,
          employeeId,
          shiftId,
          scheduleDate: date,
          createdBy: request.user.id,
        })
      }
    }

    await prisma.schedule.createMany({
      data: records,
      skipDuplicates: true,
    })

    return { code: 0, message: `排班完成，共 ${records.length} 条记录` }
  })

  fastify.put('/:id', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: any
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(updateScheduleSchema, request.body)

    await prisma.schedule.update({
      where: { id },
      data: {
        shiftId: body.shiftId,
        status: body.status,
        note: body.note,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/:id', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    await prisma.schedule.delete({
      where: { id },
    })

    return { code: 0, message: '删除成功' }
  })
}
