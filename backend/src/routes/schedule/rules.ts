import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { setAudit, setAfter } from '../../plugins/audit'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, validateData } from '../../utils/validation'
import { generateCode } from '../../utils/codeGenerator'

const ruleCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(50).regex(/^[a-zA-Z0-9_-]+$/, '规则编码只能包含字母、数字、下划线和横线').optional(),
  departmentId: positiveIntSchema.optional().nullable(),
  shiftIds: z.string().min(1, '请至少选择一个班次'),
  pattern: z.string().max(2000).optional().nullable(),
  maxWorkHoursPerWeek: z.number().positive().max(168).optional().nullable(),
  maxConsecutiveDays: z.number().int().positive().max(30).optional().nullable(),
  minRestHoursBetween: z.number().int().min(0).max(24).optional().nullable(),
  maxNightShiftsPerWeek: z.number().int().positive().max(7).optional().nullable(),
  priority: z.number().int().min(0).max(100).optional().default(0),
  fairnessWeight: z.number().int().min(0).max(100).optional().default(50),
  preferenceEnabled: z.boolean().optional().default(true),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
})

const ruleUpdateSchema = ruleCreateSchema.partial()

const ruleQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export default async function scheduleRuleRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取规则列表
  fastify.get('/rules', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(ruleQuerySchema, request.query)
    const { page = 1, pageSize = 20 } = query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

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
      prisma.scheduleRule.count({ where }),
      prisma.scheduleRule.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
        include: {
          department: { select: { id: true, name: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 获取单个规则详情
  fastify.get('/rules/:id', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const rule = await prisma.scheduleRule.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
      },
    })
    if (!rule) return { code: 404, message: '规则不存在' }
    return { code: 0, data: rule }
  })

  // 创建规则
  fastify.post('/rules', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(ruleCreateSchema, request.body)
    setAudit(request, { action: 'schedule.rule.create', module: 'schedule', requestData: body })

    const code = body.code || await generateCode('scheduleRule', prisma.scheduleRule)

    const rule = await prisma.scheduleRule.create({ data: { ...body, code } })
    setAfter(request, { id: rule.id })

    return { code: 0, message: '创建成功', data: rule }
  })

  // 更新规则
  fastify.put('/rules/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(ruleUpdateSchema, request.body)
    setAudit(request, { action: 'schedule.rule.update', module: 'schedule', requestData: { id, ...body } })

    const existing = await prisma.scheduleRule.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '规则不存在' }

    const rule = await prisma.scheduleRule.update({ where: { id }, data: body })
    return { code: 0, message: '更新成功', data: rule }
  })

  // 删除规则
  fastify.delete('/rules/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const rule = await prisma.scheduleRule.findUnique({ where: { id } })
    if (!rule) return { code: 404, message: '规则不存在' }

    // 检查是否有排班使用此规则
    const usedCount = await prisma.schedule.count({ where: { ruleId: id } })
    if (usedCount > 0) {
      return { code: 400, message: `该规则已被 ${usedCount} 条排班使用，无法删除` }
    }

    await prisma.scheduleRule.delete({ where: { id } })
    setAudit(request, {
      action: 'schedule.rule.delete',
      module: 'schedule',
      beforeData: { id, name: rule.name },
      requestData: { id },
    })

    return { code: 0, message: '删除成功' }
  })

  // 获取规则可选的班次列表
  fastify.get('/rules/:id/shifts', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const rule = await prisma.scheduleRule.findUnique({
      where: { id },
      select: { shiftIds: true },
    })
    if (!rule) return { code: 404, message: '规则不存在' }

    const shiftIdList = rule.shiftIds.split(',').map(Number).filter(Boolean)
    const shifts = await prisma.shift.findMany({
      where: { id: { in: shiftIdList } },
      orderBy: { sortOrder: 'asc' },
    })

    return { code: 0, data: shifts }
  })
}
