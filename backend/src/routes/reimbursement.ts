import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, statusSchema, validateData } from '../utils/validation'

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

  fastify.get('/list', { preHandler: [requirePermission('reimbursement:view')] }, async (request: FastifyRequest<{
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

    const reimbursement = await prisma.reimbursement.findUnique({
      where: { id },
      include: {
        approvalRecords: {
          orderBy: { approvedAt: 'asc' },
        },
      },
    })

    if (!reimbursement) {
      return { code: 404, message: '报销申请不存在' }
    }

    const canApprove = hasPermission(request, 'reimbursement:approve')
    if (!canApprove && reimbursement.userId !== request.user.id) {
      return { code: 403, message: '没有权限查看该报销申请' }
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
}
