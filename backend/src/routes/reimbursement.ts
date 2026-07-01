import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { getAccessibleReimbursement } from '../services/objectAuthorization'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'
import { setAudit } from '../plugins/audit'
import { enqueueNotifications } from '../plugins/notification'
import type { SendNotificationInput } from '../services/notification'

const reimbursementListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  type: z.string().trim().max(50).optional(),
  status: statusSchema,
  keyword: optionalKeywordSchema,
})

const reimbursementApplySchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(50),
  amount: z.coerce.number().positive().max(99999999),
  expenseDate: dateStringSchema,
  description: z.string().trim().max(2000).optional().nullable(),
})

const approvalOpinionSchema = z.object({
  opinion: z.string().trim().max(1000).optional(),
})

export default async function reimbursementRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      type?: string
      status?: string
      keyword?: string
    }
  }>) => {
    const query = validateData(reimbursementListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { type, status, keyword } = query

    const where: any = { userId: request.user.id }
    if (type) where.type = type
    if (status) where.status = status
    if (keyword) where.title = { contains: keyword }

    const [total, list] = await Promise.all([
      prisma.reimbursement.count({ where }),
      prisma.reimbursement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      code: 0,
      data: { list, total, page, pageSize },
    }
  })

  fastify.post('/apply', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(reimbursementApplySchema, request.body)
    const userId = request.user.id

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const reimbursement = await prisma.reimbursement.create({
      data: {
        userId,
        employeeId: employee.id,
        title: body.title,
        type: body.type,
        amount: body.amount,
        expenseDate: new Date(body.expenseDate),
        description: body.description,
        status: 'pending',
        currentStep: 0,
      },
    })

    return { code: 0, message: '申请成功', data: reimbursement }
  })

  fastify.get('/:id', { preHandler: [requireAnyPermission(['reimbursement:view', 'reimbursement:approve'])] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const reimbursement = await getAccessibleReimbursement(
      request.user,
      () => prisma.reimbursement.findUnique({
        where: { id },
        include: {
          approvalRecords: {
            orderBy: { approvedAt: 'asc' },
          },
        },
      }),
      (item) => item.id,
    )

    if (!reimbursement) {
      return { code: 404, message: '报销申请不存在' }
    }

    return { code: 0, data: reimbursement }
  })

  fastify.post('/:id/cancel', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    await prisma.reimbursement.update({
      where: { id, userId: request.user.id },
      data: { status: 'cancelled' },
    })

    return { code: 0, message: '已撤销' }
  })

  fastify.get('/approval/pending', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; type?: string }
  }>) => {
    const query = validateData(reimbursementListQuerySchema.pick({ page: true, pageSize: true, type: true }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { type } = query

    const where: any = { status: 'pending' }
    if (type) where.type = type

    const [total, list] = await Promise.all([
      prisma.reimbursement.count({ where }),
      prisma.reimbursement.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { employee: { include: { user: true } } },
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type,
          amount: item.amount,
          applicantName: item.employee.user.realName,
          departmentName: item.employee.user.departmentId,
          status: item.status,
          createdAt: item.createdAt,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.post('/approval/:id/approve', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(approvalOpinionSchema, request.body)

    await prisma.reimbursement.update({
      where: { id },
      data: { status: 'approved', currentStep: 100 },
    })

    await prisma.reimbursementApproval.create({
      data: {
        reimbursementId: id,
        approverId: request.user.id,
        action: 'approve',
        opinion,
        nodeOrder: 1,
      },
    })

    return { code: 0, message: '审批通过' }
  })

  fastify.post('/approval/:id/reject', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(approvalOpinionSchema, request.body)

    await prisma.reimbursement.update({
      where: { id },
      data: { status: 'rejected' },
    })

    await prisma.reimbursementApproval.create({
      data: {
        reimbursementId: id,
        approverId: request.user.id,
        action: 'reject',
        opinion,
        nodeOrder: 1,
      },
    })

    return { code: 0, message: '已驳回' }
  })

  // 获取报销草稿
  fastify.get('/draft', async (request: FastifyRequest) => {
    const userId = request.user.id

    const draft = await prisma.reimbursement.findFirst({
      where: {
        userId,
        draftStatus: 'draft',
        status: 'draft',
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (!draft) {
      return { code: 0, data: null }
    }

    return {
      code: 0,
      data: {
        title: draft.title,
        type: draft.type,
        amount: draft.amount,
        expenseDate: draft.expenseDate,
        description: draft.description,
      },
    }
  })

  // 保存报销草稿
  fastify.post('/draft', async (request: FastifyRequest<{ Body: {
    title?: string
    type?: string
    amount?: number
    expenseDate?: string
    description?: string
  } }>) => {
    const userId = request.user.id
    const { title, type, amount, expenseDate, description } = request.body || {}

    // 先删除旧草稿
    await prisma.reimbursement.deleteMany({
      where: {
        userId,
        draftStatus: 'draft',
        status: 'draft',
      },
    })

    // 如果没有数据，只删除旧草稿即可
    if (!title && !type && !amount && !expenseDate && !description) {
      return { code: 0, message: '草稿已清除' }
    }

    // 获取员工信息
    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    // 创建新草稿
    const draft = await prisma.reimbursement.create({
      data: {
        userId,
        employeeId: employee.id,
        title: title || '',
        type: type || '',
        amount: amount || 0,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        description: description || '',
        status: 'draft',
        draftStatus: 'draft',
        currentStep: 0,
      },
    })

    return { code: 0, message: '草稿已保存', data: draft }
  })

  fastify.post('/batch-approve', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{
    Body: { ids: number[]; opinion?: string }
  }>) => {
    const { ids, opinion } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个报销申请'),
      opinion: z.string().trim().max(1000).optional(),
    }), request.body)
    const opinionValue: string | null = (opinion as string | undefined) ?? null

    setAudit(request, {
      action: 'reimbursement.batch_approve',
      module: 'reimbursement',
      requestData: { ids, opinion: opinionValue },
    })

    const reimbursements = await prisma.reimbursement.findMany({
      where: { id: { in: ids }, status: 'pending' },
      include: { employee: { include: { user: true } } },
    })

    let successCount = 0
    const notifications: SendNotificationInput[] = []

    for (const reimbursement of reimbursements) {
      try {
        await prisma.reimbursement.update({
          where: { id: reimbursement.id },
          data: { status: 'approved', currentStep: 100 },
        })

        await prisma.reimbursementApproval.create({
          data: {
            reimbursementId: reimbursement.id,
            approverId: request.user.id,
            action: 'approve',
            opinion: opinionValue,
            nodeOrder: 1,
          },
        })

        notifications.push({
          userId: reimbursement.userId,
          title: '报销申请已通过',
          content: `您的 ${reimbursement.title} 报销申请已审批通过${opinionValue ? `：${opinionValue}` : ''}`,
          type: 'approval',
          relatedId: reimbursement.id,
          relatedType: 'reimbursement',
        })

        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    if (notifications.length > 0) {
      enqueueNotifications(request, notifications)
    }

    return { code: 0, message: `成功批准 ${successCount} 个报销申请`, data: { successCount, total: ids.length } }
  })

  fastify.post('/batch-reject', { preHandler: [requirePermission('reimbursement:approve')] }, async (request: FastifyRequest<{
    Body: { ids: number[]; opinion?: string }
  }>) => {
    const { ids, opinion } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个报销申请'),
      opinion: z.string().trim().max(1000).optional(),
    }), request.body)
    const opinionValue: string | null = (opinion as string | undefined) ?? null

    setAudit(request, {
      action: 'reimbursement.batch_reject',
      module: 'reimbursement',
      requestData: { ids, opinion: opinionValue },
    })

    const reimbursements = await prisma.reimbursement.findMany({
      where: { id: { in: ids }, status: 'pending' },
      select: { id: true, userId: true, title: true },
    })

    let successCount = 0
    const notifications: SendNotificationInput[] = []

    for (const reimbursement of reimbursements) {
      try {
        await prisma.reimbursement.update({
          where: { id: reimbursement.id },
          data: { status: 'rejected' },
        })

        await prisma.reimbursementApproval.create({
          data: {
            reimbursementId: reimbursement.id,
            approverId: request.user.id,
            action: 'reject',
            opinion: opinionValue,
            nodeOrder: 1,
          },
        })

        notifications.push({
          userId: reimbursement.userId,
          title: '报销申请已驳回',
          content: `您的 ${reimbursement.title} 报销申请已被驳回${opinionValue ? `：${opinionValue}` : ''}`,
          type: 'approval',
          relatedId: reimbursement.id,
          relatedType: 'reimbursement',
        })

        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    if (notifications.length > 0) {
      enqueueNotifications(request, notifications)
    }

    return { code: 0, message: `成功驳回 ${successCount} 个报销申请`, data: { successCount, total: ids.length } }
  })
}
