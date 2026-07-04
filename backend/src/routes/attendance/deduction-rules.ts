import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../../utils/validation'
import { matchDeductionRule, calculateDeduction, DeductionType } from '../../services/attendanceDeduction'

const deductionTypeSchema = z.enum([
  'late',
  'early_leave',
  'absent',
  'missing_checkin',
])

const deductionCalcTypeSchema = z.enum([
  'fixed',
  'percentage',
  'salary_multiple',
  'leave_days',
])

const ruleListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  type: deductionTypeSchema.optional(),
  status: statusSchema,
  departmentId: positiveIntSchema.optional(),
  keyword: optionalKeywordSchema,
})

const createRuleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: deductionTypeSchema,
  minMinutes: z.number().int().min(0).max(1440).default(0),
  maxMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  deductionType: deductionCalcTypeSchema.default('fixed'),
  deductionValue: z.coerce.number().min(0).default(0),
  salaryMultiplier: z.coerce.number().min(0).max(100).optional().nullable(),
  affectAttendance: z.boolean().optional().default(true),
  leaveType: z.string().trim().max(50).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  departmentId: positiveIntSchema.optional().nullable(),
})

const updateRuleSchema = partialUpdateSchema(createRuleSchema)

const calculateSchema = z.object({
  type: deductionTypeSchema,
  minutes: z.number().int().min(0).max(1440),
  dailySalary: z.coerce.number().min(0).default(0),
  departmentId: positiveIntSchema.optional(),
})

export const DEDUCTION_TYPES = [
  { value: 'late', label: '迟到' },
  { value: 'early_leave', label: '早退' },
  { value: 'absent', label: '旷工' },
  { value: 'missing_checkin', label: '缺打卡' },
]

export const DEDUCTION_CALC_TYPES = [
  { value: 'fixed', label: '固定金额' },
  { value: 'percentage', label: '日薪比例' },
  { value: 'salary_multiple', label: '日薪倍数' },
  { value: 'leave_days', label: '抵扣假期' },
]

export default async function deductionRulesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/deduction-rules', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(ruleListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.type) where.type = query.type
    if (query.status) where.status = query.status
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.keyword) where.name = { contains: query.keyword }

    const [total, list] = await Promise.all([
      prisma.attendanceDeductionRule.count({ where }),
      prisma.attendanceDeductionRule.findMany({
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

  fastify.get('/deduction-rules/:id', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const rule = await prisma.attendanceDeductionRule.findUnique({
      where: { id },
      include: {
        department: true,
        creator: { select: { id: true, realName: true } },
      },
    })

    if (!rule) return { code: 404, message: '规则不存在' }

    return { code: 0, data: rule }
  })

  fastify.post('/deduction-rules', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(createRuleSchema, request.body)

    const rule = await prisma.attendanceDeductionRule.create({
      data: {
        ...body,
        createdBy: request.user.id,
      },
    })

    return { code: 0, message: '创建成功', data: rule }
  })

  fastify.put('/deduction-rules/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(updateRuleSchema, request.body)
    requireAtLeastOneField(data)

    const rule = await prisma.attendanceDeductionRule.findUnique({ where: { id } })
    if (!rule) return { code: 404, message: '规则不存在' }

    const updated = await prisma.attendanceDeductionRule.update({
      where: { id },
      data: data,
    })

    return { code: 0, message: '更新成功', data: updated }
  })

  fastify.delete('/deduction-rules/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const rule = await prisma.attendanceDeductionRule.findUnique({ where: { id } })
    if (!rule) return { code: 404, message: '规则不存在' }

    await prisma.attendanceDeductionRule.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })

  fastify.post('/deduction-rules/calculate', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(calculateSchema, request.body)

    const rule = await matchDeductionRule(body.type as DeductionType, body.minutes, body.departmentId)
    const result = calculateDeduction(body.type as DeductionType, body.minutes, body.dailySalary, rule)

    return { code: 0, data: result }
  })

  fastify.get('/deduction-types/list', async () => {
    return { code: 0, data: DEDUCTION_TYPES }
  })

  fastify.get('/deduction-calc-types/list', async () => {
    return { code: 0, data: DEDUCTION_CALC_TYPES }
  })
}
