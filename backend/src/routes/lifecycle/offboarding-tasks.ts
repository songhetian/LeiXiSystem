import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { taskListQuerySchema } from '../../utils/schemas'
import { dateStringSchema, idParamsSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safeOmit } from '../../utils/validation'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { handleOffboardingCompletion } from './helpers'

const taskSchema = z.object({
  employeeId: positiveIntSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: dateStringSchema.optional().nullable(),
  assignedTo: positiveIntSchema.optional().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).optional().default('pending'),
})

const taskUpdateSchema = partialUpdateSchema(safeOmit(taskSchema, ['employeeId']))

export default async function offboardingTasksRoutes(fastify: FastifyInstance) {
  fastify.get('/offboarding-tasks', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) {
      const access = await canAccessEmployee(request.user, query.employeeId, { allowSelf: true })
      if (!access) return { code: 403, message: '无权查看该员工的离职任务' }
      where.employeeId = query.employeeId
    }
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.offboardingTask.count({ where }),
      prisma.offboardingTask.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          employeeId: true,
          title: true,
          description: true,
          dueDate: true,
          status: true,
          assignedTo: true,
          createdAt: true,
          updatedAt: true,
          employee: { select: { employeeNo: true, user: { select: { realName: true } } } },
          assignee: { select: { realName: true } },
          creator: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.get('/offboarding-tasks/:id', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const task = await prisma.offboardingTask.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, employeeNo: true, user: { select: { realName: true } } } },
        assignee: { select: { realName: true } },
        creator: { select: { realName: true } },
      },
    })
    if (!task) return { code: 404, message: '任务不存在' }

    const access = await canAccessEmployee(request.user, task.employeeId, { allowSelf: true })
    if (!access) return { code: 403, message: '无权查看该任务' }

    return { code: 0, data: task }
  })

  fastify.post('/offboarding-tasks', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(taskSchema, request.body)
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    setAudit(request, {
      action: 'lifecycle.offboarding.create',
      module: 'lifecycle',
      requestData: body,
    })

    const task = await prisma.offboardingTask.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedTo: body.assignedTo ?? undefined,
        createdBy: request.user.id,
      },
    })

    setAfter(request, { id: task.id })

    return { code: 0, message: '创建成功', data: task }
  })

  fastify.put('/offboarding-tasks/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(taskUpdateSchema, request.body)
    requireAtLeastOneField(data)

    setAudit(request, {
      action: 'lifecycle.offboarding.update',
      module: 'lifecycle',
      requestData: data,
    })

    const before = await prisma.offboardingTask.findUnique({ where: { id } })
    if (!before) return { code: 404, message: '任务不存在' }

    captureBefore(request, { id: before.id, status: before.status })

    const task = await prisma.offboardingTask.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        assignedTo: data.assignedTo ?? undefined,
        completedAt: data.status === 'completed' ? new Date() : undefined,
      },
    })

    if (data.status === 'completed' && before.status !== 'completed') {
      await handleOffboardingCompletion(request, before.employeeId)
    }

    setAfter(request, { id: task.id, status: task.status })

    return { code: 0, message: '更新成功', data: task }
  })

  fastify.delete('/offboarding-tasks/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const task = await prisma.offboardingTask.findUnique({ where: { id } })
    if (!task) return { code: 404, message: '任务不存在' }
    if (task.status === 'completed') {
      return { code: 400, message: '已完成的任务无法删除' }
    }

    setAudit(request, {
      action: 'lifecycle.offboarding.delete',
      module: 'lifecycle',
      requestData: { id },
      beforeData: task,
    })

    await prisma.offboardingTask.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })
}
