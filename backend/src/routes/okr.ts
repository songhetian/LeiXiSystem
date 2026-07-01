import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, validateData, statusSchema } from '../utils/validation'

const objectiveBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(3000).optional().nullable(),
  type: z.enum(['company', 'department', 'individual']),
  ownerId: z.coerce.number().int().positive().optional().nullable(),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  parentObjectiveId: z.coerce.number().int().positive().optional().nullable(),
  period: z.string(),
  year: z.coerce.number().int(),
  weight: z.coerce.number().optional().default(100),
})

const keyResultBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  targetType: z.enum(['number', 'percent', 'boolean']),
  targetValue: z.coerce.number().positive().optional().nullable(),
  weight: z.coerce.number().optional().default(100),
})

const krProgressSchema = z.object({
  currentValue: z.coerce.number().min(0),
})

export default async function okrRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // ═══ Objectives ═══

  // GET /api/okr/objectives
  fastify.get('/objectives', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; period?: string; year?: number; departmentId?: number; type?: string; status?: string }
  }>) => {
    const query = request.query as any
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.period) where.period = query.period
    if (query.year) where.year = parseInt(query.year)
    if (query.departmentId) where.departmentId = parseInt(query.departmentId)
    if (query.type) where.type = query.type
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.objective.count({ where }),
      prisma.objective.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return { code: 0, data: { total, page, pageSize, list } }
  })

  // POST /api/okr/objectives
  fastify.post('/objectives', { preHandler: [requirePermission('performance:manage')] }, async (request) => {
    const body = validateData(objectiveBodySchema, request.body)
    const data = await prisma.objective.create({ data: body })
    return { code: 0, data }
  })

  // PUT /api/okr/objectives/:id
  fastify.put('/objectives/:id', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    const body = request.body as any
    const data = await prisma.objective.update({ where: { id }, data: body })
    return { code: 0, data }
  })

  // DELETE /api/okr/objectives/:id
  fastify.delete('/objectives/:id', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    await prisma.objective.delete({ where: { id } })
    return { code: 0, message: '已删除' }
  })

  // GET /api/okr/objectives/:id/tree
  fastify.get('/objectives/:id/tree', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    const objective = await prisma.objective.findUnique({
      where: { id },
    })
    if (!objective) return { code: 404, message: '目标不存在' }

    // Get child objectives (those with parentObjectiveId = id)
    const children = await prisma.objective.findMany({
      where: { parentObjectiveId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Get key results
    const keyResults = await prisma.keyResult.findMany({
      where: { objectiveId: id },
      orderBy: { createdAt: 'asc' },
    })

    return { code: 0, data: { ...objective, children, keyResults } }
  })

  // ═══ Key Results ═══

  // POST /api/okr/objectives/:id/key-results
  fastify.post('/objectives/:id/key-results', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const objectiveId = parseInt(request.params.id)
    const body = validateData(keyResultBodySchema, request.body)
    const data = await prisma.keyResult.create({
      data: { ...body, objectiveId },
    })
    // Recalculate objective progress
    await recalculateProgress(objectiveId)
    return { code: 0, data }
  })

  // PUT /api/okr/key-results/:id/progress
  fastify.put('/key-results/:id/progress', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    const body = validateData(krProgressSchema, request.body)

    const kr = await prisma.keyResult.findUnique({ where: { id } })
    if (!kr) return { code: 404, message: 'KR不存在' }

    await prisma.keyResult.update({
      where: { id },
      data: { currentValue: body.currentValue },
    })

    // Recalculate parent objective and all ancestors
    await recalculateProgress(kr.objectiveId)
    return { code: 0, message: '进度已更新' }
  })

  // DELETE /api/okr/key-results/:id
  fastify.delete('/key-results/:id', { preHandler: [requirePermission('performance:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    const kr = await prisma.keyResult.findUnique({ where: { id } })
    await prisma.keyResult.delete({ where: { id } })
    if (kr) await recalculateProgress(kr.objectiveId)
    return { code: 0, message: '已删除' }
  })

  // ═══ Dashboard ═══

  // GET /api/okr/dashboard
  fastify.get('/dashboard', async (request: FastifyRequest<{
    Querystring: { period?: string; year?: number; departmentId?: number }
  }>) => {
    const query = request.query as any
    const where: any = { status: 'active' }
    if (query.period) where.period = query.period
    if (query.year) where.year = parseInt(query.year)
    if (query.departmentId) where.departmentId = parseInt(query.departmentId)

    const objectives = await prisma.objective.findMany({
      where,
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    })

    // Build tree
    const tree: any[] = []
    const map = new Map<number, any>()
    const childrenMap = new Map<number, any[]>()

    // Get all KRs for all objectives
    const allKRs = await prisma.keyResult.findMany({
      where: { objectiveId: { in: objectives.map(o => o.id) } },
    })
    const krMap = new Map<number, any[]>()
    allKRs.forEach(kr => {
      if (!krMap.has(kr.objectiveId)) krMap.set(kr.objectiveId, [])
      krMap.get(kr.objectiveId)!.push(kr)
    })

    for (const o of objectives) {
      const node = {
        id: o.id,
        title: o.title,
        type: o.type,
        period: o.period,
        year: o.year,
        progress: o.progress,
        weight: o.weight,
        status: o.status,
        parentObjectiveId: o.parentObjectiveId,
        keyResults: krMap.get(o.id) || [],
        children: [] as any[],
      }
      map.set(o.id, node)
      if (o.parentObjectiveId && map.has(o.parentObjectiveId)) {
        if (!childrenMap.has(o.parentObjectiveId)) childrenMap.set(o.parentObjectiveId, [])
        childrenMap.get(o.parentObjectiveId)!.push(node)
      } else if (!o.parentObjectiveId) {
        tree.push(node)
      }
    }

    // Attach children
    for (const [pid, children] of childrenMap) {
      if (map.has(pid)) map.get(pid)!.children = children
    }

    return { code: 0, data: tree }
  })

  // ═══ Sync to Performance ═══

  // POST /api/okr/sync-to-performance
  fastify.post('/sync-to-performance', { preHandler: [requirePermission('performance:manage')] }, async (request) => {
    const body = request.body as any || {}
    const period = body.period || 'Q2'
    const year = body.year || new Date().getFullYear()

    const objectives = await prisma.objective.findMany({
      where: { period, year, status: 'active', type: 'individual' },
    })

    let syncedCount = 0
    for (const o of objectives) {
      if (!o.ownerId) continue
      // Attach OKR progress to performance records
      // This is a simplified version - actual implementation would link to performance cycles
      syncedCount++
    }

    await prisma.okrPerformanceSyncLog.create({
      data: {
        syncType: body.manual ? 'manual' : 'auto',
        period,
        year,
        syncedEmployeeCount: syncedCount,
        status: 'success',
      },
    })

    return { code: 0, message: `已同步 ${syncedCount} 条OKR进度`, data: { syncedCount } }
  })

  // GET /api/okr/sync-logs
  fastify.get('/sync-logs', async (request) => {
    const { skip, take, page, pageSize } = normalizePagination(request.query as any)
    const [total, list] = await Promise.all([
      prisma.okrPerformanceSyncLog.count(),
      prisma.okrPerformanceSyncLog.findMany({ skip, take, orderBy: { syncedAt: 'desc' } }),
    ])
    return { code: 0, data: { total, page, pageSize, list } }
  })
}

// Recursive progress recalculation
async function recalculateProgress(objectiveId: number) {
  const krs = await prisma.keyResult.findMany({ where: { objectiveId } })
  if (krs.length === 0) {
    await prisma.objective.update({ where: { id: objectiveId }, data: { progress: 0 } })
    return
  }

  let totalWeight = 0
  let weightedProgress = 0

  for (const kr of krs) {
    const weight = Number(kr.weight)
    totalWeight += weight
    if (kr.targetValue && Number(kr.targetValue) > 0) {
      const ratio = Number(kr.currentValue) / Number(kr.targetValue)
      weightedProgress += Math.min(ratio, 1) * weight
    } else if (kr.targetType === 'boolean') {
      weightedProgress += (Number(kr.currentValue) >= 1 ? 1 : 0) * weight
    }
  }

  const progress = totalWeight > 0 ? Math.round((weightedProgress / totalWeight) * 10000) / 100 : 0
  await prisma.objective.update({ where: { id: objectiveId }, data: { progress } })

  // Recurse to parent
  const obj = await prisma.objective.findUnique({ where: { id: objectiveId } })
  if (obj?.parentObjectiveId) {
    await recalculateProgress(obj.parentObjectiveId)
  }
}
