import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { idParamsSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'

const vacationTypeBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '假期编码只能包含字母、数字、下划线和横线'),
  totalDays: z.coerce.number().min(0).max(366).optional().default(0),
  unit: z.enum(['day', 'hour']).optional().default('day'),
  isCarryOver: z.coerce.boolean().optional().default(false),
  carryOverDays: z.coerce.number().min(0).max(366).optional().default(0),
  isPaid: z.coerce.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  status: statusSchema,
  description: z.string().trim().max(500).optional().nullable(),
})

const vacationTypeUpdateSchema = vacationTypeBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const balanceQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export default async function vacationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/types', async () => {
    const types = await prisma.vacationType.findMany({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
    })

    return {
      code: 0,
      data: types.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        totalDays: t.totalDays,
        unit: t.unit,
        isCarryOver: t.isCarryOver,
        carryOverDays: t.carryOverDays,
        isPaid: t.isPaid,
        sortOrder: t.sortOrder,
        status: t.status,
        description: t.description,
      })),
    }
  })

  fastify.post('/types', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(vacationTypeBodySchema, request.body)

    const type = await prisma.vacationType.create({
      data: {
        name: body.name,
        code: body.code,
        totalDays: body.totalDays,
        unit: body.unit,
        isCarryOver: body.isCarryOver,
        carryOverDays: body.carryOverDays,
        isPaid: body.isPaid,
        sortOrder: body.sortOrder,
        description: body.description,
      },
    })

    return { code: 0, message: '创建成功', data: type }
  })

  fastify.put('/types/:id', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(vacationTypeUpdateSchema, request.body)

    await prisma.vacationType.update({
      where: { id },
      data: {
        name: body.name,
        totalDays: body.totalDays,
        unit: body.unit,
        isCarryOver: body.isCarryOver,
        carryOverDays: body.carryOverDays,
        isPaid: body.isPaid,
        sortOrder: body.sortOrder,
        status: body.status,
        description: body.description,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/types/:id', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    await prisma.vacationType.update({
      where: { id },
      data: { status: 'inactive' },
    })

    return { code: 0, message: '删除成功' }
  })

  fastify.get('/balance', async (request: FastifyRequest<{
    Querystring: { employeeId?: number; year?: number }
  }>) => {
    const { employeeId, year = new Date().getFullYear() } = validateData(balanceQuerySchema, request.query)

    const empId = employeeId || (await prisma.employee.findUnique({
      where: { userId: request.user.id },
    }))?.id

    if (!empId) {
      return { code: 0, data: [] }
    }

    const balances = await prisma.vacationBalance.findMany({
      where: { employeeId: empId, year },
      include: { vacationType: true },
    })

    return {
      code: 0,
      data: balances.map((b) => ({
        id: b.id,
        vacationTypeId: b.vacationTypeId,
        typeName: b.vacationType.name,
        typeCode: b.vacationType.code,
        year: b.year,
        total: b.total,
        used: b.used,
        balance: b.balance,
        unit: b.vacationType.unit,
      })),
    }
  })
}
