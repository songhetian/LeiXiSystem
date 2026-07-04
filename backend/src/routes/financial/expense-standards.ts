import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission } from '../../middleware/permission'
import { setAudit, setAfter } from '../../plugins/audit'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, validateData } from '../../utils/validation'

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(50),
  amountLimit: z.number().positive(),
  dailyLimit: z.number().positive().optional().nullable(),
  monthlyLimit: z.number().positive().optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  requireInvoice: z.boolean().optional().default(true),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
})

const updateSchema = createSchema.partial()

const querySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  type: z.string().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

// 费用类型枚举
export const EXPENSE_TYPES = [
  { value: '差旅费', label: '差旅费' },
  { value: '餐饮费', label: '餐饮费' },
  { value: '交通费', label: '交通费' },
  { value: '招待费', label: '招待费' },
  { value: '办公用品', label: '办公用品' },
  { value: '通讯费', label: '通讯费' },
  { value: '培训费', label: '培训费' },
  { value: '其他', label: '其他' },
]

export default async function expenseStandardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取费用标准列表
  fastify.get('/', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(querySchema, request.query)
    const { page = 1, pageSize = 20 } = query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { description: { contains: query.keyword } },
      ]
    }
    if (query.type) {
      where.type = query.type
    }
    if (query.departmentId) {
      where.departmentId = query.departmentId
    }
    if (query.status) {
      where.status = query.status
    }

    const [total, list] = await Promise.all([
      prisma.expenseStandard.count({ where }),
      prisma.expenseStandard.findMany({
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

  // 获取单个费用标准
  fastify.get('/:id', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const standard = await prisma.expenseStandard.findUnique({
      where: { id },
      include: { department: { select: { id: true, name: true } } },
    })
    if (!standard) return { code: 404, message: '费用标准不存在' }
    return { code: 0, data: standard }
  })

  // 创建费用标准
  fastify.post('/', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(createSchema, request.body)
    setAudit(request, { action: 'expense_standard.create', module: 'reimbursement', requestData: body })

    // 检查同名标准是否已存在
    const existing = await prisma.expenseStandard.findFirst({
      where: { name: body.name, type: body.type, departmentId: body.departmentId },
    })
    if (existing) {
      return { code: 400, message: '同名费用标准已存在' }
    }

    const standard = await prisma.expenseStandard.create({ data: body })
    setAfter(request, { id: standard.id })

    return { code: 0, message: '创建成功', data: standard }
  })

  // 更新费用标准
  fastify.put('/:id', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(updateSchema, request.body)
    setAudit(request, { action: 'expense_standard.update', module: 'reimbursement', requestData: { id, ...body } })

    const existing = await prisma.expenseStandard.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '费用标准不存在' }

    const standard = await prisma.expenseStandard.update({ where: { id }, data: body })
    return { code: 0, message: '更新成功', data: standard }
  })

  // 删除费用标准
  fastify.delete('/:id', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const standard = await prisma.expenseStandard.findUnique({ where: { id } })
    if (!standard) return { code: 404, message: '费用标准不存在' }

    await prisma.expenseStandard.delete({ where: { id } })
    setAudit(request, {
      action: 'expense_standard.delete',
      module: 'reimbursement',
      beforeData: { id, name: standard.name },
      requestData: { id },
    })

    return { code: 0, message: '删除成功' }
  })

  // 获取费用类型列表
  fastify.get('/types/list', async () => {
    return { code: 0, data: EXPENSE_TYPES }
  })

  // 校验费用是否超标
  fastify.post('/check', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { type, amount, departmentId } = validateData(z.object({
      type: z.string(),
      amount: z.number().positive(),
      departmentId: positiveIntSchema.optional(),
    }), request.body)

    // 1. 先查找部门级别标准
    let standard = departmentId
      ? await prisma.expenseStandard.findFirst({
          where: { type, departmentId, status: 'active' },
        })
      : null

    // 2. 没有部门级别则查找全局标准
    if (!standard) {
      standard = await prisma.expenseStandard.findFirst({
        where: { type, departmentId: null, status: 'active' },
      })
    }

    if (!standard) {
      return { code: 0, data: { passed: true, message: '未配置费用标准' } }
    }

    const warnings: string[] = []
    let passed = true

    // 检查单笔上限
    if (Number(standard.amountLimit) > 0 && amount > Number(standard.amountLimit)) {
      passed = false
      warnings.push(`单笔金额超过上限 ${standard.amountLimit} 元`)
    }

    // 检查日上限
    if (standard.dailyLimit && Number(standard.dailyLimit) > 0) {
      // 查询当日已报销金额
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const todayTotal = await prisma.reimbursement.aggregate({
        where: {
          type,
          expenseDate: { gte: today, lt: tomorrow },
          status: { not: 'draft' },
          ...(departmentId ? { employee: { user: { departmentId } } } : {}),
        },
        _sum: { amount: true },
      })

      const totalToday = (todayTotal._sum.amount?.toNumber() || 0) + amount
      if (totalToday > Number(standard.dailyLimit)) {
        warnings.push(`当日累计 ${totalToday} 元超过日上限 ${standard.dailyLimit} 元`)
      }
    }

    return {
      code: 0,
      data: {
        passed,
        warnings,
        standard: {
          amountLimit: standard.amountLimit,
          dailyLimit: standard.dailyLimit,
          monthlyLimit: standard.monthlyLimit,
          requireInvoice: standard.requireInvoice,
        },
      },
    }
  })
}
