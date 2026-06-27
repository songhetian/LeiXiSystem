import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'

const orgListQuerySchema = z.object({
  keyword: optionalKeywordSchema,
  status: statusSchema,
})

const positionListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
})

const departmentBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  parentId: positiveIntSchema.optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
  managerId: positiveIntSchema.optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  status: statusSchema,
})

const departmentUpdateSchema = departmentBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const positionBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  departmentId: positiveIntSchema,
  description: z.string().trim().max(1000).optional().nullable(),
  requirements: z.string().trim().max(2000).optional().nullable(),
  responsibilities: z.string().trim().max(2000).optional().nullable(),
  salaryMin: z.coerce.number().min(0).max(99999999).optional().nullable(),
  salaryMax: z.coerce.number().min(0).max(99999999).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  status: statusSchema,
}).refine((value) => !value.salaryMin || !value.salaryMax || value.salaryMin <= value.salaryMax, {
  message: '最低薪资不能大于最高薪资',
})

const positionUpdateSchema = positionBodySchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

export default async function organizationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/departments', async () => {
    const departments = await prisma.department.findMany({
      where: { status: { not: 'deleted' } },
      orderBy: { sortOrder: 'asc' },
      include: { manager: true },
    })

    const buildTree = (parentId: number | null): any[] => {
      return departments
        .filter((d) => d.parentId === parentId)
        .map((d) => ({
          id: d.id,
          name: d.name,
          parentId: d.parentId,
          description: d.description,
          managerId: d.managerId,
          managerName: d.manager?.realName,
          sortOrder: d.sortOrder,
          status: d.status,
          children: buildTree(d.id),
        }))
    }

    return { code: 0, data: buildTree(null) }
  })

  fastify.get('/departments/list', async (request: FastifyRequest<{
    Querystring: { keyword?: string; status?: string }
  }>) => {
    const { keyword, status } = validateData(orgListQuerySchema, request.query)

    const where: any = { status: { not: 'deleted' } }
    if (keyword) where.name = { contains: keyword }
    if (status) where.status = status

    const departments = await prisma.department.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { manager: true, parent: true },
    })

    return {
      code: 0,
      data: departments.map((d) => ({
        id: d.id,
        name: d.name,
        parentId: d.parentId,
        parentName: d.parent?.name,
        description: d.description,
        managerId: d.managerId,
        managerName: d.manager?.realName,
        sortOrder: d.sortOrder,
        status: d.status,
        createdAt: d.createdAt,
      })),
    }
  })

  fastify.post('/departments', { preHandler: [requirePermission('department:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(departmentBodySchema, request.body)

    const dept = await prisma.department.create({
      data: {
        name: body.name,
        parentId: body.parentId ?? undefined,
        description: body.description,
        managerId: body.managerId ?? undefined,
        sortOrder: body.sortOrder || 0,
      },
    })

    return { code: 0, message: '创建成功', data: dept }
  })

  fastify.put('/departments/:id', { preHandler: [requirePermission('department:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(departmentUpdateSchema, request.body)

    await prisma.department.update({
      where: { id },
      data: {
        name: body.name,
        parentId: body.parentId ?? undefined,
        description: body.description,
        managerId: body.managerId ?? undefined,
        sortOrder: body.sortOrder,
        status: body.status,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/departments/:id', { preHandler: [requirePermission('department:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const hasChildren = await prisma.department.count({
      where: { parentId: id, status: { not: 'deleted' } },
    })

    if (hasChildren > 0) {
      return { code: 400, message: '该部门下还有子部门，无法删除' }
    }

    await prisma.department.update({
      where: { id },
      data: { status: 'deleted' },
    })

    return { code: 0, message: '删除成功' }
  })

  fastify.get('/positions', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; keyword?: string; departmentId?: number }
  }>) => {
    const query = validateData(positionListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { keyword, departmentId } = query

    const where: any = { status: { not: 'deleted' } }
    if (keyword) where.name = { contains: keyword }
    if (departmentId) where.departmentId = departmentId

    const [total, list] = await Promise.all([
      prisma.position.count({ where }),
      prisma.position.findMany({
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
        list: list.map((p) => ({
          id: p.id,
          name: p.name,
          departmentId: p.departmentId,
          departmentName: p.department?.name,
          description: p.description,
          salaryMin: p.salaryMin,
          salaryMax: p.salaryMax,
          sortOrder: p.sortOrder,
          status: p.status,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.post('/positions', { preHandler: [requirePermission('position:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(positionBodySchema, request.body)

    const position = await prisma.position.create({
      data: {
        name: body.name,
        departmentId: body.departmentId,
        description: body.description,
        requirements: body.requirements,
        responsibilities: body.responsibilities,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        sortOrder: body.sortOrder || 0,
      },
    })

    return { code: 0, message: '创建成功', data: position }
  })

  fastify.put('/positions/:id', { preHandler: [requirePermission('position:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(positionUpdateSchema, request.body)

    await prisma.position.update({
      where: { id },
      data: {
        name: body.name,
        departmentId: body.departmentId,
        description: body.description,
        requirements: body.requirements,
        responsibilities: body.responsibilities,
        salaryMin: body.salaryMin,
        salaryMax: body.salaryMax,
        sortOrder: body.sortOrder,
        status: body.status,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/positions/:id', { preHandler: [requirePermission('position:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    await prisma.position.update({
      where: { id },
      data: { status: 'deleted' },
    })

    return { code: 0, message: '删除成功' }
  })
}
