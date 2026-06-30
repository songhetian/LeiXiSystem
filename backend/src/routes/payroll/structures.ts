import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission } from '../../middleware/permission'
import { dateStringSchema, idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

const structureItemSchema = z.object({
  componentId: positiveIntSchema,
  amount: z.coerce.number().min(0).max(99999999).optional(),
  formula: z.string().trim().max(500).optional().nullable(),
  condition: z.string().trim().max(200).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
})

const structureCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  payrollFrequency: z.enum(['monthly', 'biweekly', 'weekly', 'daily']).optional().default('monthly'),
  effectiveFrom: dateStringSchema,
  effectiveTo: dateStringSchema.optional().nullable(),
  items: z.array(structureItemSchema).max(50).optional().default([]),
}).refine((value) => !value.effectiveTo || new Date(value.effectiveFrom) <= new Date(value.effectiveTo), {
  message: '生效开始日期不能晚于结束日期',
})

const structureUpdateSchema = structureCreateSchema.extend({
  status: z.enum(['active', 'inactive']).optional(),
}).partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少需要提交一个更新字段' }
)

export default async function structuresRoutes(fastify: FastifyInstance) {
  fastify.get('/structures', { preHandler: [requirePermission('payroll:manage')] }, async () => {
    const list = await prisma.salaryStructure.findMany({
      include: { items: { include: { component: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { id: 'desc' },
    })
    return { code: 0, data: list }
  })

  fastify.post('/structures', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(structureCreateSchema, request.body)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.structure.create',
      requestData: body,
    })
    const structure = await prisma.salaryStructure.create({
      data: {
        name: body.name,
        payrollFrequency: body.payrollFrequency,
        status: 'active',
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
        items: {
          create: body.items.map((item) => ({
            componentId: item.componentId,
            amount: item.amount,
            formula: item.formula,
            condition: item.condition,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { items: true },
    })

    setAfter(request, { id: structure.id })

    return { code: 0, message: '薪资结构创建成功', data: structure }
  })

  fastify.put('/structures/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(structureUpdateSchema, request.body)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.structure.update',
      requestData: body,
    })
    const existing = await prisma.salaryStructure.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资结构不存在' })
    }

    captureBefore(request, existing)
    const structure = await prisma.$transaction(async (tx) => {
      if (body.items) {
        await tx.salaryStructureItem.deleteMany({ where: { salaryStructureId: id } })
      }
      return tx.salaryStructure.update({
        where: { id },
        data: {
          name: body.name,
          payrollFrequency: body.payrollFrequency,
          status: body.status,
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
          effectiveTo: body.effectiveTo !== undefined ? (body.effectiveTo ? new Date(body.effectiveTo) : null) : undefined,
          items: body.items ? {
            create: body.items.map((item) => ({
              componentId: item.componentId,
              amount: item.amount,
              formula: item.formula,
              condition: item.condition,
              sortOrder: item.sortOrder,
            })),
          } : undefined,
        },
        include: { items: { include: { component: true }, orderBy: { sortOrder: 'asc' } } },
      })
    })

    setAfter(request, { id: structure.id })

    return { code: 0, message: '薪资结构更新成功', data: structure }
  })
}
