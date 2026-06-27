import { FastifyInstance, FastifyRequest } from 'fastify'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, statusSchema, validateData } from '../utils/validation'
import { z } from 'zod'

const auditLogQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  module: z.string().trim().max(50).optional(),
  action: z.string().trim().max(100).optional(),
  status: statusSchema,
  username: optionalKeywordSchema,
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
}).refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

function summarizeJson(value: unknown) {
  if (!value) return undefined
  const text = JSON.stringify(value)
  return text.length > 240 ? `${text.slice(0, 240)}...` : text
}

export default async function securityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/audit-logs', { preHandler: [requirePermission('security:audit:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(auditLogQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { module, action, status, username, startDate, endDate } = query
    const where: any = {}

    if (module) where.module = module
    if (action) where.action = { contains: action }
    if (status) where.status = status
    if (username) where.username = { contains: username }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [total, list] = await Promise.all([
      prisma.systemLog.count({ where }),
      prisma.systemLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          username: true,
          action: true,
          module: true,
          ipAddress: true,
          userAgent: true,
          requestData: true,
          responseData: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    const summaryList = list.map((item) => ({
      ...item,
      requestSummary: summarizeJson(item.requestData),
      responseSummary: summarizeJson(item.responseData),
      requestData: undefined,
      responseData: undefined,
    }))

    return {
      code: 0,
      data: {
        list: summaryList,
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/audit-logs/:id', { preHandler: [requirePermission('security:audit:view')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const log = await prisma.systemLog.findUnique({ where: { id } })
    if (!log) {
      return { code: 404, message: '审计日志不存在' }
    }
    return { code: 0, data: log }
  })
}
