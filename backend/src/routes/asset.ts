import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { writeAuditLog } from '../services/audit'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '分类编码只能包含字母、数字、下划线和横线'),
  description: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
})

const assetListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  categoryId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  status: statusSchema,
})

const assetBodySchema = z.object({
  assetNo: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  categoryId: positiveIntSchema,
  brand: z.string().trim().max(100).optional().nullable(),
  model: z.string().trim().max(100).optional().nullable(),
  serialNo: z.string().trim().max(100).optional().nullable(),
  purchaseDate: dateStringSchema.optional().nullable(),
  purchaseAmount: z.coerce.number().min(0).max(99999999).optional().nullable(),
  location: z.string().trim().max(100).optional().nullable(),
  status: z.enum(['idle', 'assigned', 'maintenance', 'retired']).optional().default('idle'),
  remark: z.string().trim().max(1000).optional().nullable(),
})

const assetUpdateSchema = assetBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const assignAssetSchema = z.object({
  employeeId: positiveIntSchema,
  note: z.string().trim().max(1000).optional(),
})

const returnAssetSchema = z.object({
  note: z.string().trim().max(1000).optional(),
})

export default async function assetRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/categories', { preHandler: [requireAnyPermission(['asset:view', 'asset:manage'])] }, async () => {
    const list = await prisma.assetCategory.findMany({
      where: { status: { not: 'deleted' } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
    })
    return { code: 0, data: list }
  })

  fastify.post('/categories', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(categorySchema, request.body)
    const category = await prisma.assetCategory.create({ data: body })
    await writeAuditLog(request, {
      action: 'asset_category_create',
      module: 'asset',
      requestData: body,
      responseData: { id: category.id },
    })
    return { code: 0, message: '创建成功', data: category }
  })

  fastify.delete('/categories/:id', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const used = await prisma.assetItem.count({ where: { categoryId: id, status: { not: 'retired' } } })
    if (used > 0) {
      return { code: 400, message: '该分类下仍有资产，无法删除' }
    }
    await prisma.assetCategory.update({ where: { id }, data: { status: 'deleted' } })
    return { code: 0, message: '删除成功' }
  })

  fastify.get('/items', { preHandler: [requireAnyPermission(['asset:view', 'asset:manage', 'asset:assign'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(assetListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.categoryId) where.categoryId = query.categoryId
    if (query.employeeId) where.currentEmployeeId = query.employeeId
    if (query.status) where.status = query.status
    if (query.keyword) {
      where.OR = [
        { assetNo: { contains: query.keyword } },
        { name: { contains: query.keyword } },
        { brand: { contains: query.keyword } },
        { model: { contains: query.keyword } },
        { serialNo: { contains: query.keyword } },
      ]
    }

    const [total, list] = await Promise.all([
      prisma.assetItem.count({ where }),
      prisma.assetItem.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: {
          category: true,
          currentEmployee: { select: { employeeNo: true, user: { select: { realName: true } } } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/items', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(assetBodySchema, request.body)
    const asset = await prisma.assetItem.create({
      data: {
        ...body,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
      },
    })
    await writeAuditLog(request, {
      action: 'asset_item_create',
      module: 'asset',
      requestData: body,
      responseData: { id: asset.id },
    })
    return { code: 0, message: '创建成功', data: asset }
  })

  fastify.put('/items/:id', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(assetUpdateSchema, request.body)
    const asset = await prisma.assetItem.update({
      where: { id },
      data: {
        ...body,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
      },
    })
    return { code: 0, message: '更新成功', data: asset }
  })

  fastify.post('/items/:id/assign', { preHandler: [requirePermission('asset:assign')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(assignAssetSchema, request.body)
    const asset = await prisma.assetItem.findUnique({ where: { id } })
    if (!asset) return { code: 404, message: '资产不存在' }
    if (asset.status === 'retired') return { code: 400, message: '已报废资产不能领用' }

    const assignment = await prisma.$transaction(async (tx) => {
      if (asset.currentEmployeeId) {
        await tx.assetAssignment.updateMany({
          where: { assetId: id, returnedAt: null },
          data: { returnedAt: new Date(), note: '重新领用自动归还' },
        })
      }

      await tx.assetItem.update({
        where: { id },
        data: { currentEmployeeId: body.employeeId, status: 'assigned' },
      })

      return tx.assetAssignment.create({
        data: {
          assetId: id,
          employeeId: body.employeeId,
          action: 'assign',
          operatorId: request.user.id,
          note: body.note,
        },
      })
    })

    await writeAuditLog(request, {
      action: 'asset_assign',
      module: 'asset',
      requestData: { assetId: id, ...body },
      responseData: { id: assignment.id },
    })

    return { code: 0, message: '领用成功', data: assignment }
  })

  fastify.post('/items/:id/return', { preHandler: [requirePermission('asset:assign')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(returnAssetSchema, request.body || {})
    const asset = await prisma.assetItem.findUnique({ where: { id } })
    if (!asset) return { code: 404, message: '资产不存在' }
    if (!asset.currentEmployeeId) return { code: 400, message: '资产当前未领用' }

    await prisma.$transaction(async (tx) => {
      await tx.assetAssignment.updateMany({
        where: { assetId: id, returnedAt: null },
        data: { returnedAt: new Date(), note: body.note },
      })
      await tx.assetItem.update({
        where: { id },
        data: { currentEmployeeId: null, status: 'idle' },
      })
    })

    await writeAuditLog(request, {
      action: 'asset_return',
      module: 'asset',
      requestData: { assetId: id, ...body },
    })

    return { code: 0, message: '归还成功' }
  })

  fastify.get('/assignments', { preHandler: [requireAnyPermission(['asset:view', 'asset:manage', 'asset:assign'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(assetListQuerySchema.pick({ page: true, pageSize: true, employeeId: true }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) where.employeeId = query.employeeId

    const [total, list] = await Promise.all([
      prisma.assetAssignment.count({ where }),
      prisma.assetAssignment.findMany({
        where,
        skip,
        take,
        orderBy: { assignedAt: 'desc' },
        include: {
          asset: { select: { assetNo: true, name: true } },
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          operator: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })
}
