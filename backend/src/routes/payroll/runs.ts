import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { canAccessEmployee } from '../../services/objectAuthorization'
import { requirePermission } from '../../middleware/permission'
import { calculatePayrollRun, publishPayrollRun } from '../../services/payrollCalculation'
import { dateStringSchema, idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

const runCreateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  scopeType: z.enum(['all', 'department', 'employee']).optional().default('all'),
  scopeValue: positiveIntSchema.optional(),
})

export default async function runsRoutes(fastify: FastifyInstance) {
  fastify.get('/runs', { preHandler: [requirePermission('payroll:manage')] }, async () => {
    const list = await prisma.payrollRun.findMany({
      include: { payrollPeriod: true, creator: { select: { id: true, realName: true } }, payslips: true },
      orderBy: { id: 'desc' },
    })
    return { code: 0, data: list }
  })

  fastify.get('/runs/:id/detail', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        payrollPeriod: true,
        creator: { select: { id: true, realName: true } },
        approver: { select: { id: true, realName: true } },
      },
    })

    if (!run) {
      return reply.status(404).send({ code: 404, message: '薪资批次不存在' })
    }

    const [payslips, adjustments, disputes] = await Promise.all([
      prisma.payslip.findMany({
        where: { payrollRunId: id, employee: employeeScope },
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
      }),
      prisma.payrollAdjustment.findMany({
        where: {
          year: run.payrollPeriod.year,
          month: run.payrollPeriod.month,
          employee: employeeScope,
        },
        include: {
          employee: { include: { user: { include: { department: true } } } },
          component: true,
        },
        orderBy: { id: 'desc' },
      }),
      prisma.payslipDispute.findMany({
        where: {
          payslip: { payrollRunId: id },
          employee: employeeScope,
        },
        include: {
          employee: { include: { user: { include: { department: true } } } },
          payslip: true,
          handler: { select: { id: true, realName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const totals = payslips.reduce((acc, item) => {
      acc.grossPay += Number(item.grossPay || 0)
      acc.totalDeduction += Number(item.totalDeduction || 0)
      acc.netPay += Number(item.netPay || 0)
      return acc
    }, { grossPay: 0, totalDeduction: 0, netPay: 0 })

    return {
      code: 0,
      data: {
        run,
        payslips,
        adjustments,
        disputes,
        summary: {
          payslipCount: payslips.length,
          adjustmentCount: adjustments.length,
          disputeCount: disputes.length,
          ...totals,
        },
      },
    }
  })

  fastify.post('/runs', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(runCreateSchema, request.body)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.run.create',
      requestData: body,
    })
    const period = await prisma.payrollPeriod.upsert({
      where: { year_month: { year: body.year, month: body.month } },
      update: {
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      },
      create: {
        year: body.year,
        month: body.month,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      },
    })

    const run = await prisma.payrollRun.create({
      data: {
        payrollPeriodId: period.id,
        scopeType: body.scopeType,
        scopeValue: body.scopeValue as any,
        createdBy: request.user.id,
      },
      include: { payrollPeriod: true },
    })

    setAfter(request, { id: run.id })

    return { code: 0, message: '薪资批次创建成功', data: run }
  })

  fastify.post('/runs/:id/calculate', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.run.calculate',
      requestData: { id },
    })
    const payslips = await calculatePayrollRun({
      payrollRunId: id,
      operatorId: request.user.id,
    })

    setAfter(request, { payslipCount: payslips.length })

    return { code: 0, message: '薪资批次计算完成', data: { payslipCount: payslips.length } }
  })

  fastify.post('/runs/:id/publish', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    setAudit(request, {
      module: 'payroll',
      action: 'payroll.run.publish',
      requestData: { id },
    })
    await publishPayrollRun(id, request.user.id)

    return { code: 0, message: '工资条发布成功' }
  })

  // 薪资汇总报表
  fastify.get('/reports/summary', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Querystring: { payrollRunId?: number; departmentId?: number }
  }>) => {
    const { payrollRunId, departmentId } = request.query as { payrollRunId?: number; departmentId?: number }

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
        payrollRun: {
          select: {
            id: true,
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

    const summary = {
      totalGrossPay: 0,
      totalDeduction: 0,
      totalNetPay: 0,
      employeeCount: payslips.length,
    }

    const byDepartment: Record<string, any> = {}
    const byPeriod: Record<string, any> = {}

    for (const p of payslips as any[]) {
      summary.totalGrossPay += Number(p.grossPay)
      summary.totalDeduction += Number(p.totalDeduction)
      summary.totalNetPay += Number(p.netPay)

      const dept = p.employee?.department?.name || '未分配'
      if (!byDepartment[dept]) {
        byDepartment[dept] = { department: dept, employeeCount: 0, totalGrossPay: 0, totalDeduction: 0, totalNetPay: 0 }
      }
      byDepartment[dept].employeeCount++
      byDepartment[dept].totalGrossPay += Number(p.grossPay)
      byDepartment[dept].totalDeduction += Number(p.totalDeduction)
      byDepartment[dept].totalNetPay += Number(p.netPay)

      const period = `${p.payrollRun?.payrollPeriod?.year || '-'}-${String(p.payrollRun?.payrollPeriod?.month || '-').padStart(2, '0')}`
      if (!byPeriod[period]) {
        byPeriod[period] = { period, employeeCount: 0, totalGrossPay: 0, totalDeduction: 0, totalNetPay: 0 }
      }
      byPeriod[period].employeeCount++
      byPeriod[period].totalGrossPay += Number(p.grossPay)
      byPeriod[period].totalDeduction += Number(p.totalDeduction)
      byPeriod[period].totalNetPay += Number(p.netPay)
    }

    return {
      code: 0,
      data: {
        summary,
        byDepartment: Object.values(byDepartment),
        byPeriod: Object.values(byPeriod),
      },
    }
  })
}
