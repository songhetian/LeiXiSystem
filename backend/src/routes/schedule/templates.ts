import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { setAudit, setAfter } from '../../plugins/audit'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, validateData } from '../../utils/validation'
import { Decimal } from '@prisma/client/runtime/library'

const templateCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '模板编码只能包含字母、数字、下划线和横线'),
  departmentId: positiveIntSchema.optional().nullable(),
  cycleDays: z.number().int().min(1).max(30).optional().default(7),
  repeatType: z.enum(['weekday', 'day']).optional().default('weekday'),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  items: z.array(z.object({
    dayIndex: z.number().int().min(0).max(29),
    shiftIds: z.string().min(1).max(200),
    weekday: z.number().int().min(0).max(6).optional().nullable(),
  })).min(1).max(30),
})

const templateUpdateSchema = templateCreateSchema.partial()

const templateQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

const applyTemplateSchema = z.object({
  templateId: positiveIntSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  employeeIds: z.string().optional().transform((val) => {
    if (!val) return []
    return val.split(',').map(Number).filter(Boolean)
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式为 YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式为 YYYY-MM-DD'),
  overwrite: z.boolean().optional().default(false),
})

function normalizePagination(query: any) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
  const skip = (page - 1) * pageSize
  const take = pageSize
  return { page, pageSize, skip, take }
}

export default async function scheduleTemplateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取模板列表
  fastify.get('/templates', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(templateQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = {}
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { code: { contains: query.keyword } },
      ]
    }
    if (query.departmentId) {
      where.departmentId = query.departmentId
    }
    if (query.status) {
      where.status = query.status
    }

    const [total, list] = await Promise.all([
      prisma.scheduleTemplate.count({ where }),
      prisma.scheduleTemplate.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
        include: {
          department: { select: { id: true, name: true } },
          items: { orderBy: { dayIndex: 'asc' } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 获取模板详情
  fastify.get('/templates/:id', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const template = await prisma.scheduleTemplate.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        items: { orderBy: { dayIndex: 'asc' } },
        creator: { select: { id: true, realName: true } },
      },
    })
    if (!template) return { code: 404, message: '模板不存在' }
    return { code: 0, data: template }
  })

  // 创建模板
  fastify.post('/templates', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(templateCreateSchema, request.body)

    const existing = await prisma.scheduleTemplate.findUnique({ where: { code: body.code } })
    if (existing) return { code: 400, message: '模板编码已存在' }

    const { items, ...templateData } = body

    const template = await prisma.scheduleTemplate.create({
      data: {
        ...templateData,
        createdBy: request.user.id,
        items: {
          create: items.map((item) => ({
            dayIndex: item.dayIndex,
            shiftIds: item.shiftIds,
            weekday: item.weekday,
          })),
        },
      },
      include: { items: true },
    })

    setAudit(request, { action: 'schedule.template.create', module: 'schedule', requestData: body })
    setAfter(request, { id: template.id })

    return { code: 0, message: '创建成功', data: template }
  })

  // 更新模板
  fastify.put('/templates/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(templateUpdateSchema, request.body)

    const existing = await prisma.scheduleTemplate.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '模板不存在' }

    if (body.code && body.code !== existing.code) {
      const codeExists = await prisma.scheduleTemplate.findUnique({ where: { code: body.code } })
      if (codeExists) return { code: 400, message: '模板编码已存在' }
    }

    const { items, ...templateData } = body

    const updateData: any = { ...templateData }

    if (items && items.length > 0) {
      updateData.items = {
        deleteMany: {},
        create: items.map((item) => ({
          dayIndex: item.dayIndex,
          shiftIds: item.shiftIds,
          weekday: item.weekday,
        })),
      }
    }

    const template = await prisma.scheduleTemplate.update({
      where: { id },
      data: updateData,
      include: { items: true },
    })

    setAudit(request, { action: 'schedule.template.update', module: 'schedule', requestData: { id, ...body } })

    return { code: 0, message: '更新成功', data: template }
  })

  // 删除模板
  fastify.delete('/templates/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const template = await prisma.scheduleTemplate.findUnique({ where: { id } })
    if (!template) return { code: 404, message: '模板不存在' }

    await prisma.scheduleTemplate.delete({ where: { id } })

    setAudit(request, {
      action: 'schedule.template.delete',
      module: 'schedule',
      beforeData: { id, name: template.name },
    })

    return { code: 0, message: '删除成功' }
  })

  // 预览应用模板
  fastify.post('/templates/preview', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(applyTemplateSchema, request.body)

    const template = await prisma.scheduleTemplate.findUnique({
      where: { id: body.templateId },
      include: { items: { orderBy: { dayIndex: 'asc' } } },
    })
    if (!template) return { code: 404, message: '模板不存在' }

    // 获取员工列表
    const employeeWhere: any = { status: 'active', user: { status: 'active' } }
    if (body.departmentId) {
      employeeWhere.user = { ...employeeWhere.user, departmentId: body.departmentId }
    }
    if (body.employeeIds.length > 0) {
      employeeWhere.id = { in: body.employeeIds }
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, employeeNo: true, userId: true, user: { select: { realName: true } } },
    })

    // 获取班次信息
    const allShiftIds = template.items.flatMap((i) => i.shiftIds.split(',').map(Number).filter(Boolean))
    const uniqueShiftIds = [...new Set(allShiftIds)]
    const shifts = await prisma.shift.findMany({
      where: { id: { in: uniqueShiftIds } },
    })
    const shiftMap = new Map(shifts.map((s) => [s.id, s]))

    // 生成日期列表
    const start = new Date(body.startDate)
    const end = new Date(body.endDate)
    const dates: Date[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d))
    }

    // 获取已有排班
    const existingSchedules = body.overwrite
      ? []
      : await prisma.schedule.findMany({
          where: {
            scheduleDate: { gte: start, lte: end },
            employeeId: { in: employees.map((e) => e.id) },
          },
          select: { employeeId: true, scheduleDate: true },
        })

    const existingSet = new Set(existingSchedules.map((s) => `${s.employeeId}_${s.scheduleDate.toISOString().split('T')[0]}`))

    // 生成预览结果
    const preview: any[] = []
    for (const employee of employees) {
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0]
        const dayOfWeek = date.getDay()

        // 查找模板项
        let item = template.items.find((i) => {
          if (template.repeatType === 'weekday') {
            return i.weekday === dayOfWeek
          }
          const dayIndex = Math.floor((date.getTime() - start.getTime()) / 86400000) % template.cycleDays
          return i.dayIndex === dayIndex
        })

        if (!item) {
          item = template.items.find((i) => i.dayIndex === (dayOfWeek % template.cycleDays))
        }

        if (!item) continue

        const shiftIdList = item.shiftIds.split(',').map(Number).filter(Boolean)
        for (const shiftId of shiftIdList) {
          const shift = shiftMap.get(shiftId)
          const key = `${employee.id}_${dateStr}`
          const hasExisting = existingSet.has(key)

          preview.push({
            employeeId: employee.id,
            employeeNo: employee.employeeNo,
            employeeName: employee.user.realName,
            date: dateStr,
            shiftId,
            shiftName: shift?.name || `班次${shiftId}`,
            shiftColor: shift?.color,
            shiftStartTime: shift?.startTime,
            shiftEndTime: shift?.endTime,
            hasExisting,
            willOverwrite: body.overwrite && hasExisting,
            willSkip: !body.overwrite && hasExisting,
          })
        }
      }
    }

    return {
      code: 0,
      data: {
        preview,
        total: preview.length,
        willCreate: preview.filter((p) => !p.hasExisting).length,
        willOverwrite: preview.filter((p) => p.willOverwrite).length,
        willSkip: preview.filter((p) => p.willSkip).length,
      },
    }
  })

  // 确认应用模板
  fastify.post('/templates/apply', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(applyTemplateSchema, request.body)

    const template = await prisma.scheduleTemplate.findUnique({
      where: { id: body.templateId },
      include: { items: { orderBy: { dayIndex: 'asc' } } },
    })
    if (!template) return { code: 404, message: '模板不存在' }

    const employeeWhere: any = { status: 'active', user: { status: 'active' } }
    if (body.departmentId) {
      employeeWhere.user = { ...employeeWhere.user, departmentId: body.departmentId }
    }
    if (body.employeeIds.length > 0) {
      employeeWhere.id = { in: body.employeeIds }
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, userId: true },
    })

    const start = new Date(body.startDate)
    const end = new Date(body.endDate)
    const dates: Date[] = []
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d))
    }

    // 获取已有排班
    const existingSchedules = await prisma.schedule.findMany({
      where: {
        scheduleDate: { gte: start, lte: end },
        employeeId: { in: employees.map((e) => e.id) },
      },
      select: { id: true, employeeId: true, scheduleDate: true, userId: true },
    })
    const existingMap = new Map(existingSchedules.map((s) => [`${s.employeeId}_${s.scheduleDate.toISOString().split('T')[0]}`, s]))

    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    for (const employee of employees) {
      for (const date of dates) {
        const dateStr = date.toISOString().split('T')[0]
        const dayOfWeek = date.getDay()

        let item = template.items.find((i) => {
          if (template.repeatType === 'weekday') {
            return i.weekday === dayOfWeek
          }
          const dayIndex = Math.floor((date.getTime() - start.getTime()) / 86400000) % template.cycleDays
          return i.dayIndex === dayIndex
        })

        if (!item) {
          item = template.items.find((i) => i.dayIndex === (dayOfWeek % template.cycleDays))
        }

        if (!item) continue

        const shiftIdList = item.shiftIds.split(',').map(Number).filter(Boolean)
        for (const shiftId of shiftIdList) {
          const key = `${employee.id}_${dateStr}`
          const existing = existingMap.get(key)

          if (existing) {
            if (body.overwrite) {
              await prisma.schedule.update({
                where: { id: existing.id },
                data: { shiftId, source: 'template' },
              })
              updatedCount++
            } else {
              skippedCount++
            }
          } else {
            await prisma.schedule.create({
              data: {
                userId: employee.userId,
                employeeId: employee.id,
                shiftId,
                scheduleDate: date,
                source: 'template',
                createdBy: request.user.id,
              },
            })
            createdCount++
          }
        }
      }
    }

    setAudit(request, {
      action: 'schedule.template.apply',
      module: 'schedule',
      requestData: body,
    })

    return {
      code: 0,
      message: `应用完成：新建 ${createdCount} 条，更新 ${updatedCount} 条，跳过 ${skippedCount} 条`,
      data: { createdCount, updatedCount, skippedCount },
    }
  })
}
