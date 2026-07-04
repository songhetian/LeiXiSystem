import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { generateCode } from '../utils/codeGenerator'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, timeSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../utils/validation'

const shiftListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  status: statusSchema,
})

const shiftBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  code: z.string().trim().max(50).regex(/^[a-zA-Z0-9_-]+$/, '班次编码只能包含字母、数字、下划线和横线').optional(),
  departmentId: positiveIntSchema.optional().nullable(),
  startTime: timeSchema,
  endTime: timeSchema,
  workHours: z.coerce.number().min(0).max(24),
  isFlexible: z.coerce.boolean().optional().default(false),
  isCrossDay: z.coerce.boolean().optional().default(false),
  beginCheckinMinutes: z.coerce.number().int().min(0).max(1440).optional().default(60),
  allowCheckoutMinutes: z.coerce.number().int().min(0).max(1440).optional().default(60),
  lateGraceMinutes: z.coerce.number().int().min(0).max(240).optional().default(0),
  earlyGraceMinutes: z.coerce.number().int().min(0).max(240).optional().default(0),
  color: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  status: statusSchema,
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
})

const shiftUpdateSchema = partialUpdateSchema(shiftBodySchema)

export default async function shiftRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      keyword?: string
      departmentId?: number
      status?: string
    }
  }>) => {
    const query = validateData(shiftListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { keyword, departmentId, status } = query

    const where: any = {}
    if (keyword) where.name = { contains: keyword }
    if (departmentId) where.departmentId = departmentId
    if (status) where.status = status

    const [total, list] = await Promise.all([
      prisma.shift.count({ where }),
      prisma.shift.findMany({
        where,
        skip,
        take,
        orderBy: { sortOrder: 'asc' },
        include: { department: true },
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          departmentId: s.departmentId,
          departmentName: s.department?.name,
          startTime: s.startTime,
          endTime: s.endTime,
          workHours: s.workHours,
          isFlexible: s.isFlexible,
          isCrossDay: s.isCrossDay,
          beginCheckinMinutes: s.beginCheckinMinutes,
          allowCheckoutMinutes: s.allowCheckoutMinutes,
          lateGraceMinutes: s.lateGraceMinutes,
          earlyGraceMinutes: s.earlyGraceMinutes,
          color: s.color,
          description: s.description,
          status: s.status,
          sortOrder: s.sortOrder,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.post('/', { preHandler: [requirePermission('shift:manage')] }, async (request: FastifyRequest<{ Body: any }>) => {
    const body = validateData(shiftBodySchema, request.body)

    const code = body.code || await generateCode('shift', prisma.shift)
    const shift = await prisma.shift.create({
      data: {
        name: body.name,
        code,
        departmentId: body.departmentId ?? undefined,
        startTime: body.startTime,
        endTime: body.endTime,
        workHours: body.workHours,
        isFlexible: body.isFlexible || false,
        isCrossDay: body.isCrossDay || false,
        beginCheckinMinutes: body.beginCheckinMinutes,
        allowCheckoutMinutes: body.allowCheckoutMinutes,
        lateGraceMinutes: body.lateGraceMinutes,
        earlyGraceMinutes: body.earlyGraceMinutes,
        color: body.color,
        description: body.description,
        sortOrder: body.sortOrder || 0,
      },
    })

    return { code: 0, message: '创建成功', data: shift }
  })

  fastify.put('/:id', { preHandler: [requirePermission('shift:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: any
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(shiftUpdateSchema, request.body)
    requireAtLeastOneField(data)

    await prisma.shift.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        departmentId: data.departmentId ?? undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        workHours: data.workHours,
        isFlexible: data.isFlexible,
        isCrossDay: data.isCrossDay,
        beginCheckinMinutes: data.beginCheckinMinutes === undefined ? undefined : Number(data.beginCheckinMinutes),
        allowCheckoutMinutes: data.allowCheckoutMinutes === undefined ? undefined : Number(data.allowCheckoutMinutes),
        lateGraceMinutes: data.lateGraceMinutes === undefined ? undefined : Number(data.lateGraceMinutes),
        earlyGraceMinutes: data.earlyGraceMinutes === undefined ? undefined : Number(data.earlyGraceMinutes),
        color: data.color,
        description: data.description,
        status: data.status,
        sortOrder: data.sortOrder,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/:id', { preHandler: [requirePermission('shift:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    await prisma.shift.update({
      where: { id },
      data: { status: 'inactive' },
    })

    return { code: 0, message: '删除成功' }
  })

  fastify.get('/rules', async () => {
    return { code: 0, data: [] }
  })
}
