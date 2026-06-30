import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, optionalKeywordSchema, positiveIntSchema, validateData } from '../utils/validation'

const tagCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().trim().max(20).optional().nullable(),
  description: z.string().trim().max(200).optional().nullable(),
  sortOrder: z.number().int().optional().default(0),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

const tagUpdateSchema = tagCreateSchema.partial()

export default async function employeeTagRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/employee-tags', async (request: FastifyRequest<{
    Querystring: {
      status?: string
      keyword?: string
    }
  }>) => {
    const { status, keyword } = request.query

    const where: any = {}
    if (status) where.status = status
    if (keyword) where.name = { contains: keyword }

    const list = await prisma.employeeTag.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        _count: { select: { assignments: true } },
      },
    })

    return {
      code: 0,
      data: list.map(t => ({
        id: t.id,
        name: t.name,
        color: t.color,
        description: t.description,
        sortOrder: t.sortOrder,
        status: t.status,
        employeeCount: t._count.assignments,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    }
  })

  fastify.get('/employee-tags/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const tag = await prisma.employeeTag.findUnique({
      where: { id },
      include: {
        _count: { select: { assignments: true } },
      },
    })

    if (!tag) {
      return reply.status(404).send({ code: 404, message: '标签不存在' })
    }

    return {
      code: 0,
      data: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: tag.description,
        sortOrder: tag.sortOrder,
        status: tag.status,
        employeeCount: tag._count.assignments,
        createdAt: tag.createdAt,
        updatedAt: tag.updatedAt,
      },
    }
  })

  fastify.post('/employee-tags', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(tagCreateSchema, request.body)

    const existing = await prisma.employeeTag.findUnique({ where: { name: body.name } })
    if (existing) {
      return { code: 400, message: '标签名称已存在' }
    }

    const tag = await prisma.employeeTag.create({ data: body })
    return { code: 0, message: '创建成功', data: tag }
  })

  fastify.put('/employee-tags/:id', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(tagUpdateSchema, request.body)

    const existing = await prisma.employeeTag.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '标签不存在' })
    }

    if (body.name && body.name !== existing.name) {
      const duplicate = await prisma.employeeTag.findUnique({ where: { name: body.name } })
      if (duplicate) {
        return { code: 400, message: '标签名称已存在' }
      }
    }

    const tag = await prisma.employeeTag.update({ where: { id }, data: body })
    return { code: 0, message: '更新成功', data: tag }
  })

  fastify.delete('/employee-tags/:id', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.employeeTag.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '标签不存在' })
    }

    await prisma.employeeTag.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  fastify.get('/employee-tags/:id/employees', async (request: FastifyRequest<{
    Params: { id: string }
    Querystring: {
      page?: number
      pageSize?: number
    }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { page, pageSize, skip, take } = normalizePagination(request.query)

    const tag = await prisma.employeeTag.findUnique({ where: { id } })
    if (!tag) {
      return reply.status(404).send({ code: 404, message: '标签不存在' })
    }

    const [total, assignments] = await Promise.all([
      prisma.employeeTagAssignment.count({ where: { tagId: id } }),
      prisma.employeeTagAssignment.findMany({
        where: { tagId: id },
        skip,
        take,
        include: {
          employee: {
            include: {
              user: {
                include: {
                  department: { select: { id: true, name: true } },
                  position: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ])

    const list = assignments.map(a => ({
      id: a.employee.id,
      employeeNo: a.employee.employeeNo,
      realName: a.employee.user?.realName,
      avatar: a.employee.user?.avatar,
      department: a.employee.user?.department,
      position: a.employee.user?.position,
    }))

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/employee-tags/:id/employees', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { employeeIds: number[] }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { employeeIds } = request.body as { employeeIds: number[] }

    const tag = await prisma.employeeTag.findUnique({ where: { id } })
    if (!tag) {
      return reply.status(404).send({ code: 404, message: '标签不存在' })
    }

    if (!employeeIds?.length) {
      return { code: 0, message: '未添加任何员工' }
    }

    const data = employeeIds.map(employeeId => ({ employeeId, tagId: id }))
    await prisma.employeeTagAssignment.createMany({ data, skipDuplicates: true })

    return { code: 0, message: '添加成功' }
  })

  fastify.delete('/employee-tags/:id/employees', { preHandler: [requirePermission('employee:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { employeeIds: number[] }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { employeeIds } = request.body as { employeeIds: number[] }

    const tag = await prisma.employeeTag.findUnique({ where: { id } })
    if (!tag) {
      return reply.status(404).send({ code: 404, message: '标签不存在' })
    }

    if (!employeeIds?.length) {
      return { code: 0, message: '未移除任何员工' }
    }

    await prisma.employeeTagAssignment.deleteMany({
      where: { tagId: id, employeeId: { in: employeeIds } },
    })

    return { code: 0, message: '移除成功' }
  })

  fastify.get('/employees/:id/tags', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const assignments = await prisma.employeeTagAssignment.findMany({
      where: { employeeId: id },
      include: { tag: true },
      orderBy: { tag: { sortOrder: 'asc' } },
    })

    return {
      code: 0,
      data: assignments.map(a => a.tag),
    }
  })
}
