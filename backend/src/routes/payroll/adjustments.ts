import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission } from '../../middleware/permission'
import { idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

const adjustmentQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  employeeId: positiveIntSchema.optional(),
  status: z.string().trim().max(30).optional(),
})

const adjustmentCreateSchema = z.object({
  employeeId: positiveIntSchema,
  componentId: positiveIntSchema,
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  type: z.enum(['bonus', 'deduction', 'allowance', 'overtime', 'other']),
  amount: z.coerce.number().min(-99999999).max(99999999),
  reason: z.string().trim().min(1).max(500),
  status: z.enum(['pending', 'approved', 'rejected']).optional().default('pending'),
})

const adjustmentOpinionSchema = z.object({
  opinion: z.string().trim().max(1000).optional(),
})

export default async function adjustmentsRoutes(fastify: FastifyInstance) {
  fastify.get('/adjustments', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Querystring: unknown
  }>) => {
    const query = validateData(adjustmentQuerySchema, request.query)
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)
    const where: any = { employee: employeeScope }
    if (query.year) where.year = query.year
    if (query.month) where.month = query.month
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.status) where.status = query.status

    const list = await prisma.payrollAdjustment.findMany({
      where,
      include: {
        employee: { include: { user: { include: { department: true } } } },
        component: true,
        creator: { select: { id: true, realName: true } },
        approver: { select: { id: true, realName: true } },
      },
      orderBy: { id: 'desc' },
    })

    return { code: 0, data: list }
  })

  fastify.post('/adjustments', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>, reply) => {
    const body = validateData(adjustmentCreateSchema, request.body)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.adjustment.create',
      requestData: body,
    })
    const canAccess = await canAccessEmployee(request.user, body.employeeId, {
      adminPermissions: ['payroll:manage'],
      allowSelf: false,
    })
    if (!canAccess) {
      return reply.status(404).send({ code: 404, message: '员工不存在' })
    }

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        employeeId: body.employeeId,
        componentId: body.componentId,
        year: body.year,
        month: body.month,
        type: body.type,
        amount: body.amount,
        reason: body.reason,
        status: body.status,
        createdBy: request.user.id,
        approvedBy: body.status === 'approved' ? request.user.id : undefined,
        approvedAt: body.status === 'approved' ? new Date() : undefined,
      },
    })

    setAfter(request, { id: adjustment.id })

    return { code: 0, message: '薪资调整项创建成功', data: adjustment }
  })

  fastify.post('/adjustments/:id/approve', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(adjustmentOpinionSchema, request.body || {})
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.adjustment.approve',
      requestData: { id, opinion },
    })
    const existing = await prisma.payrollAdjustment.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资调整项不存在' })
    }
    const canAccess = await canAccessEmployee(request.user, existing.employeeId, {
      adminPermissions: ['payroll:manage'],
      allowSelf: false,
    })
    if (!canAccess) {
      return reply.status(404).send({ code: 404, message: '薪资调整项不存在' })
    }
    if (existing.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该薪资调整项已处理' })
    }

    captureBefore(request, existing)
    const adjustment = await prisma.payrollAdjustment.update({
      where: { id: existing.id },
      data: { status: 'approved', approvedBy: request.user.id, approvedAt: new Date(), approvalOpinion: opinion },
    })

    setAfter(request, { id: adjustment.id })

    return { code: 0, message: '薪资调整项已审批通过', data: adjustment }
  })

  fastify.post('/adjustments/:id/reject', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(adjustmentOpinionSchema, request.body || {})
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.adjustment.reject',
      requestData: { id, opinion },
    })
    const existing = await prisma.payrollAdjustment.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资调整项不存在' })
    }
    const canAccess = await canAccessEmployee(request.user, existing.employeeId, {
      adminPermissions: ['payroll:manage'],
      allowSelf: false,
    })
    if (!canAccess) {
      return reply.status(404).send({ code: 404, message: '薪资调整项不存在' })
    }
    if (existing.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该薪资调整项已处理' })
    }

    captureBefore(request, existing)
    const adjustment = await prisma.payrollAdjustment.update({
      where: { id: existing.id },
      data: { status: 'rejected', approvedBy: request.user.id, approvedAt: new Date(), approvalOpinion: opinion },
    })

    setAfter(request, { id: adjustment.id })

    return { code: 0, message: '薪资调整项已驳回', data: adjustment }
  })
}
