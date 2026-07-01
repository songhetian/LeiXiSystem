import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../../utils/validation'

const overtimeTypeListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: statusSchema,
  departmentId: positiveIntSchema.optional(),
  keyword: optionalKeywordSchema,
})

const createOvertimeTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().max(500).optional().nullable(),
  payRate: z.coerce.number().min(0).max(10).optional().default(1.5),
  minMinutes: z.number().int().min(0).max(1440).optional().default(30),
  maxMinutes: z.number().int().min(0).max(1440).optional().nullable(),
  requireApproval: z.boolean().optional().default(true),
  departmentId: positiveIntSchema.optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
})

const updateOvertimeTypeSchema = partialUpdateSchema(createOvertimeTypeSchema)

export default async function overtimeTypesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/overtime-types', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(overtimeTypeListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.status) where.status = query.status
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.keyword) where.name = { contains: query.keyword }

    const [total, list] = await Promise.all([
      prisma.overtimeType.count({ where }),
      prisma.overtimeType.findMany({
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

    return {
      code: 0,
      data: {
        list: list.map((item) => ({
          ...item,
          payRate: Number(item.payRate),
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/overtime-types/all', async () => {
    const list = await prisma.overtimeType.findMany({
      where: { status: 'active' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })

    return {
      code: 0,
      data: list.map((item) => ({
        ...item,
        payRate: Number(item.payRate),
      })),
    }
  })

  fastify.get('/overtime-types/:id', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const item = await prisma.overtimeType.findUnique({
      where: { id },
      include: {
        department: true,
        creator: { select: { id: true, realName: true } },
      },
    })

    if (!item) return { code: 404, message: '加班类型不存在' }

    return {
      code: 0,
      data: {
        ...item,
        payRate: Number(item.payRate),
      },
    }
  })

  fastify.post('/overtime-types', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(createOvertimeTypeSchema, request.body)

    const existing = await prisma.overtimeType.findUnique({
      where: { code: body.code },
    })
    if (existing) {
      return { code: 400, message: '类型编码已存在' }
    }

    const item = await prisma.overtimeType.create({
      data: {
        ...body,
        createdBy: request.user.id,
      },
    })

    return {
      code: 0,
      message: '创建成功',
      data: {
        ...item,
        payRate: Number(item.payRate),
      },
    }
  })

  fastify.put('/overtime-types/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(updateOvertimeTypeSchema, request.body)
    requireAtLeastOneField(data)

    const existing = await prisma.overtimeType.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '加班类型不存在' }

    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.overtimeType.findUnique({
        where: { code: data.code },
      })
      if (codeExists) {
        return { code: 400, message: '类型编码已存在' }
      }
    }

    const updated = await prisma.overtimeType.update({
      where: { id },
      data: data,
    })

    return {
      code: 0,
      message: '更新成功',
      data: {
        ...updated,
        payRate: Number(updated.payRate),
      },
    }
  })

  fastify.delete('/overtime-types/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.overtimeType.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '加班类型不存在' }

    const used = await prisma.overtimeRequest.findFirst({
      where: { overtimeType: existing.code },
    })
    if (used) {
      return { code: 400, message: '该加班类型已被使用，无法删除' }
    }

    await prisma.overtimeType.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })
}
