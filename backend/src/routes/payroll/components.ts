import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission } from '../../middleware/permission'
import { idParamsSchema, positiveIntSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../../utils/validation'
import { invalidatePayrollCache } from '../../services/cacheService'

const salaryComponentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/, '组件编码只能包含字母、数字和下划线'),
  type: z.enum(['earning', 'deduction', 'allowance']),
  amountType: z.enum(['fixed', 'formula', 'percent']).optional().default('fixed'),
  formula: z.string().trim().max(500).optional().nullable(),
  taxable: z.coerce.boolean().optional().default(false),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
})

const salaryComponentUpdateSchema = partialUpdateSchema(salaryComponentSchema)

export default async function componentsRoutes(fastify: FastifyInstance) {
  fastify.get('/components', { preHandler: [requirePermission('payroll:manage')] }, async () => {
    const { getJSON, setJSON, isAvailable } = await import('../../utils/cache')
    const { CACHE_TTL } = await import('../../types/cache')
    const cacheKey = 'hr:payroll:components:list'

    if (isAvailable()) {
      const cached = await getJSON<any[]>(cacheKey)
      if (cached) {
        return { code: 0, data: cached }
      }
    }

    const list = await prisma.salaryComponent.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
    })

    if (isAvailable()) {
      setJSON(cacheKey, list, CACHE_TTL.PAYROLL_COMPONENTS)
    }

    return { code: 0, data: list }
  })

  fastify.post('/components', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(salaryComponentSchema, request.body)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.component.create',
      requestData: body,
    })

    const component = await prisma.salaryComponent.create({
      data: body,
    })

    setAfter(request, { id: component.id })
    invalidatePayrollCache()

    return { code: 0, message: '薪资组件创建成功', data: component }
  })

  fastify.put('/components/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(salaryComponentUpdateSchema, request.body)
    requireAtLeastOneField(data)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.component.update',
      requestData: data,
    })
    const existing = await prisma.salaryComponent.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资组件不存在' })
    }

    captureBefore(request, existing)
    const component = await prisma.salaryComponent.update({
      where: { id },
      data: data,
    })

    setAfter(request, { id: component.id })
    invalidatePayrollCache()

    return { code: 0, message: '薪资组件更新成功', data: component }
  })

  fastify.delete('/components/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.salaryComponent.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资组件不存在' })
    }

    setAudit(request, {
      module: 'payroll',
      action: 'payroll.component.delete',
      requestData: { id },
      beforeData: existing,
    })

    await prisma.salaryComponent.update({
      where: { id },
      data: { status: 'inactive' },
    })
    invalidatePayrollCache()

    return { code: 0, message: '薪资组件删除成功' }
  })

  // 批量删除薪资组件
  fastify.post('/components/batch-delete', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const { ids } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个薪资组件'),
    }), request.body)

    const { count } = await prisma.salaryComponent.updateMany({
      where: { id: { in: ids } },
      data: { status: 'inactive' },
    })

    setAudit(request, {
      module: 'payroll',
      action: 'payroll.component.batchDelete',
      requestData: { ids, count },
    })

    invalidatePayrollCache()
    return {
      code: 0,
      message: `成功删除 ${count} 个薪资组件`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  // 批量更新薪资组件状态
  fastify.post('/components/batch-status', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const { ids, status } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个薪资组件'),
      status: z.enum(['active', 'inactive']),
    }), request.body)

    const { count } = await prisma.salaryComponent.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    setAudit(request, {
      module: 'payroll',
      action: 'payroll.component.batchStatusUpdate',
      requestData: { ids, status, count },
    })

    invalidatePayrollCache()
    return {
      code: 0,
      message: `成功更新 ${count} 个薪资组件状态`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })
}
