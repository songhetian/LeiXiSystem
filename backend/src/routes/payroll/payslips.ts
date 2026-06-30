import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { recalculatePayslip, withdrawPayslip } from '../../services/payrollCalculation'
import { idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

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

const payslipQuerySchema = z.object({
  payrollRunId: positiveIntSchema.optional(),
  employeeId: positiveIntSchema.optional(),
})

export default async function payslipsRoutes(fastify: FastifyInstance) {
  fastify.get('/payslips', { preHandler: [requireAnyPermission(['payroll:manage', 'payroll:payslip:view-all'])] }, async (request: FastifyRequest<{
    Querystring: unknown
  }>) => {
    const query = validateData(payslipQuerySchema, request.query)
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)
    const where: any = { employee: employeeScope }
    if (query.payrollRunId) where.payrollRunId = query.payrollRunId
    if (query.employeeId) where.employeeId = query.employeeId

    const list = await prisma.payslip.findMany({
      where,
      select: {
        id: true,
        payrollRunId: true,
        employeeId: true,
        userId: true,
        grossPay: true,
        totalDeduction: true,
        netPay: true,
        expectedWorkDays: true,
        paidDays: true,
        absentDays: true,
        unpaidLeaveDays: true,
        overtimeAmount: true,
        status: true,
        publishedAt: true,
        viewedAt: true,
        confirmedAt: true,
        createdAt: true,
        updatedAt: true,
        employee: {
          select: {
            id: true,
            employeeNo: true,
            user: {
              select: {
                id: true,
                realName: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
        payrollRun: {
          select: {
            id: true,
            payrollPeriod: { select: { id: true, year: true, month: true } },
          },
        },
        disputes: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { id: 'desc' },
    })

    return { code: 0, data: list }
  })

  fastify.post('/payslips/:id/recalculate', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.payslip.findUnique({
      where: { id },
      select: { employeeId: true },
    })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }
    const canAccess = await canAccessEmployee(request.user, existing.employeeId, {
      adminPermissions: ['payroll:manage', 'payroll:payslip:view-all'],
      allowSelf: false,
    })
    if (!canAccess) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    const beforePayslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.recalculate',
      requestData: { id },
      beforeData: beforePayslip ? {
        id: beforePayslip.id,
        grossPay: beforePayslip.grossPay,
        totalDeduction: beforePayslip.totalDeduction,
        netPay: beforePayslip.netPay,
        paidDays: beforePayslip.paidDays,
        status: beforePayslip.status,
      } : undefined,
    })

    const payslip = await recalculatePayslip(id)

    setAfter(request, {
      id: payslip.id,
      grossPay: payslip.grossPay,
      totalDeduction: payslip.totalDeduction,
      netPay: payslip.netPay,
      paidDays: payslip.paidDays,
      status: payslip.status,
    })

    return { code: 0, message: '工资条重算完成', data: payslip }
  })

  fastify.post('/payslips/:id/withdraw', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const existing = await prisma.payslip.findUnique({
      where: { id },
      select: { employeeId: true },
    })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }
    const canAccess = await canAccessEmployee(request.user, existing.employeeId, {
      adminPermissions: ['payroll:manage', 'payroll:payslip:view-all'],
      allowSelf: false,
    })
    if (!canAccess) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    const beforePayslip = await prisma.payslip.findUnique({
      where: { id },
      select: { id: true, status: true, publishedAt: true, confirmedAt: true },
    })

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.withdraw',
      requestData: { id },
      beforeData: beforePayslip || undefined,
    })

    const payslip = await withdrawPayslip(id)

    setAfter(request, { id: payslip.id, status: payslip.status })

    return { code: 0, message: '工资条已撤回', data: payslip }
  })

  // 员工确认工资单
  fastify.post('/payslips/:id/confirm', { preHandler: [requireAnyPermission(['payroll:manage', 'payroll:payslip:view-all', 'payroll:payslip:view'])] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      select: { employeeId: true, userId: true, status: true, confirmedAt: true },
    })
    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }
    if (payslip.confirmedAt) {
      return { code: 400, message: '工资条已确认，无需重复确认' }
    }

    const updated = await prisma.payslip.update({
      where: { id },
      data: { confirmedAt: new Date() },
    })

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.confirm',
      requestData: { id },
      beforeData: { confirmedAt: payslip.confirmedAt },
    })

    return { code: 0, message: '工资条已确认', data: { id: updated.id, confirmedAt: updated.confirmedAt } }
  })

  // 员工对工资单有异议
  fastify.post('/payslips/:id/dispute', { preHandler: [requireAnyPermission(['payroll:manage', 'payroll:payslip:view-all', 'payroll:payslip:view'])] }, async (request: FastifyRequest<{
    Params: unknown
    Body: { reason: string }
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { reason } = validateData(z.object({
      reason: z.string().trim().min(1).max(1000),
    }), request.body)

    const payslip = await prisma.payslip.findUnique({
      where: { id },
      select: { employeeId: true, userId: true, status: true },
    })
    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    const dispute = await prisma.payslipDispute.create({
      data: {
        payslipId: id,
        employeeId: payslip.employeeId,
        userId: request.user.id,
        reason,
        status: 'open',
      },
    })

    setAudit(request, {
      module: 'payroll',
      action: 'payslip.dispute',
      requestData: { id, reason },
    })

    return { code: 0, message: '异议已提交', data: dispute }
  })

  // 导出工资单
  fastify.post('/payslips/export', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: {
      payrollRunId?: number
      departmentId?: number
      fields?: string[]
    }
  }>) => {
    const body = request.body as any
    const { payrollRunId, departmentId, fields = [] } = body || {}

    const where: any = {}
    if (payrollRunId) where.payrollRunId = payrollRunId
    if (departmentId) where.employee = { departmentId }

    const payslips = await prisma.payslip.findMany({
      where,
      select: {
        id: true,
        grossPay: true,
        totalDeduction: true,
        netPay: true,
        paidDays: true,
        absentDays: true,
        status: true,
        publishedAt: true,
        confirmedAt: true,
        payrollRun: {
          select: {
            payrollPeriod: { select: { year: true, month: true } },
          },
        },
        employee: {
          select: {
            employeeNo: true,
            department: { select: { name: true } },
            user: { select: { realName: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    })

    const rows = payslips.map((p: any) => ({
      period: `${p.payrollRun?.payrollPeriod?.year || '-'}-${String(p.payrollRun?.payrollPeriod?.month || '-').padStart(2, '0')}`,
      employeeNo: p.employee?.employeeNo || '-',
      employeeName: p.employee?.user?.realName || '-',
      department: p.employee?.department?.name || '-',
      grossPay: Number(p.grossPay),
      totalDeduction: Number(p.totalDeduction),
      netPay: Number(p.netPay),
      paidDays: p.paidDays,
      absentDays: p.absentDays,
      status: p.status === 'published' ? '已发布' : p.status === 'confirmed' ? '已确认' : p.status,
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString().split('T')[0] : '-',
      confirmedAt: p.confirmedAt ? new Date(p.confirmedAt).toISOString().split('T')[0] : '-',
    }))

    return {
      code: 0,
      message: `共 ${rows.length} 条数据`,
      data: {
        filename: `工资单_${new Date().toISOString().split('T')[0]}.xlsx`,
        fields: fields.length > 0 ? fields : ['period', 'employeeNo', 'employeeName', 'department', 'grossPay', 'totalDeduction', 'netPay', 'paidDays', 'absentDays', 'status', 'publishedAt', 'confirmedAt'],
        rows,
      },
    }
  })
}
