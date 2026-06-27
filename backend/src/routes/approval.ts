import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { validateData } from '../utils/validation'

const approvalListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  type: z.enum(['leave', 'overtime', 'reimbursement']).optional(),
})

const approvalFlowBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(50),
  description: z.string().trim().max(1000).optional().nullable(),
  isDefault: z.coerce.boolean().optional().default(false),
  status: z.string().trim().max(30).regex(/^[a-zA-Z0-9_-]+$/).optional().default('active'),
})

export default async function approvalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/pending', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      type?: string
    }
  }>) => {
    const query = validateData(approvalListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { type } = query

    const items: any[] = []
    let total = 0

    if (!type || type === 'leave') {
      const [leaveTotal, leaveList] = await Promise.all([
        prisma.leaveRequest.count({ where: { status: 'pending' } }),
        prisma.leaveRequest.findMany({
          where: { status: 'pending' },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { employee: { include: { user: true } } },
        }),
      ])
      total += leaveTotal
      items.push(...leaveList.map((item) => ({
        id: item.id,
        type: 'leave',
        typeName: '请假申请',
        title: `${item.leaveType}请假`,
        applicant: item.employee.user.realName,
        amount: `${item.days}天`,
        status: item.status,
        createdAt: item.createdAt,
      })))
    }

    if (!type || type === 'overtime') {
      const [otTotal, otList] = await Promise.all([
        prisma.overtimeRequest.count({ where: { status: 'pending' } }),
        prisma.overtimeRequest.findMany({
          where: { status: 'pending' },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { employee: { include: { user: true } } },
        }),
      ])
      total += otTotal
      items.push(...otList.map((item) => ({
        id: item.id,
        type: 'overtime',
        typeName: '加班申请',
        title: `${item.overtimeType}加班`,
        applicant: item.employee.user.realName,
        amount: `${item.hours}小时`,
        status: item.status,
        createdAt: item.createdAt,
      })))
    }

    if (!type || type === 'reimbursement') {
      const [reimbTotal, reimbList] = await Promise.all([
        prisma.reimbursement.count({ where: { status: 'pending' } }),
        prisma.reimbursement.findMany({
          where: { status: 'pending' },
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { employee: { include: { user: true } } },
        }),
      ])
      total += reimbTotal
      items.push(...reimbList.map((item) => ({
        id: item.id,
        type: 'reimbursement',
        typeName: '报销申请',
        title: item.title,
        applicant: item.employee.user.realName,
        amount: `¥${item.amount}`,
        status: item.status,
        createdAt: item.createdAt,
      })))
    }

    return {
      code: 0,
      data: {
        list: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/history', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number }
  }>) => {
    const { page, pageSize } = normalizePagination(request.query)

    const [leaveApproved, overtimeApproved, reimbApproved] = await Promise.all([
      prisma.leaveRequest.count({
        where: { status: { in: ['approved', 'rejected', 'cancelled'] } },
      }),
      prisma.overtimeRequest.count({
        where: { status: { in: ['approved', 'rejected', 'cancelled'] } },
      }),
      prisma.reimbursement.count({
        where: { status: { in: ['approved', 'rejected', 'cancelled', 'paid'] } },
      }),
    ])

    const total = leaveApproved + overtimeApproved + reimbApproved

    return { code: 0, data: { list: [], total, page, pageSize } }
  })

  fastify.get('/flows', { preHandler: [requirePermission('approval:view')] }, async () => {
    const flows = await prisma.approvalWorkflow.findMany({
      include: { nodes: { orderBy: { nodeOrder: 'asc' } } },
    })

    return { code: 0, data: flows }
  })

  fastify.post('/flows', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(approvalFlowBodySchema, request.body)

    const flow = await prisma.approvalWorkflow.create({
      data: {
        name: body.name,
        type: body.type,
        description: body.description,
        isDefault: body.isDefault || false,
        status: body.status || 'active',
      },
    })

    return { code: 0, message: '创建成功', data: flow }
  })
}
