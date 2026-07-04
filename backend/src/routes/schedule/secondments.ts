import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { setAudit, setAfter } from '../../plugins/audit'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, validateData } from '../../utils/validation'

const secondmentCreateSchema = z.object({
  employeeId: positiveIntSchema,
  fromDepartmentId: positiveIntSchema,
  toDepartmentId: positiveIntSchema,
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  reason: z.string().trim().max(500).optional().nullable(),
}).refine((value) => new Date(value.startDate) <= new Date(value.endDate), {
  message: '结束日期不能早于开始日期',
})

const secondmentUpdateSchema = z.object({
  toDepartmentId: positiveIntSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  reason: z.string().trim().max(500).optional().nullable(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
})

const secondmentQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  employeeId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
})

export default async function scheduleSecondmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取借调记录列表
  fastify.get('/secondments', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(secondmentQuerySchema, request.query)
    const { page = 1, pageSize = 20 } = query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}
    if (query.keyword) {
      where.OR = [
        { employee: { user: { realName: { contains: query.keyword } } } },
        { reason: { contains: query.keyword } },
      ]
    }
    if (query.employeeId) {
      where.employeeId = query.employeeId
    }
    if (query.departmentId) {
      where.OR = [
        { fromDepartmentId: query.departmentId },
        { toDepartmentId: query.departmentId },
      ]
    }
    if (query.status) {
      where.status = query.status
    }

    const [total, list] = await Promise.all([
      prisma.employeeSecondment.count({ where }),
      prisma.employeeSecondment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              user: { select: { realName: true } },
            },
          },
          fromDepartment: { select: { id: true, name: true } },
          toDepartment: { select: { id: true, name: true } },
          creator: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 获取单个借调记录详情
  fastify.get('/secondments/:id', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const secondment = await prisma.employeeSecondment.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            user: { select: { realName: true, department: { select: { name: true } } } },
          },
        },
        fromDepartment: { select: { id: true, name: true } },
        toDepartment: { select: { id: true, name: true } },
        creator: { select: { realName: true } },
      },
    })
    if (!secondment) return { code: 404, message: '借调记录不存在' }
    return { code: 0, data: secondment }
  })

  // 创建借调记录
  fastify.post('/secondments', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(secondmentCreateSchema, request.body)

    // 检查员工是否存在
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    // 检查部门是否存在
    const [fromDept, toDept] = await Promise.all([
      prisma.department.findUnique({ where: { id: body.fromDepartmentId } }),
      prisma.department.findUnique({ where: { id: body.toDepartmentId } }),
    ])
    if (!fromDept || !toDept) return { code: 404, message: '部门不存在' }

    setAudit(request, { action: 'schedule.secondment.create', module: 'schedule', requestData: body })

    const secondment = await prisma.employeeSecondment.create({
      data: {
        ...body,
        createdBy: request.user.id,
      },
    })
    setAfter(request, { id: secondment.id })

    return { code: 0, message: '借调记录创建成功', data: secondment }
  })

  // 更新借调记录
  fastify.put('/secondments/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(secondmentUpdateSchema, request.body)

    const existing = await prisma.employeeSecondment.findUnique({ where: { id } })
    if (!existing) return { code: 404, message: '借调记录不存在' }

    setAudit(request, { action: 'schedule.secondment.update', module: 'schedule', requestData: { id, ...body } })

    const secondment = await prisma.employeeSecondment.update({
      where: { id },
      data: body,
    })

    return { code: 0, message: '更新成功', data: secondment }
  })

  // 删除借调记录
  fastify.delete('/secondments/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const secondment = await prisma.employeeSecondment.findUnique({ where: { id } })
    if (!secondment) return { code: 404, message: '借调记录不存在' }

    await prisma.employeeSecondment.delete({ where: { id } })
    setAudit(request, {
      action: 'schedule.secondment.delete',
      module: 'schedule',
      beforeData: { id, employeeId: secondment.employeeId },
      requestData: { id },
    })

    return { code: 0, message: '删除成功' }
  })

  // 获取当前生效的借调记录
  fastify.get('/secondments/active', async (request) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const secondments = await prisma.employeeSecondment.findMany({
      where: {
        status: 'active',
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            user: { select: { realName: true } },
          },
        },
        fromDepartment: { select: { id: true, name: true } },
        toDepartment: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
    })

    return { code: 0, data: secondments }
  })
}
