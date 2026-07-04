import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission } from '../../middleware/permission'
import { setAudit, setAfter } from '../../plugins/audit'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, validateData } from '../../utils/validation'
import { Decimal } from '@prisma/client/runtime/library'

const createSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  departmentId: positiveIntSchema,
  totalBudget: z.number().positive(),
  description: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    type: z.string().min(1).max(50),
    budgetAmount: z.number().positive(),
  })).optional(),
})

const updateSchema = z.object({
  totalBudget: z.number().positive().optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
})

const querySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  year: z.coerce.number().int().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
})

export default async function budgetRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取预算列表
  fastify.get('/', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(querySchema, request.query)
    const { page = 1, pageSize = 20 } = query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (query.year) {
      where.year = query.year
    }
    if (query.departmentId) {
      where.departmentId = query.departmentId
    }
    if (query.keyword) {
      where.department = { name: { contains: query.keyword } }
    }

    const [total, list] = await Promise.all([
      prisma.annualBudget.count({ where }),
      prisma.annualBudget.findMany({
        where,
        skip,
        take,
        orderBy: [{ year: 'desc' }, { id: 'desc' }],
        include: {
          department: { select: { id: true, name: true } },
          items: { orderBy: { type: 'asc' } },
        },
      }),
    ])

    // 计算使用率
    const result = list.map((budget) => {
      const usageRate = budget.totalBudget.toNumber() > 0
        ? (budget.spentAmount.toNumber() / budget.totalBudget.toNumber()) * 100
        : 0
      return {
        ...budget,
        usageRate: Math.round(usageRate * 100) / 100,
        availableAmount: budget.totalBudget.toNumber() - budget.spentAmount.toNumber() - budget.reservedAmount.toNumber(),
      }
    })

    return { code: 0, data: { list: result, total, page, pageSize } }
  })

  // 获取单个预算详情
  fastify.get('/:id', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const budget = await prisma.annualBudget.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        items: { orderBy: { type: 'asc' } },
      },
    })
    if (!budget) return { code: 404, message: '预算不存在' }

    const usageRate = budget.totalBudget.toNumber() > 0
      ? (budget.spentAmount.toNumber() / budget.totalBudget.toNumber()) * 100
      : 0

    return {
      code: 0,
      data: {
        ...budget,
        usageRate: Math.round(usageRate * 100) / 100,
        availableAmount: budget.totalBudget.toNumber() - budget.spentAmount.toNumber() - budget.reservedAmount.toNumber(),
      },
    }
  })

  // 创建年度预算
  fastify.post('/', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(createSchema, request.body)
    setAudit(request, { action: 'budget.create', module: 'reimbursement', requestData: body })

    // 检查是否已存在
    const existing = await prisma.annualBudget.findUnique({
      where: { year_departmentId: { year: body.year, departmentId: body.departmentId } },
    })
    if (existing) {
      return { code: 400, message: `该部门 ${body.year} 年预算已存在` }
    }

    // 检查部门是否存在
    const dept = await prisma.department.findUnique({ where: { id: body.departmentId } })
    if (!dept) return { code: 404, message: '部门不存在' }

    // 创建预算及项目
    const budget = await prisma.annualBudget.create({
      data: {
        year: body.year,
        departmentId: body.departmentId,
        totalBudget: new Decimal(body.totalBudget),
        description: body.description,
        createdBy: request.user.id,
        items: body.items ? {
          create: body.items.map((item) => ({
            type: item.type,
            budgetAmount: new Decimal(item.budgetAmount),
          })),
        } : undefined,
      },
      include: { items: true },
    })
    setAfter(request, { id: budget.id })

    return { code: 0, message: '创建成功', data: budget }
  })

  // 更新年度预算
  fastify.put('/:id', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(updateSchema, request.body)
    setAudit(request, { action: 'budget.update', module: 'reimbursement', requestData: { id, ...body } })

    const existing = await prisma.annualBudget.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '预算不存在' }

    const data: any = { ...body }
    if (body.totalBudget !== undefined) {
      data.totalBudget = new Decimal(body.totalBudget)
    }

    const budget = await prisma.annualBudget.update({ where: { id }, data })
    return { code: 0, message: '更新成功', data: budget }
  })

  // 删除预算
  fastify.delete('/:id', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const budget = await prisma.annualBudget.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!budget) return { code: 404, message: '预算不存在' }

    // 检查是否有已审批的报销单
    const usedCount = await prisma.reimbursement.count({
      where: { budgetItem: { budgetId: id }, status: { notIn: ['draft', 'pending', 'rejected'] } },
    })
    if (usedCount > 0) {
      return { code: 400, message: `该预算已被 ${usedCount} 条报销单使用，无法删除` }
    }

    await prisma.annualBudget.delete({ where: { id } })
    setAudit(request, {
      action: 'budget.delete',
      module: 'reimbursement',
      beforeData: { id, year: budget.year, departmentId: budget.departmentId },
      requestData: { id },
    })

    return { code: 0, message: '删除成功' }
  })

  // 更新预算项目
  fastify.put('/:id/items', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { items } = validateData(z.object({
      items: z.array(z.object({
        type: z.string(),
        budgetAmount: z.number().positive(),
      })),
    }), request.body)

    const budget = await prisma.annualBudget.findUnique({ where: { id } })
    if (!budget) return { code: 404, message: '预算不存在' }

    // 删除旧项目，创建新项目
    await prisma.budgetItem.deleteMany({ where: { budgetId: id } })

    const newItems = items.map((item) => ({
      budgetId: id,
      type: item.type,
      budgetAmount: new Decimal(item.budgetAmount),
    }))

    await prisma.budgetItem.createMany({ data: newItems })

    const updated = await prisma.annualBudget.findUnique({
      where: { id },
      include: { items: true },
    })

    return { code: 0, message: '更新成功', data: updated }
  })

  // 获取部门当前年度预算状态
  fastify.get('/status/:departmentId', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { departmentId } = validateData(z.object({ departmentId: positiveIntSchema }), request.params)
    const year = new Date().getFullYear()

    const budget = await prisma.annualBudget.findUnique({
      where: { year_departmentId: { year, departmentId } },
      include: { items: true },
    })

    if (!budget) {
      return { code: 0, data: null }
    }

    return {
      code: 0,
      data: {
        ...budget,
        usageRate: budget.totalBudget.toNumber() > 0
          ? Math.round((budget.spentAmount.toNumber() / budget.totalBudget.toNumber()) * 10000) / 100
          : 0,
        availableAmount: budget.totalBudget.toNumber() - budget.spentAmount.toNumber() - budget.reservedAmount.toNumber(),
      },
    }
  })

  // 预算预警检查（报销申请时调用）
  fastify.post('/check', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { departmentId, amount, type } = validateData(z.object({
      departmentId: positiveIntSchema,
      amount: z.number().positive(),
      type: z.string().optional(),
    }), request.body)

    const year = new Date().getFullYear()

    const budget = await prisma.annualBudget.findUnique({
      where: { year_departmentId: { year, departmentId } },
      include: { items: true },
    })

    if (!budget) {
      return { code: 0, data: { status: 'no_budget', message: '未配置年度预算' } }
    }

    const available = budget.totalBudget.toNumber() - budget.spentAmount.toNumber() - budget.reservedAmount.toNumber()

    if (amount > available) {
      return {
        code: 0,
        data: {
          status: 'overdraft',
          message: `超出可用预算 ${available} 元`,
          available,
          totalBudget: budget.totalBudget.toNumber(),
          spentAmount: budget.spentAmount.toNumber(),
        },
      }
    }

    // 检查分类预算
    if (type) {
      const item = budget.items.find((i) => i.type === type)
      if (item) {
        const itemAvailable = item.budgetAmount.toNumber() - item.spentAmount.toNumber() - item.reservedAmount.toNumber()
        if (amount > itemAvailable) {
          return {
            code: 0,
            data: {
              status: 'warning',
              message: `超出 ${type} 分类预算，当前可用 ${itemAvailable} 元`,
              categoryBudget: item.budgetAmount.toNumber(),
              categoryAvailable: itemAvailable,
            },
          }
        }
      }
    }

    // 计算使用率预警
    const usageRate = (budget.spentAmount.toNumber() + budget.reservedAmount.toNumber() + amount) / budget.totalBudget.toNumber()
    if (usageRate > 0.8) {
      return {
        code: 0,
        data: {
          status: 'warning',
          message: `预算使用率将达到 ${Math.round(usageRate * 100)}%`,
          usageRate: Math.round(usageRate * 100),
        },
      }
    }

    return { code: 0, data: { status: 'passed', message: '预算检查通过' } }
  })
}
