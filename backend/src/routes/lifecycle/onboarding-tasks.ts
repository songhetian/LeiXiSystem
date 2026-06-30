import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { taskListQuerySchema } from '../../utils/schemas'
import { dateStringSchema, idParamsSchema, positiveIntSchema, statusSchema, validateData } from '../../utils/validation'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { handleOnboardingCompletion } from './helpers'

const taskSchema = z.object({
  employeeId: positiveIntSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  dueDate: dateStringSchema.optional().nullable(),
  assignedTo: positiveIntSchema.optional().nullable(),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).optional().default('pending'),
})

const taskUpdateSchema = taskSchema.omit({ employeeId: true }).partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

export default async function onboardingTasksRoutes(fastify: FastifyInstance) {
  fastify.get('/onboarding-tasks', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(taskListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) {
      const access = await canAccessEmployee(request.user, query.employeeId, { allowSelf: true })
      if (!access) return { code: 403, message: '无权查看该员工的入职任务' }
      where.employeeId = query.employeeId
    }
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.onboardingTask.count({ where }),
      prisma.onboardingTask.findMany({
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

  fastify.get('/onboarding-tasks/:id', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const task = await prisma.onboardingTask.findUnique({
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

  fastify.post('/onboarding-tasks', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(taskSchema, request.body)
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    setAudit(request, {
      action: 'lifecycle.onboarding.create',
      module: 'lifecycle',
      requestData: body,
    })

    const task = await prisma.onboardingTask.create({
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

  fastify.put('/onboarding-tasks/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(taskUpdateSchema, request.body)

    setAudit(request, {
      action: 'lifecycle.onboarding.update',
      module: 'lifecycle',
      requestData: body,
    })

    const before = await prisma.onboardingTask.findUnique({ where: { id } })
    if (!before) return { code: 404, message: '任务不存在' }

    captureBefore(request, { id: before.id, status: before.status })

    const task = await prisma.onboardingTask.update({
      where: { id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedTo: body.assignedTo ?? undefined,
        completedAt: body.status === 'completed' ? new Date() : undefined,
      },
    })

    if (body.status === 'completed' && before.status !== 'completed') {
      await handleOnboardingCompletion(request, before.employeeId)
    }

    setAfter(request, { id: task.id, status: task.status })

    return { code: 0, message: '更新成功', data: task }
  })

  fastify.delete('/onboarding-tasks/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const task = await prisma.onboardingTask.findUnique({ where: { id } })
    if (!task) return { code: 404, message: '任务不存在' }
    if (task.status === 'completed') {
      return { code: 400, message: '已完成的任务无法删除' }
    }

    setAudit(request, {
      action: 'lifecycle.onboarding.delete',
      module: 'lifecycle',
      requestData: { id },
      beforeData: task,
    })

    await prisma.onboardingTask.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })
}
