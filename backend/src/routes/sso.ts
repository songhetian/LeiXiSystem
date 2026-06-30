import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, statusSchema, validateData } from '../utils/validation'
import { parseSafeHttpUrl } from '../utils/security'

const ssoListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  status: statusSchema,
})

const ssoAppBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '应用编码只能包含字母、数字、下划线和横线'),
  appUrl: z.string().trim().min(1).max(500),
  logoUrl: z.string().trim().max(500).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

const ssoAppUpdateSchema = ssoAppBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

export default async function ssoRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/apps', { preHandler: [requirePermission('sso:manage')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(ssoListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.status) where.status = query.status
    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword } },
        { code: { contains: query.keyword } },
      ]
    }

    const [total, list] = await Promise.all([
      prisma.ssoApp.count({ where }),
      prisma.ssoApp.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/apps', { preHandler: [requirePermission('sso:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(ssoAppBodySchema, request.body)
    const appUrl = parseSafeHttpUrl(body.appUrl)
    const logoUrl = body.logoUrl ? parseSafeHttpUrl(body.logoUrl) : undefined

    setAudit(request, { action: 'sso_app_create', module: 'sso', requestData: { ...body, appUrl, logoUrl } })

    const app = await prisma.ssoApp.create({
      data: {
        ...body,
        appUrl,
        logoUrl,
      },
    })

    setAfter(request, { id: app.id })

    return { code: 0, message: '创建成功', data: app }
  })

  fastify.put('/apps/:id', { preHandler: [requirePermission('sso:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(ssoAppUpdateSchema, request.body)
    const data: any = { ...body }

    if (body.appUrl) data.appUrl = parseSafeHttpUrl(body.appUrl)
    if (body.logoUrl) data.logoUrl = parseSafeHttpUrl(body.logoUrl)

    setAudit(request, { action: 'sso_app_update', module: 'sso', requestData: { id, ...data } })
    await captureBefore(request, { id })
    const app = await prisma.ssoApp.update({
      where: { id },
      data,
    })

    setAfter(request, { id: app.id })

    return { code: 0, message: '更新成功', data: app }
  })

  fastify.delete('/apps/:id', { preHandler: [requirePermission('sso:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    setAudit(request, { action: 'sso_app_delete', module: 'sso', requestData: { id } })
    await captureBefore(request, { id })
    await prisma.ssoApp.delete({ where: { id } })

    setAfter(request, { id })

    return { code: 0, message: '删除成功' }
  })
}
