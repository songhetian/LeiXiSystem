import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requireAnyPermission } from '../../middleware/permission'
import { idParamsSchema, validateData } from '../../utils/validation'

const payslipDisputeSchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

async function verifyPayslipAccessToken(fastify: FastifyInstance, request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers['x-payslip-access-token']
  if (!token || Array.isArray(token)) {
    return reply.status(401).send({ code: 401, message: '请先完成工资条二级密码验证' })
  }

  try {
    const payload = fastify.jwt.verify<{ userId: number; scope: string }>(token)
    if (payload.userId !== request.user.id || payload.scope !== 'payslip:view') {
      return reply.status(403).send({ code: 403, message: '工资条查看令牌无效' })
    }
  } catch {
    return reply.status(401).send({ code: 401, message: '工资条查看令牌已过期，请重新验证' })
  }
}

export default async function myPayslipsRoutes(fastify: FastifyInstance) {
  fastify.get('/my-payslips', { preHandler: [requireAnyPermission(['payslip:view', 'payroll:payslip:view-self'])] }, async (request) => {
    const list = await prisma.payslip.findMany({
      where: { userId: request.user.id, status: { in: ['published', 'viewed', 'confirmed', 'disputed'] } },
      include: { payrollRun: { include: { payrollPeriod: true } } },
      orderBy: { id: 'desc' },
    })

    return {
      code: 0,
      data: list.map((item) => ({
        id: item.id,
        status: item.status,
        year: item.payrollRun.payrollPeriod.year,
        month: item.payrollRun.payrollPeriod.month,
        publishedAt: item.publishedAt,
        viewedAt: item.viewedAt,
        confirmedAt: item.confirmedAt,
        netPayMasked: '****',
      })),
    }
  })

  fastify.get('/my-payslips/:id', { preHandler: [requireAnyPermission(['payslip:view', 'payroll:payslip:view-self'])] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const verification = await verifyPayslipAccessToken(fastify, request, reply)
    if (verification) return verification

    const { id } = validateData(idParamsSchema, request.params)
    const payslip = await prisma.payslip.findFirst({
      where: { id, userId: request.user.id },
      include: {
        items: { include: { component: true }, orderBy: { sortOrder: 'asc' } },
        payrollRun: { include: { payrollPeriod: true } },
        disputes: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.view',
      requestData: { payslipId: payslip.id },
    })

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: payslip.viewedAt ? {} : { viewedAt: new Date(), status: payslip.status === 'published' ? 'viewed' : payslip.status },
    })

    setAfter(request, { payslipId: payslip.id })

    return { code: 0, data: payslip }
  })

  fastify.post('/my-payslips/:id/confirm', { preHandler: [requireAnyPermission(['payslip:view', 'payroll:payslip:view-self'])] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const payslip = await prisma.payslip.findFirst({
      where: { id, userId: request.user.id },
    })

    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    if (!['published', 'viewed'].includes(payslip.status)) {
      return reply.status(400).send({ code: 400, message: '当前工资条状态不允许确认' })
    }

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.confirm',
      requestData: { payslipId: payslip.id },
    })

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })

    setAfter(request, { payslipId: payslip.id })

    return { code: 0, message: '工资条已确认' }
  })

  fastify.post('/my-payslips/:id/dispute', { preHandler: [requireAnyPermission(['payslip:view', 'payroll:payslip:view-self'])] }, async (request: FastifyRequest<{
    Params: unknown
    Body: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(payslipDisputeSchema, request.body)
    const payslip = await prisma.payslip.findFirst({
      where: { id, userId: request.user.id },
    })

    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    if (!['published', 'viewed', 'confirmed'].includes(payslip.status)) {
      return reply.status(400).send({ code: 400, message: '当前工资条状态不允许申诉' })
    }

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.dispute',
      requestData: { payslipId: payslip.id, reason: body.reason },
    })

    const dispute = await prisma.payslipDispute.create({
      data: {
        payslipId: payslip.id,
        employeeId: payslip.employeeId,
        userId: request.user.id,
        reason: body.reason,
      },
    })

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: { status: 'disputed' },
    })

    setAfter(request, { id: dispute.id })

    return { code: 0, message: '工资条申诉已提交', data: dispute }
  })
}
