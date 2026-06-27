import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, timeSchema, validateData } from '../utils/validation'

const shiftListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  status: statusSchema,
})

const shiftBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '班次编码只能包含字母、数字、下划线和横线'),
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

const shiftUpdateSchema = shiftBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

export default async function shiftRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/list', async (request: FastifyRequest<{
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

  fastify.post('/list', { preHandler: [requirePermission('shift:manage')] }, async (request: FastifyRequest<{ Body: any }>) => {
    const body = validateData(shiftBodySchema, request.body)

    const shift = await prisma.shift.create({
      data: {
        name: body.name,
        code: body.code,
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

  fastify.put('/list/:id', { preHandler: [requirePermission('shift:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: any
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(shiftUpdateSchema, request.body)

    await prisma.shift.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code,
        departmentId: body.departmentId ?? undefined,
        startTime: body.startTime,
        endTime: body.endTime,
        workHours: body.workHours,
        isFlexible: body.isFlexible,
        isCrossDay: body.isCrossDay,
        beginCheckinMinutes: body.beginCheckinMinutes === undefined ? undefined : Number(body.beginCheckinMinutes),
        allowCheckoutMinutes: body.allowCheckoutMinutes === undefined ? undefined : Number(body.allowCheckoutMinutes),
        lateGraceMinutes: body.lateGraceMinutes === undefined ? undefined : Number(body.lateGraceMinutes),
        earlyGraceMinutes: body.earlyGraceMinutes === undefined ? undefined : Number(body.earlyGraceMinutes),
        color: body.color,
        description: body.description,
        status: body.status,
        sortOrder: body.sortOrder,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/list/:id', { preHandler: [requirePermission('shift:manage')] }, async (request: FastifyRequest<{
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
