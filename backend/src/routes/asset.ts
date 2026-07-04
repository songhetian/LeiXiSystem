import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { getAccessibleAsset } from '../services/objectAuthorization'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../utils/validation'
import { generateCode } from '../utils/codeGenerator'

const categorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(50).regex(/^[a-zA-Z0-9_-]+$/, '分类编码只能包含字母、数字、下划线和横线').optional(),
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

const assetUpdateSchema = partialUpdateSchema(assetBodySchema)

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
    setAudit(request, {
      action: 'asset_category_create',
      module: 'asset',
      requestData: body,
    })
    const code = body.code || await generateCode('assetCategory', prisma.assetCategory)
    const category = await prisma.assetCategory.create({ data: { ...body, code } })
    setAfter(request, { id: category.id })
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

  fastify.get('/items/:id', { preHandler: [requireAnyPermission(['asset:view', 'asset:manage', 'asset:assign'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const asset = await getAccessibleAsset(
      request.user,
      () => prisma.assetItem.findUnique({
        where: { id },
        include: {
          category: true,
          currentEmployee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          assignments: {
            orderBy: { assignedAt: 'desc' },
            include: {
              employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
              operator: { select: { realName: true } },
            },
          },
        },
      }),
      (item) => item.id,
    )

    if (!asset) {
      return { code: 404, message: '资产不存在' }
    }

    return { code: 0, data: asset }
  })

  fastify.post('/items', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(assetBodySchema, request.body)
    setAudit(request, {
      action: 'asset_item_create',
      module: 'asset',
      requestData: body,
    })
    const asset = await prisma.assetItem.create({
      data: {
        ...body,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
      },
    })
    setAfter(request, { id: asset.id })
    return { code: 0, message: '创建成功', data: asset }
  })

  fastify.put('/items/:id', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(assetUpdateSchema, request.body)
    requireAtLeastOneField(data)

    const asset = await getAccessibleAsset(
      request.user,
      () => prisma.assetItem.findUnique({ where: { id } }),
      (item) => item.id,
    )

    if (!asset) {
      return { code: 404, message: '资产不存在' }
    }

    const updatedAsset = await prisma.assetItem.update({
      where: { id },
      data: {
        ...data,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
      },
    })
    return { code: 0, message: '更新成功', data: updatedAsset }
  })

  fastify.post('/items/:id/assign', { preHandler: [requirePermission('asset:assign')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(assignAssetSchema, request.body)

    const asset = await getAccessibleAsset(
      request.user,
      () => prisma.assetItem.findUnique({ where: { id } }),
      (item) => item.id,
    )

    if (!asset) {
      return { code: 404, message: '资产不存在' }
    }
    if (asset.status === 'retired') return { code: 400, message: '已报废资产不能领用' }

    setAudit(request, {
      action: 'asset_assign',
      module: 'asset',
      requestData: { assetId: id, ...body },
    })

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

    setAfter(request, { id: assignment.id })

    return { code: 0, message: '领用成功', data: assignment }
  })

  fastify.post('/items/:id/return', { preHandler: [requirePermission('asset:assign')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(returnAssetSchema, request.body || {})

    const asset = await getAccessibleAsset(
      request.user,
      () => prisma.assetItem.findUnique({ where: { id } }),
      (item) => item.id,
    )

    if (!asset) {
      return { code: 404, message: '资产不存在' }
    }
    if (!asset.currentEmployeeId) return { code: 400, message: '资产当前未领用' }

    setAudit(request, {
      action: 'asset_return',
      module: 'asset',
      requestData: { assetId: id, ...body },
    })

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

    setAfter(request, { assetId: id })

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

  // 资产转移（重新分配给其他员工）
  fastify.post('/items/:id/transfer', { preHandler: [requirePermission('asset:assign')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(assignAssetSchema, request.body)

    const asset = await getAccessibleAsset(
      request.user,
      () => prisma.assetItem.findUnique({ where: { id } }),
      (item) => item.id,
    )

    if (!asset) return { code: 404, message: '资产不存在' }
    if (asset.status === 'retired') return { code: 400, message: '已报废资产不能转移' }

    setAudit(request, {
      action: 'asset_transfer',
      module: 'asset',
      requestData: { assetId: id, employeeId: body.employeeId, note: body.note },
    })

    const assignment = await prisma.$transaction(async (tx) => {
      if (asset.currentEmployeeId) {
        await tx.assetAssignment.updateMany({
          where: { assetId: id, returnedAt: null },
          data: { returnedAt: new Date(), note: body.note ? `转移：${body.note}` : '资产转移' },
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
          action: 'transfer',
          operatorId: request.user.id,
          note: body.note,
        },
      })
    })

    setAfter(request, { id: assignment.id })

    return { code: 0, message: '转移成功', data: assignment }
  })

  // 资产报废
  fastify.post('/items/:id/retire', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(returnAssetSchema, request.body || {})

    const asset = await getAccessibleAsset(
      request.user,
      () => prisma.assetItem.findUnique({ where: { id } }),
      (item) => item.id,
    )

    if (!asset) return { code: 404, message: '资产不存在' }
    if (asset.status === 'retired') return { code: 400, message: '资产已报废' }

    setAudit(request, {
      action: 'asset_retire',
      module: 'asset',
      beforeData: { id: asset.id, status: asset.status },
      requestData: { assetId: id, note: body.note },
    })

    await prisma.$transaction(async (tx) => {
      if (asset.currentEmployeeId) {
        await tx.assetAssignment.updateMany({
          where: { assetId: id, returnedAt: null },
          data: { returnedAt: new Date(), note: '资产报废' },
        })
      }
      await tx.assetItem.update({
        where: { id },
        data: { currentEmployeeId: null, status: 'retired' },
      })
    })

    setAfter(request, { id, status: 'retired' })

    return { code: 0, message: '报废成功' }
  })

  // 删除资产
  fastify.delete('/items/:id', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const asset = await prisma.assetItem.findUnique({ where: { id } })
    if (!asset) return { code: 404, message: '资产不存在' }

    const activeAssignments = await prisma.assetAssignment.count({
      where: { assetId: id, status: { in: ['assigned', 'pending'] } },
    })
    if (activeAssignments > 0) {
      return { code: 400, message: '该资产有未归还的分配记录，请先完成归还' }
    }

    const maintenanceCount = await prisma.assetItem.count({
      where: { id, maintenanceCount: { gt: 0 } },
    })
    if (maintenanceCount > 0) {
      return { code: 400, message: '该资产有维修记录，无法删除' }
    }

    setAudit(request, {
      action: 'asset_item_delete',
      module: 'asset',
      beforeData: { id: asset.id, name: asset.name, assetNo: asset.assetNo },
      requestData: { id },
    })

    await prisma.assetItem.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  const batchIdsSchema = z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1).max(100),
  })

  const batchStatusSchema = batchIdsSchema.extend({
    status: z.enum(['available', 'in_use', 'repair', 'scrapped', 'lost']),
  })

  fastify.post('/items/batch-delete', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { ids } = validateData(batchIdsSchema, request.body)

    const assets = await prisma.assetItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, assetNo: true, maintenanceCount: true },
    })

    const activeAssignments = await prisma.assetAssignment.count({
      where: { assetId: { in: ids }, status: { in: ['assigned', 'pending'] } },
    })
    if (activeAssignments > 0) {
      return { code: 400, message: '部分资产有未归还的分配记录，请先完成归还' }
    }

    const hasMaintenance = assets.some((a) => a.maintenanceCount > 0)
    if (hasMaintenance) {
      return { code: 400, message: '部分资产有维修记录，无法删除' }
    }

    setAudit(request, {
      action: 'asset_item_batch_delete',
      module: 'asset',
      beforeData: { ids, count: assets.length },
      requestData: { ids },
    })

    const result = await prisma.assetItem.deleteMany({
      where: { id: { in: ids } },
    })

    return { code: 0, message: `删除成功（${result.count} 条）`, data: { count: result.count } }
  })

  fastify.post('/items/batch-status', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { ids, status } = validateData(batchStatusSchema, request.body)

    setAudit(request, {
      action: 'asset_item_batch_status',
      module: 'asset',
      requestData: { ids, status },
    })

    const result = await prisma.assetItem.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    setAfter(request, { count: result.count })

    return { code: 0, message: `状态更新成功（${result.count} 条）`, data: { count: result.count } }
  })

  // 批量分配资产
  fastify.post('/items/batch-assign', { preHandler: [requirePermission('asset:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { ids, employeeId, note } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个资产'),
      employeeId: positiveIntSchema,
      note: z.string().trim().max(1000).optional(),
    }), request.body)

    const assets = await prisma.assetItem.findMany({
      where: { id: { in: ids } },
    })

    let successCount = 0
    const results: Array<{ id: number; assignmentId?: number; error?: string }> = []

    for (const assetId of ids) {
      try {
        const assignment = await prisma.$transaction(async (tx) => {
          // 如果资产当前有分配，先归还
          await tx.assetAssignment.updateMany({
            where: { assetId, returnedAt: null },
            data: { returnedAt: new Date(), note: '批量分配前归还' },
          })
          // 更新资产状态
          await tx.assetItem.update({
            where: { id: assetId },
            data: { currentEmployeeId: employeeId, status: 'assigned' },
          })
          // 创建分配记录
          return tx.assetAssignment.create({
            data: {
              assetId,
              employeeId,
              action: 'assign',
              operatorId: request.user.id,
              note,
            },
          })
        })
        successCount++
        results.push({ id: assetId, assignmentId: assignment.id })
      } catch (e) {
        results.push({ id: assetId, error: String(e) })
      }
    }

    setAudit(request, {
      module: 'asset',
      action: 'asset.batchAssign',
      requestData: { ids, employeeId, note, successCount },
    })

    return {
      code: 0,
      message: `成功分配 ${successCount} 个资产`,
      data: { successCount, failedCount: ids.length - successCount, results },
    }
  })

  // 批量归还资产
  fastify.post('/items/batch-return', { preHandler: [requirePermission('asset:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { ids, note } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个资产'),
      note: z.string().trim().max(1000).optional(),
    }), request.body)

    let successCount = 0

    for (const assetId of ids) {
      await prisma.$transaction(async (tx) => {
        await tx.assetAssignment.updateMany({
          where: { assetId, returnedAt: null },
          data: { returnedAt: new Date(), note: note || '批量归还' },
        })
        await tx.assetItem.update({
          where: { id: assetId },
          data: { currentEmployeeId: null, status: 'available' },
        })
      })
      successCount++
    }

    setAudit(request, {
      module: 'asset',
      action: 'asset.batchReturn',
      requestData: { ids, note, successCount },
    })

    return {
      code: 0,
      message: `成功归还 ${successCount} 个资产`,
      data: { successCount, failedCount: ids.length - successCount },
    }
  })

  // 导出资产分配记录
  fastify.post('/assignments/export', { preHandler: [requireAnyPermission(['asset:view', 'asset:manage'])] }, async (request: FastifyRequest<{
    Body: {
      categoryId?: number
      status?: string
      fields?: string[]
    }
  }>) => {
    const body = request.body as any
    const { categoryId, status, fields = [] } = body || {}

    const where: any = {}
    if (status === 'assigned') {
      where.returnedAt = null
    } else if (status === 'returned') {
      where.returnedAt = { not: null }
    }
    if (categoryId) where.asset = { categoryId }

    const assignments = await prisma.assetAssignment.findMany({
      where,
      select: {
        assignedAt: true,
        returnedAt: true,
        note: true,
        operator: { select: { realName: true } },
        asset: {
          select: {
            assetNo: true,
            name: true,
            category: { select: { name: true } },
          },
        },
        employee: {
          select: {
            employeeNo: true,
            department: { select: { name: true } },
            user: { select: { realName: true } },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    })

    const rows = assignments.map((a: any) => ({
      assetNo: a.asset?.assetNo || '-',
      assetName: a.asset?.name || '-',
      category: a.asset?.category?.name || '-',
      employeeNo: a.employee?.employeeNo || '-',
      employeeName: a.employee?.user?.realName || '-',
      department: a.employee?.department?.name || '-',
      assignedAt: a.assignedAt ? new Date(a.assignedAt).toISOString().split('T')[0] : '-',
      returnedAt: a.returnedAt ? new Date(a.returnedAt).toISOString().split('T')[0] : '-',
      status: a.returnedAt ? '已归还' : '使用中',
      operator: a.operator?.realName || '-',
      note: a.note || '-',
    }))

    return {
      code: 0,
      message: `共 ${rows.length} 条数据`,
      data: {
        filename: `资产分配记录_${new Date().toISOString().split('T')[0]}.xlsx`,
        fields: fields.length > 0 ? fields : ['assetNo', 'assetName', 'category', 'employeeNo', 'employeeName', 'department', 'assignedAt', 'returnedAt', 'status', 'operator', 'note'],
        rows,
      },
    }
  })

  // ══════════════════════════════════════════════
  // G5: 资产配件管理
  // ══════════════════════════════════════════════

  // GET /api/asset/items/:id/components
  fastify.get('/items/:id/components', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const assetId = parseInt(request.params.id)
    const components = await prisma.assetComponent.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
    })
    return { code: 0, data: components }
  })

  // POST /api/asset/items/:id/components
  fastify.post('/items/:id/components', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const assetId = parseInt(request.params.id)
    const body = request.body as any
    const userId = (request as any).user.id

    const component = await prisma.assetComponent.create({
      data: {
        assetId,
        componentName: body.componentName,
        componentType: body.componentType,
        specification: body.specification,
        serialNo: body.serialNo,
      },
    })

    // 记录操作日志
    await prisma.assetOperation.create({
      data: {
        assetId,
        operationType: 'add_component',
        operationDetail: { action: 'add', component: body.componentName, spec: body.specification },
        operatedBy: userId,
      },
    })

    return { code: 0, data: component }
  })

  // PUT /api/asset/items/components/:compId
  fastify.put('/items/components/:compId', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: { compId: string } }>) => {
    const compId = parseInt(request.params.compId)
    const body = request.body as any
    const userId = (request as any).user.id

    const existing = await prisma.assetComponent.findUnique({ where: { id: compId } })
    if (!existing) return { code: 404, message: '配件不存在' }

    const updateData: any = {}
    if (body.specification !== undefined) updateData.specification = body.specification
    if (body.status !== undefined) updateData.status = body.status
    if (body.status === 'removed') updateData.removedAt = new Date()

    const component = await prisma.assetComponent.update({
      where: { id: compId },
      data: updateData,
    })

    // 记录操作日志
    await prisma.assetOperation.create({
      data: {
        assetId: existing.assetId,
        operationType: body.status === 'removed' ? 'remove_component' : 'upgrade_component',
        operationDetail: {
          action: body.status === 'removed' ? 'remove' : 'upgrade',
          component: existing.componentName,
          from: existing.specification,
          to: body.specification || 'removed',
        },
        operatedBy: userId,
        note: body.note,
      },
    })

    return { code: 0, data: component }
  })

  // DELETE /api/asset/items/components/:compId
  fastify.delete('/items/components/:compId', { preHandler: [requirePermission('asset:manage')] }, async (request: FastifyRequest<{ Params: { compId: string } }>) => {
    const compId = parseInt(request.params.compId)
    const userId = (request as any).user.id
    const component = await prisma.assetComponent.findUnique({ where: { id: compId } })
    if (!component) return { code: 404, message: '配件不存在' }

    await prisma.assetOperation.create({
      data: {
        assetId: component.assetId,
        operationType: 'remove_component',
        operationDetail: { action: 'remove', component: component.componentName, spec: component.specification },
        operatedBy: userId,
      },
    })

    await prisma.assetComponent.delete({ where: { id: compId } })
    return { code: 0, message: '配件已移除' }
  })

  // GET /api/asset/items/:id/operations
  fastify.get('/items/:id/operations', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const assetId = parseInt(request.params.id)
    const operations = await prisma.assetOperation.findMany({
      where: { assetId },
      orderBy: { operatedAt: 'desc' },
    })
    return { code: 0, data: operations }
  })
}
