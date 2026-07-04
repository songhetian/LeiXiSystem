import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission } from '../../middleware/permission'
import { idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

const disputeQuerySchema = z.object({
  status: z.string().trim().max(30).optional(),
  employeeId: positiveIntSchema.optional(),
  payslipId: positiveIntSchema.optional(),
})

const disputeHandleSchema = z.object({
  status: z.enum(['resolved', 'rejected']),
  handlerReply: z.string().trim().max(1000).optional().nullable(),
})

export default async function disputesRoutes(fastify: FastifyInstance) {
  fastify.get('/disputes', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Querystring: unknown
  }>) => {
    const query = validateData(disputeQuerySchema, request.query)
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)
    const where: any = { employee: employeeScope }
    if (query.status) where.status = query.status
    if (query.employeeId) where.employeeId = query.employeeId
    if (query.payslipId) where.payslipId = query.payslipId

    const list = await prisma.payslipDispute.findMany({
      where,
      include: {
        employee: { include: { user: { include: { department: true } } } },
        payslip: { include: { payrollRun: { include: { payrollPeriod: true } } } },
        handler: { select: { id: true, realName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { code: 0, data: list }
  })

  fastify.post('/disputes/:id/handle', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(disputeHandleSchema, request.body)
    const existing = await prisma.payslipDispute.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '工资条申诉不存在' })
    }
    const canAccess = await canAccessEmployee(request.user, existing.employeeId, {
      adminPermissions: ['payroll:manage'],
      allowSelf: false,
    })
    if (!canAccess) {
      return reply.status(404).send({ code: 404, message: '工资条申诉不存在' })
    }
    if (existing.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该工资条申诉已处理' })
    }

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.dispute.handle',
      requestData: { id, ...body },
    })

    captureBefore(request, existing)
    const dispute = await prisma.payslipDispute.update({
      where: { id: existing.id },
      data: {
        status: body.status,
        handlerReply: body.handlerReply,
        handlerId: request.user.id,
        handledAt: new Date(),
      },
    })

    if (body.status === 'resolved') {
      await prisma.payslip.update({
        where: { id: existing.payslipId },
        data: { status: 'viewed' },
      })
    }

    setAfter(request, { id: dispute.id })

    return { code: 0, message: '工资条申诉已处理', data: dispute }
  })
}
