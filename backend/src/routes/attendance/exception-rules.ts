import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../../utils/validation'

const exceptionTypeSchema = z.enum([
  'late',
  'early',
  'absent',
  'missing_checkin',
  'missing_checkout',
  'overtime_less',
  'work_duration_less',
])

const ruleListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  type: exceptionTypeSchema.optional(),
  status: statusSchema,
  departmentId: positiveIntSchema.optional(),
  keyword: optionalKeywordSchema,
})

const createRuleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: exceptionTypeSchema,
  description: z.string().trim().max(500).optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  threshold: z.number().int().min(0).max(1440).optional().default(0),
  thresholdMax: z.number().int().min(0).max(1440).optional().nullable(),
  autoResolve: z.boolean().optional().default(false),
  autoResolveType: z.enum(['ignore', 'deduct', 'warn']).optional().nullable(),
  deductMinutes: z.number().int().min(0).max(1440).optional().default(0),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
})

const updateRuleSchema = createRuleSchema.partial().refine((val) => Object.keys(val).length > 0, {
  message: '至少需要提交一个更新字段',
})

export const EXCEPTION_TYPES = [
  { value: 'late', label: '迟到' },
  { value: 'early', label: '早退' },
  { value: 'absent', label: '旷工' },
  { value: 'missing_checkin', label: '缺打卡（上班）' },
  { value: 'missing_checkout', label: '缺打卡（下班）' },
  { value: 'overtime_less', label: '工时不足' },
  { value: 'work_duration_less', label: '工作时长不足' },
]

export const AUTO_RESOLVE_TYPES = [
  { value: 'ignore', label: '忽略（自动通过）' },
  { value: 'deduct', label: '扣除工时' },
  { value: 'warn', label: '警告记录' },
]

export default async function exceptionRulesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取异常规则列表
  fastify.get('/exception-rules', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(ruleListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.type) where.type = query.type
    if (query.status) where.status = query.status
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.keyword) where.name = { contains: query.keyword }

    const [total, list] = await Promise.all([
      prisma.attendanceExceptionRule.count({ where }),
      prisma.attendanceExceptionRule.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
        include: {
          department: true,
          creator: { select: { id: true, realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 获取异常规则详情
  fastify.get('/exception-rules/:id', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const rule = await prisma.attendanceExceptionRule.findUnique({
      where: { id },
      include: {
        department: true,
        creator: { select: { id: true, realName: true } },
      },
    })

    if (!rule) return { code: 404, message: '规则不存在' }

    return { code: 0, data: rule }
  })

  // 创建异常规则
  fastify.post('/exception-rules', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(createRuleSchema, request.body)

    const rule = await prisma.attendanceExceptionRule.create({
      data: {
        ...body,
        createdBy: request.user.id,
      },
    })

    return { code: 0, message: '创建成功', data: rule }
  })

  // 更新异常规则
  fastify.put('/exception-rules/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(updateRuleSchema, request.body)

    const rule = await prisma.attendanceExceptionRule.findUnique({ where: { id } })
    if (!rule) return { code: 404, message: '规则不存在' }

    const updated = await prisma.attendanceExceptionRule.update({
      where: { id },
      data: body,
    })

    return { code: 0, message: '更新成功', data: updated }
  })

  // 删除异常规则
  fastify.delete('/exception-rules/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const rule = await prisma.attendanceExceptionRule.findUnique({ where: { id } })
    if (!rule) return { code: 404, message: '规则不存在' }

    await prisma.attendanceExceptionRule.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })

  // 获取异常类型列表
  fastify.get('/exception-types/list', async () => {
    return { code: 0, data: EXCEPTION_TYPES }
  })

  // 批量处理异常
  fastify.post('/exceptions/batch-resolve', { preHandler: [requirePermission('attendance:calculate')] }, async (request: FastifyRequest<{
    Body: {
      ids: number[]
      status: 'resolved' | 'rejected'
      reason?: string
    }
  }>) => {
    const { ids, status, reason } = request.body

    if (!ids || ids.length === 0) {
      return { code: 400, message: '请选择要处理的异常' }
    }

    const updated = await prisma.attendanceException.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        reason: reason || undefined,
      },
    })

    return { code: 0, message: `已处理 ${updated.count} 条异常`, data: { count: updated.count } }
  })
}
