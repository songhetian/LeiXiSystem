import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, validateData, statusSchema } from '../utils/validation'
import dayjs from 'dayjs'

// --- Schemas ---
const holidayListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  year: z.coerce.number().int().optional(),
  status: statusSchema,
})

const holidayListBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  year: z.coerce.number().int().min(2000).max(2100),
  country: z.string().trim().max(50).optional().default('CN'),
  isDefault: z.coerce.boolean().optional().default(false),
  status: statusSchema,
})

const holidayListUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isDefault: z.coerce.boolean().optional(),
  status: statusSchema.optional(),
})

const holidayDateBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  name: z.string().trim().min(1).max(100),
  isWorkingDay: z.coerce.boolean().optional().default(false),
  description: z.string().trim().max(500).optional().nullable(),
})

const batchDatesBodySchema = z.object({
  dates: z.array(holidayDateBodySchema).min(1).max(366),
})

const isHolidayQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  listId: z.coerce.number().int().positive().optional(),
})

const holidayDateUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  isWorkingDay: z.coerce.boolean().optional(),
  description: z.string().trim().max(500).optional().nullable(),
})

export default async function holidayRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // ─── Holiday Lists ───

  // GET /api/holidays/lists - 节假日列表
  fastify.get('/lists', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; year?: number; status?: string }
  }>) => {
    const query = validateData(holidayListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)

    const where: any = {}
    if (query.year) where.year = query.year
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.holidayList.count({ where }),
      prisma.holidayList.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { dates: true } } },
        orderBy: { year: 'desc' },
      }),
    ])

    return { code: 0, data: { total, page, pageSize, list } }
  })

  // POST /api/holidays/lists - 创建节假日列表
  fastify.post('/lists', { preHandler: [requirePermission('settings:manage')] }, async (request) => {
    const body = validateData(holidayListBodySchema, request.body)
    const data = await prisma.holidayList.create({ data: body })
    return { code: 0, data }
  })

  // PUT /api/holidays/lists/:id - 更新节假日列表
  fastify.put('/lists/:id', { preHandler: [requirePermission('settings:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(holidayListUpdateSchema, request.body)
    const data = await prisma.holidayList.update({
      where: { id: id },
      data: body,
    })
    return { code: 0, data }
  })

  // DELETE /api/holidays/lists/:id - 删除节假日列表
  fastify.delete('/lists/:id', { preHandler: [requirePermission('settings:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    await prisma.holidayList.delete({ where: { id: id } })
    return { code: 0, message: '删除成功' }
  })

  // ─── Holiday Dates ───

  // GET /api/holidays/lists/:id/dates - 查看节假日日期
  fastify.get('/lists/:id/dates', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const dates = await prisma.holidayDate.findMany({
      where: { holidayListId: id },
      orderBy: { date: 'asc' },
    })
    return { code: 0, data: dates }
  })

  // POST /api/holidays/lists/:id/dates - 添加单个节假日日期
  fastify.post('/lists/:id/dates', { preHandler: [requirePermission('settings:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(holidayDateBodySchema, request.body)
    const data = await prisma.holidayDate.create({
      data: {
        ...body,
        date: new Date(body.date),
        holidayListId: id,
      },
    })
    return { code: 0, data }
  })

  // POST /api/holidays/lists/:id/batch-dates - 批量添加节假日日期
  fastify.post('/lists/:id/batch-dates', { preHandler: [requirePermission('settings:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(batchDatesBodySchema, request.body)

    const data = await prisma.$transaction(
      body.dates.map((d) =>
        prisma.holidayDate.create({
          data: {
            ...d,
            date: new Date(d.date),
            holidayListId: id,
          },
        })
      )
    )

    return { code: 0, data, message: `成功添加 ${data.length} 个日期` }
  })

  // PUT /api/holidays/dates/:dateId - 更新节假日日期
  fastify.put('/dates/:dateId', { preHandler: [requirePermission('settings:manage')] }, async (request: FastifyRequest<{
    Params: { dateId: string }
  }>) => {
    const dateId = parseInt(request.params.dateId)
    const body = validateData(holidayDateUpdateSchema, request.body)
    const data = await prisma.holidayDate.update({
      where: { id: dateId },
      data: body,
    })
    return { code: 0, data }
  })

  // DELETE /api/holidays/dates/:dateId - 删除节假日日期
  fastify.delete('/dates/:dateId', { preHandler: [requirePermission('settings:manage')] }, async (request: FastifyRequest<{
    Params: { dateId: string }
  }>) => {
    const dateId = parseInt(request.params.dateId)
    await prisma.holidayDate.delete({ where: { id: dateId } })
    return { code: 0, message: '删除成功' }
  })

  // ─── Query Utilities ───

  // GET /api/holidays/is-holiday - 查询某天是否节假日
  fastify.get('/is-holiday', async (request: FastifyRequest<{
    Querystring: { date: string; listId?: number }
  }>) => {
    const query = validateData(isHolidayQuerySchema, request.query)
    const date = new Date(query.date)

    const where: any = { date }
    if (query.listId) {
      where.holidayListId = query.listId
    } else {
      // 没有指定列表时，查默认列表
      const defaultList = await prisma.holidayList.findFirst({
        where: { isDefault: true, status: 'active' },
      })
      if (defaultList) where.holidayListId = defaultList.id
    }

    const holidayDate = await prisma.holidayDate.findFirst({ where })
    const dayOfWeek = date.getDay()

    return {
      code: 0,
      data: {
        date: query.date,
        isHoliday: !!holidayDate && !holidayDate.isWorkingDay,
        isWorkingDay: (holidayDate?.isWorkingDay) || (!holidayDate && dayOfWeek !== 0 && dayOfWeek !== 6),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        holiday: holidayDate ? { name: holidayDate.name, description: holidayDate.description } : null,
      },
    }
  })

  // GET /api/holidays/calendar - 获取某年节假日日历（按月份聚合）
  fastify.get('/calendar', async (request: FastifyRequest<{
    Querystring: { year: number; listId?: number }
  }>) => {
    const year = parseInt(request.query.year as any) || dayjs().year()
    const listId = request.query.listId ? parseInt(request.query.listId as any) : undefined

    const where: any = { year }
    if (listId) where.id = listId
    else where.isDefault = true

    const list = await prisma.holidayList.findFirst({
      where,
      include: { dates: { orderBy: { date: 'asc' } } },
    })

    // 按月份分组
    const byMonth: Record<number, any[]> = {}
    if (list) {
      for (const d of list.dates) {
        const m = dayjs(d.date).month() + 1
        if (!byMonth[m]) byMonth[m] = []
        byMonth[m].push({
          date: dayjs(d.date).format('YYYY-MM-DD'),
          name: d.name,
          isWorkingDay: d.isWorkingDay,
          description: d.description,
        })
      }
    }

    return { code: 0, data: { list, byMonth } }
  })
}
