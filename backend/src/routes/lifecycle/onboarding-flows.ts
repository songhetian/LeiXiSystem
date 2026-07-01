import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../../utils/validation'

const flowListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: statusSchema,
  keyword: optionalKeywordSchema,
  departmentId: positiveIntSchema.optional(),
})

const createFlowSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  positionId: positiveIntSchema.optional().nullable(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  isDefault: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  steps: z.array(z.object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000).optional().nullable(),
    stepOrder: z.number().int().min(0),
    type: z.enum(['document', 'task', 'meeting', 'training', 'system']),
    assigneeRole: z.string().trim().max(50).optional().nullable(),
    departmentId: positiveIntSchema.optional().nullable(),
    dueDays: z.number().int().min(1).max(365).optional().default(1),
    required: z.boolean().optional().default(true),
  })).optional().default([]),
})

const updateFlowSchema = partialUpdateSchema(createFlowSchema)

const createStepSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional().nullable(),
  stepOrder: z.number().int().min(0),
  type: z.enum(['document', 'task', 'meeting', 'training', 'system']),
  assigneeRole: z.string().trim().max(50).optional().nullable(),
  departmentId: positiveIntSchema.optional().nullable(),
  dueDays: z.number().int().min(1).max(365).optional().default(1),
  required: z.boolean().optional().default(true),
})

const updateStepSchema = partialUpdateSchema(createStepSchema)

const startOnboardingSchema = z.object({
  employeeId: positiveIntSchema,
  flowId: positiveIntSchema.optional(),
  startDate: dateStringSchema.optional(),
})

export default async function onboardingFlowRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取流程模板列表
  fastify.get('/flows', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(flowListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}

    if (query.status) where.status = query.status
    if (query.keyword) where.name = { contains: query.keyword }
    if (query.departmentId) where.departmentId = query.departmentId

    const [total, list] = await Promise.all([
      prisma.onboardingFlow.count({ where }),
      prisma.onboardingFlow.findMany({
        where,
        skip,
        take,
        orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
        include: {
          steps: {
            orderBy: { stepOrder: 'asc' },
          },
          department: true,
          position: true,
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 获取流程模板详情
  fastify.get('/flows/:id', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const flow = await prisma.onboardingFlow.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
        },
        department: true,
        position: true,
        creator: { select: { id: true, realName: true } },
      },
    })

    if (!flow) return { code: 404, message: '流程模板不存在' }

    return { code: 0, data: flow }
  })

  // 创建流程模板
  fastify.post('/flows', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(createFlowSchema, request.body)
    const { steps, ...flowData } = body

    // 如果设置为默认，先取消其他默认
    if (flowData.isDefault) {
      await prisma.onboardingFlow.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const flow = await prisma.onboardingFlow.create({
      data: {
        ...flowData,
        createdBy: request.user.id,
        steps: steps.length
          ? { create: steps }
          : undefined,
      },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })

    return { code: 0, message: '创建成功', data: flow }
  })

  // 更新流程模板
  fastify.put('/flows/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(updateFlowSchema, request.body)
    requireAtLeastOneField(data)
    const { steps, ...flowData } = data

    const flow = await prisma.onboardingFlow.findUnique({ where: { id } })
    if (!flow) return { code: 404, message: '流程模板不存在' }

    // 如果设置为默认，先取消其他默认
    if (flowData.isDefault) {
      await prisma.onboardingFlow.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const updatedFlow = await prisma.onboardingFlow.update({
      where: { id },
      data: flowData,
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })

    return { code: 0, message: '更新成功', data: updatedFlow }
  })

  // 删除流程模板
  fastify.delete('/flows/:id', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const flow = await prisma.onboardingFlow.findUnique({ where: { id } })
    if (!flow) return { code: 404, message: '流程模板不存在' }

    await prisma.onboardingFlow.delete({ where: { id } })

    return { code: 0, message: '删除成功' }
  })

  // 获取流程步骤列表
  fastify.get('/flows/:id/steps', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const steps = await prisma.onboardingFlowStep.findMany({
      where: { flowId: id },
      orderBy: { stepOrder: 'asc' },
    })

    return { code: 0, data: steps }
  })

  // 添加流程步骤
  fastify.post('/flows/:id/steps', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(createStepSchema, request.body)

    const flow = await prisma.onboardingFlow.findUnique({ where: { id } })
    if (!flow) return { code: 404, message: '流程模板不存在' }

    const step = await prisma.onboardingFlowStep.create({
      data: {
        ...body,
        flowId: id,
      },
    })

    return { code: 0, message: '添加成功', data: step }
  })

  // 更新流程步骤
  fastify.put('/steps/:stepId', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { stepId } = validateData(z.object({ stepId: positiveIntSchema }), request.params)
    const data = validateData(updateStepSchema, request.body)
    requireAtLeastOneField(data)

    const step = await prisma.onboardingFlowStep.findUnique({ where: { id: stepId } })
    if (!step) return { code: 404, message: '步骤不存在' }

    const updatedStep = await prisma.onboardingFlowStep.update({
      where: { id: stepId },
      data: data,
    })

    return { code: 0, message: '更新成功', data: updatedStep }
  })

  // 删除流程步骤
  fastify.delete('/steps/:stepId', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { stepId } = validateData(z.object({ stepId: positiveIntSchema }), request.params)

    const step = await prisma.onboardingFlowStep.findUnique({ where: { id: stepId } })
    if (!step) return { code: 404, message: '步骤不存在' }

    await prisma.onboardingFlowStep.delete({ where: { id: stepId } })

    return { code: 0, message: '删除成功' }
  })

  // 启动员工入职流程
  fastify.post('/start', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(startOnboardingSchema, request.body)

    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId } })
    if (!employee) return { code: 404, message: '员工不存在' }

    // 检查是否已有进行中的入职流程
    const existing = await prisma.employeeOnboarding.findUnique({
      where: { employeeId: body.employeeId },
    })

    if (existing && existing.status === 'in_progress') {
      return { code: 400, message: '该员工已有进行中的入职流程' }
    }

    // 确定使用的流程
    let flowId = body.flowId
    if (!flowId) {
      const defaultFlow = await prisma.onboardingFlow.findFirst({
        where: { isDefault: true, status: 'active' },
      })
      if (!defaultFlow) {
        return { code: 400, message: '未找到默认入职流程，请先配置' }
      }
      flowId = defaultFlow.id
    }

    const flow = await prisma.onboardingFlow.findUnique({
      where: { id: flowId },
      include: { steps: { orderBy: { stepOrder: 'asc' } } },
    })

    if (!flow) return { code: 404, message: '入职流程不存在' }

    const startDate = body.startDate ? new Date(body.startDate) : new Date()

    // 创员工入职记录
    const onboarding = await prisma.employeeOnboarding.create({
      data: {
        employeeId: body.employeeId,
        flowId,
        startDate,
        totalSteps: flow.steps.length,
        currentStep: 0,
        status: 'in_progress',
      },
    })

    // 根据流程步骤生成入职任务
    const tasks = flow.steps.map((step) => {
      const dueDate = new Date(startDate)
      dueDate.setDate(dueDate.getDate() + step.dueDays)

      return {
        employeeId: body.employeeId,
        title: step.title,
        description: step.description,
        dueDate,
        status: 'pending' as const,
        createdBy: request.user.id,
      }
    })

    if (tasks.length > 0) {
      await prisma.onboardingTask.createMany({ data: tasks })
    }

    return { code: 0, message: '入职流程已启动', data: onboarding }
  })

  // 获取员工入职进度
  fastify.get('/progress/:employeeId', { preHandler: [requireAnyPermission(['lifecycle:view', 'lifecycle:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { employeeId } = validateData(z.object({ employeeId: positiveIntSchema }), request.params)

    const onboarding = await prisma.employeeOnboarding.findUnique({
      where: { employeeId },
      include: {
        flow: {
          include: { steps: { orderBy: { stepOrder: 'asc' } } },
        },
      },
    })

    if (!onboarding) return { code: 0, data: null }

    const tasks = await prisma.onboardingTask.findMany({
      where: { employeeId, createdAt: { gte: onboarding.startDate } },
      orderBy: { createdAt: 'asc' },
    })

    const completedTasks = tasks.filter((t) => t.status === 'completed').length
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

    return {
      code: 0,
      data: {
        ...onboarding,
        tasks,
        completedTasks,
        totalTasks: tasks.length,
        progress,
      },
    }
  })

  // 完成入职流程
  fastify.post('/complete/:employeeId', { preHandler: [requirePermission('lifecycle:manage')] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { employeeId } = validateData(z.object({ employeeId: positiveIntSchema }), request.params)

    const onboarding = await prisma.employeeOnboarding.findUnique({
      where: { employeeId },
    })

    if (!onboarding) return { code: 404, message: '入职记录不存在' }
    if (onboarding.status === 'completed') return { code: 400, message: '入职流程已完成' }

    // 检查是否所有必要任务都已完成
    const pendingTasks = await prisma.onboardingTask.count({
      where: {
        employeeId,
        status: { in: ['pending', 'processing'] },
        createdAt: { gte: onboarding.startDate },
      },
    })

    if (pendingTasks > 0) {
      return { code: 400, message: `还有 ${pendingTasks} 个未完成的任务` }
    }

    const completed = await prisma.employeeOnboarding.update({
      where: { employeeId },
      data: {
        status: 'completed',
        completedDate: new Date(),
      },
    })

    return { code: 0, message: '入职流程已完成', data: completed }
  })
}
