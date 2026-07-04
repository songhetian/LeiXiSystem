import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission } from '../../middleware/permission'
import { dateStringSchema, idParamsSchema, positiveIntSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safeExtend } from '../../utils/validation'
import {
  createVersion,
  getVersions,
  getVersion,
  activateVersion,
  getCurrentVersion,
  getVersionForDate,
} from '../../services/salaryStructureVersion'

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

const structureUpdateSchema = partialUpdateSchema(safeExtend(structureCreateSchema, {
  status: z.enum(['active', 'inactive']).optional(),
}))

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
    const data = validateData(structureUpdateSchema, request.body)
    requireAtLeastOneField(data)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.structure.update',
      requestData: data,
    })
    const existing = await prisma.salaryStructure.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资结构不存在' })
    }

    captureBefore(request, existing)
    const structure = await prisma.$transaction(async (tx) => {
      if (data.items) {
        await tx.salaryStructureItem.deleteMany({ where: { salaryStructureId: id } })
      }
      return tx.salaryStructure.update({
        where: { id },
        data: {
          name: data.name,
          payrollFrequency: data.payrollFrequency,
          status: data.status,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : undefined,
          effectiveTo: data.effectiveTo !== undefined ? (data.effectiveTo ? new Date(data.effectiveTo) : null) : undefined,
          items: data.items ? {
            create: data.items.map((item) => ({
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

  const versionCreateSchema = z.object({
    versionName: z.string().trim().max(100).optional(),
    effectiveFrom: dateStringSchema,
    effectiveTo: dateStringSchema.optional().nullable(),
    changeReason: z.string().trim().max(500).optional(),
  }).refine((value) => !value.effectiveTo || new Date(value.effectiveFrom) <= new Date(value.effectiveTo), {
    message: '生效开始日期不能晚于结束日期',
  })

  const versionIdParamsSchema = z.object({
    id: positiveIntSchema,
    versionId: positiveIntSchema,
  })

  fastify.get('/structures/:id/versions', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Querystring: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const structure = await prisma.salaryStructure.findUnique({ where: { id } })
    if (!structure) {
      return reply.status(404).send({ code: 404, message: '薪资结构不存在' })
    }

    const list = await getVersions(id)
    return { code: 0, data: list }
  })

  fastify.post('/structures/:id/versions', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(versionCreateSchema, request.body)

    const structure = await prisma.salaryStructure.findUnique({ where: { id } })
    if (!structure) {
      return reply.status(404).send({ code: 404, message: '薪资结构不存在' })
    }

    setAudit(request, {
      module: 'payroll',
      action: 'payroll.structure.version.create',
      requestData: body,
    })

    const version = await createVersion(id, body, request.user.id)

    setAfter(request, { id: version.id })

    return { code: 0, message: '版本创建成功', data: version }
  })

  fastify.get('/structures/:id/versions/:versionId', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id, versionId } = validateData(versionIdParamsSchema, request.params)

    const structure = await prisma.salaryStructure.findUnique({ where: { id } })
    if (!structure) {
      return reply.status(404).send({ code: 404, message: '薪资结构不存在' })
    }

    const version = await getVersion(versionId)
    if (!version || version.structureId !== id) {
      return reply.status(404).send({ code: 404, message: '版本不存在' })
    }

    return { code: 0, data: version }
  })

  fastify.put('/structures/versions/:id/activate', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const version = await getVersion(id)
    if (!version) {
      return reply.status(404).send({ code: 404, message: '版本不存在' })
    }

    setAudit(request, {
      module: 'payroll',
      action: 'payroll.structure.version.activate',
      requestData: { id },
    })

    const activated = await activateVersion(id)

    setAfter(request, { id: activated.id })

    return { code: 0, message: '版本激活成功', data: activated }
  })
}
