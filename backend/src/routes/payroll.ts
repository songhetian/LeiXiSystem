import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { buildEmployeeDataScopeWhere } from '../services/dataScope'
import { writeAuditLog } from '../services/audit'
import { calculatePayrollRun, publishPayrollRun, recalculatePayslip, withdrawPayslip } from '../services/payrollCalculation'

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

async function ensureEmployeeInScope(user: FastifyRequest['user'], employeeId: number) {
  const employeeScope = await buildEmployeeDataScopeWhere(user)
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      ...employeeScope,
    },
    select: { id: true },
  })
  return Boolean(employee)
}

export default async function payrollRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/components', { preHandler: [requirePermission('payroll:manage')] }, async () => {
    const list = await prisma.salaryComponent.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
    })
    return { code: 0, data: list }
  })

  fastify.post('/components', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: {
      name: string
      code: string
      type: string
      amountType?: string
      formula?: string
      taxable?: boolean
      enabled?: boolean
      sortOrder?: number
    }
  }>) => {
    const body = request.body
    const component = await prisma.salaryComponent.create({
      data: {
        name: body.name,
        code: body.code,
        type: body.type,
        amountType: body.amountType || 'fixed',
        formula: body.formula,
        taxable: body.taxable || false,
        enabled: body.enabled ?? true,
        sortOrder: body.sortOrder || 0,
      },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'salary_component_create',
      requestData: body,
      responseData: { id: component.id },
    })

    return { code: 0, message: '薪资组件创建成功', data: component }
  })

  fastify.put('/components/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: {
      name?: string
      code?: string
      type?: string
      amountType?: string
      formula?: string
      taxable?: boolean
      enabled?: boolean
      sortOrder?: number
    }
  }>, reply) => {
    const id = Number(request.params.id)
    const body = request.body
    const existing = await prisma.salaryComponent.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资组件不存在' })
    }

    const component = await prisma.salaryComponent.update({
      where: { id },
      data: {
        name: body.name,
        code: body.code,
        type: body.type,
        amountType: body.amountType,
        formula: body.formula,
        taxable: body.taxable,
        enabled: body.enabled,
        sortOrder: body.sortOrder,
      },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'salary_component_update',
      requestData: body,
      responseData: { id: component.id },
    })

    return { code: 0, message: '薪资组件更新成功', data: component }
  })

  fastify.get('/structures', { preHandler: [requirePermission('payroll:manage')] }, async () => {
    const list = await prisma.salaryStructure.findMany({
      include: { items: { include: { component: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { id: 'desc' },
    })
    return { code: 0, data: list }
  })

  fastify.post('/structures', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: {
      name: string
      payrollFrequency?: string
      effectiveFrom: string
      effectiveTo?: string
      items?: Array<{ componentId: number; amount?: number; formula?: string; condition?: string; sortOrder?: number }>
    }
  }>) => {
    const body = request.body
    const structure = await prisma.salaryStructure.create({
      data: {
        name: body.name,
        payrollFrequency: body.payrollFrequency || 'monthly',
        status: 'active',
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
        items: {
          create: (body.items || []).map((item) => ({
            componentId: Number(item.componentId),
            amount: item.amount,
            formula: item.formula,
            condition: item.condition,
            sortOrder: item.sortOrder || 0,
          })),
        },
      },
      include: { items: true },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'salary_structure_create',
      requestData: body,
      responseData: { id: structure.id },
    })

    return { code: 0, message: '薪资结构创建成功', data: structure }
  })

  fastify.put('/structures/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: {
      name?: string
      payrollFrequency?: string
      status?: string
      effectiveFrom?: string
      effectiveTo?: string
      items?: Array<{ componentId: number; amount?: number; formula?: string; condition?: string; sortOrder?: number }>
    }
  }>, reply) => {
    const id = Number(request.params.id)
    const body = request.body
    const existing = await prisma.salaryStructure.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资结构不存在' })
    }

    const structure = await prisma.$transaction(async (tx) => {
      await tx.salaryStructureItem.deleteMany({ where: { salaryStructureId: id } })
      return tx.salaryStructure.update({
        where: { id },
        data: {
          name: body.name,
          payrollFrequency: body.payrollFrequency,
          status: body.status,
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
          effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
          items: {
            create: (body.items || []).map((item) => ({
              componentId: Number(item.componentId),
              amount: item.amount,
              formula: item.formula,
              condition: item.condition,
              sortOrder: item.sortOrder || 0,
            })),
          },
        },
        include: { items: { include: { component: true }, orderBy: { sortOrder: 'asc' } } },
      })
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'salary_structure_update',
      requestData: body,
      responseData: { id: structure.id },
    })

    return { code: 0, message: '薪资结构更新成功', data: structure }
  })

  fastify.get('/assignments', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Querystring: { employeeId?: number; status?: string }
  }>) => {
    const { employeeId, status } = request.query
    const where: any = {}
    if (employeeId) where.employeeId = Number(employeeId)
    if (status) where.status = status

    const list = await prisma.salaryAssignment.findMany({
      where,
      include: {
        employee: { include: { user: { include: { department: true } } } },
        salaryStructure: true,
      },
      orderBy: { id: 'desc' },
    })

    return { code: 0, data: list }
  })

  fastify.post('/assignments', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Body: { employeeId: number; salaryStructureId: number; baseSalary: number; effectiveFrom: string; effectiveTo?: string; status?: string }
  }>) => {
    const body = request.body
    const assignment = await prisma.salaryAssignment.create({
      data: {
        employeeId: Number(body.employeeId),
        salaryStructureId: Number(body.salaryStructureId),
        baseSalary: body.baseSalary,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
        status: body.status || 'active',
      },
      include: {
        employee: { include: { user: true } },
        salaryStructure: true,
      },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'salary_assignment_create',
      requestData: body,
      responseData: { id: assignment.id },
    })

    return { code: 0, message: '员工薪资分配创建成功', data: assignment }
  })

  fastify.put('/assignments/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { employeeId?: number; salaryStructureId?: number; baseSalary?: number; effectiveFrom?: string; effectiveTo?: string; status?: string }
  }>, reply) => {
    const id = Number(request.params.id)
    const body = request.body
    const existing = await prisma.salaryAssignment.findUnique({ where: { id } })

    if (!existing) {
      return reply.status(404).send({ code: 404, message: '员工薪资分配不存在' })
    }

    const assignment = await prisma.salaryAssignment.update({
      where: { id },
      data: {
        employeeId: body.employeeId ? Number(body.employeeId) : undefined,
        salaryStructureId: body.salaryStructureId ? Number(body.salaryStructureId) : undefined,
        baseSalary: body.baseSalary,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        status: body.status,
      },
      include: {
        employee: { include: { user: true } },
        salaryStructure: true,
      },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'salary_assignment_update',
      requestData: body,
      responseData: { id: assignment.id },
    })

    return { code: 0, message: '员工薪资分配更新成功', data: assignment }
  })

  fastify.get('/runs', { preHandler: [requirePermission('payroll:manage')] }, async () => {
    const list = await prisma.payrollRun.findMany({
      include: { payrollPeriod: true, creator: { select: { id: true, realName: true } }, payslips: true },
      orderBy: { id: 'desc' },
    })
    return { code: 0, data: list }
  })

  fastify.get('/runs/:id/detail', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const id = Number(request.params.id)
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
        include: {
          employee: { include: { user: { include: { department: true } } } },
          disputes: { orderBy: { createdAt: 'desc' } },
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
    Body: { year: number; month: number; startDate: string; endDate: string; scopeType?: string; scopeValue?: unknown }
  }>) => {
    const body = request.body
    const period = await prisma.payrollPeriod.upsert({
      where: { year_month: { year: Number(body.year), month: Number(body.month) } },
      update: {
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      },
      create: {
        year: Number(body.year),
        month: Number(body.month),
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      },
    })

    const run = await prisma.payrollRun.create({
      data: {
        payrollPeriodId: period.id,
        scopeType: body.scopeType || 'all',
        scopeValue: body.scopeValue as any,
        createdBy: request.user.id,
      },
      include: { payrollPeriod: true },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payroll_run_create',
      requestData: body,
      responseData: { id: run.id },
    })

    return { code: 0, message: '薪资批次创建成功', data: run }
  })

  fastify.post('/runs/:id/calculate', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const payslips = await calculatePayrollRun({
      payrollRunId: Number(request.params.id),
      operatorId: request.user.id,
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payroll_run_calculate',
      requestData: request.params,
      responseData: { payslipCount: payslips.length },
    })

    return { code: 0, message: '薪资批次计算完成', data: { payslipCount: payslips.length } }
  })

  fastify.post('/runs/:id/publish', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    await publishPayrollRun(Number(request.params.id), request.user.id)

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payroll_run_publish',
      requestData: request.params,
    })

    return { code: 0, message: '工资条发布成功' }
  })

  fastify.get('/payslips', { preHandler: [requireAnyPermission(['payroll:manage', 'payroll:payslip:view-all'])] }, async (request: FastifyRequest<{
    Querystring: { payrollRunId?: number; employeeId?: number }
  }>) => {
    const { payrollRunId, employeeId } = request.query
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)
    const where: any = { employee: employeeScope }
    if (payrollRunId) where.payrollRunId = Number(payrollRunId)
    if (employeeId) where.employeeId = Number(employeeId)

    const list = await prisma.payslip.findMany({
      where,
      include: {
        employee: { include: { user: { include: { department: true } } } },
        payrollRun: { include: { payrollPeriod: true } },
        disputes: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { id: 'desc' },
    })

    return { code: 0, data: list }
  })

  fastify.post('/payslips/:id/recalculate', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const existing = await prisma.payslip.findUnique({
      where: { id: Number(request.params.id) },
      select: { employeeId: true },
    })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }
    if (!await ensureEmployeeInScope(request.user, existing.employeeId)) {
      return reply.status(403).send({ code: 403, message: '没有权限操作该工资条' })
    }

    const payslip = await recalculatePayslip(Number(request.params.id))

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payslip_recalculate',
      requestData: request.params,
      responseData: { id: payslip.id },
    })

    return { code: 0, message: '工资条重算完成', data: payslip }
  })

  fastify.post('/payslips/:id/withdraw', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const existing = await prisma.payslip.findUnique({
      where: { id: Number(request.params.id) },
      select: { employeeId: true },
    })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }
    if (!await ensureEmployeeInScope(request.user, existing.employeeId)) {
      return reply.status(403).send({ code: 403, message: '没有权限操作该工资条' })
    }

    const payslip = await withdrawPayslip(Number(request.params.id))

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payslip_withdraw',
      requestData: request.params,
      responseData: { id: payslip.id },
    })

    return { code: 0, message: '工资条已撤回', data: payslip }
  })

  fastify.get('/adjustments', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Querystring: { year?: number; month?: number; employeeId?: number; status?: string }
  }>) => {
    const { year, month, employeeId, status } = request.query
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)
    const where: any = { employee: employeeScope }
    if (year) where.year = Number(year)
    if (month) where.month = Number(month)
    if (employeeId) where.employeeId = Number(employeeId)
    if (status) where.status = status

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
    Body: { employeeId: number; componentId: number; year: number; month: number; type: string; amount: number; reason: string; status?: string }
  }>, reply) => {
    const body = request.body
    if (!await ensureEmployeeInScope(request.user, Number(body.employeeId))) {
      return reply.status(403).send({ code: 403, message: '没有权限为该员工创建薪资调整项' })
    }

    const adjustment = await prisma.payrollAdjustment.create({
      data: {
        employeeId: Number(body.employeeId),
        componentId: Number(body.componentId),
        year: Number(body.year),
        month: Number(body.month),
        type: body.type,
        amount: body.amount,
        reason: body.reason,
        status: body.status || 'pending',
        createdBy: request.user.id,
        approvedBy: body.status === 'approved' ? request.user.id : undefined,
        approvedAt: body.status === 'approved' ? new Date() : undefined,
      },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payroll_adjustment_create',
      requestData: body,
      responseData: { id: adjustment.id },
    })

    return { code: 0, message: '薪资调整项创建成功', data: adjustment }
  })

  fastify.post('/adjustments/:id/approve', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>, reply) => {
    const existing = await prisma.payrollAdjustment.findUnique({ where: { id: Number(request.params.id) } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资调整项不存在' })
    }
    if (!await ensureEmployeeInScope(request.user, existing.employeeId)) {
      return reply.status(403).send({ code: 403, message: '没有权限操作该薪资调整项' })
    }
    if (existing.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该薪资调整项已处理' })
    }

    const adjustment = await prisma.payrollAdjustment.update({
      where: { id: existing.id },
      data: { status: 'approved', approvedBy: request.user.id, approvedAt: new Date(), approvalOpinion: request.body?.opinion },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payroll_adjustment_approve',
      requestData: { ...request.params, opinion: request.body?.opinion },
      responseData: { id: adjustment.id },
    })

    return { code: 0, message: '薪资调整项已审批通过', data: adjustment }
  })

  fastify.post('/adjustments/:id/reject', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>, reply) => {
    const existing = await prisma.payrollAdjustment.findUnique({ where: { id: Number(request.params.id) } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '薪资调整项不存在' })
    }
    if (!await ensureEmployeeInScope(request.user, existing.employeeId)) {
      return reply.status(403).send({ code: 403, message: '没有权限操作该薪资调整项' })
    }
    if (existing.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该薪资调整项已处理' })
    }

    const adjustment = await prisma.payrollAdjustment.update({
      where: { id: existing.id },
      data: { status: 'rejected', approvedBy: request.user.id, approvedAt: new Date(), approvalOpinion: request.body?.opinion },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payroll_adjustment_reject',
      requestData: { ...request.params, opinion: request.body?.opinion },
      responseData: { id: adjustment.id },
    })

    return { code: 0, message: '薪资调整项已驳回', data: adjustment }
  })

  fastify.get('/disputes', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{
    Querystring: { status?: string; employeeId?: number; payslipId?: number }
  }>) => {
    const { status, employeeId, payslipId } = request.query
    const employeeScope = await buildEmployeeDataScopeWhere(request.user)
    const where: any = { employee: employeeScope }
    if (status) where.status = status
    if (employeeId) where.employeeId = Number(employeeId)
    if (payslipId) where.payslipId = Number(payslipId)

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
    Params: { id: string }
    Body: { status: 'resolved' | 'rejected'; handlerReply?: string }
  }>, reply) => {
    const existing = await prisma.payslipDispute.findUnique({ where: { id: Number(request.params.id) } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '工资条申诉不存在' })
    }
    if (!await ensureEmployeeInScope(request.user, existing.employeeId)) {
      return reply.status(403).send({ code: 403, message: '没有权限处理该工资条申诉' })
    }
    if (existing.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该工资条申诉已处理' })
    }

    const dispute = await prisma.payslipDispute.update({
      where: { id: existing.id },
      data: {
        status: request.body.status,
        handlerReply: request.body.handlerReply,
        handlerId: request.user.id,
        handledAt: new Date(),
      },
    })

    if (request.body.status === 'resolved') {
      await prisma.payslip.update({
        where: { id: existing.payslipId },
        data: { status: 'viewed' },
      })
    }

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'payslip_dispute_handle',
      requestData: { id: existing.id, ...request.body },
      responseData: { id: dispute.id },
    })

    return { code: 0, message: '工资条申诉已处理', data: dispute }
  })

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
    Params: { id: string }
  }>, reply) => {
    const verification = await verifyPayslipAccessToken(fastify, request, reply)
    if (verification) return verification

    const payslip = await prisma.payslip.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
      include: {
        items: { include: { component: true }, orderBy: { sortOrder: 'asc' } },
        payrollRun: { include: { payrollPeriod: true } },
        disputes: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: payslip.viewedAt ? {} : { viewedAt: new Date(), status: payslip.status === 'published' ? 'viewed' : payslip.status },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'my_payslip_view',
      responseData: { payslipId: payslip.id },
    })

    return { code: 0, data: payslip }
  })

  fastify.post('/my-payslips/:id/confirm', { preHandler: [requireAnyPermission(['payslip:view', 'payroll:payslip:view-self'])] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>, reply) => {
    const payslip = await prisma.payslip.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })

    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    if (!['published', 'viewed'].includes(payslip.status)) {
      return reply.status(400).send({ code: 400, message: '当前工资条状态不允许确认' })
    }

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'my_payslip_confirm',
      responseData: { payslipId: payslip.id },
    })

    return { code: 0, message: '工资条已确认' }
  })

  fastify.post('/my-payslips/:id/dispute', { preHandler: [requireAnyPermission(['payslip:view', 'payroll:payslip:view-self'])] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { reason: string }
  }>, reply) => {
    const payslip = await prisma.payslip.findFirst({
      where: { id: Number(request.params.id), userId: request.user.id },
    })

    if (!payslip) {
      return reply.status(404).send({ code: 404, message: '工资条不存在' })
    }

    if (!['published', 'viewed', 'confirmed'].includes(payslip.status)) {
      return reply.status(400).send({ code: 400, message: '当前工资条状态不允许申诉' })
    }

    const dispute = await prisma.payslipDispute.create({
      data: {
        payslipId: payslip.id,
        employeeId: payslip.employeeId,
        userId: request.user.id,
        reason: request.body.reason,
      },
    })

    await prisma.payslip.update({
      where: { id: payslip.id },
      data: { status: 'disputed' },
    })

    await writeAuditLog(request, {
      module: 'payroll',
      action: 'my_payslip_dispute',
      requestData: { payslipId: payslip.id, reason: request.body.reason },
      responseData: { id: dispute.id },
    })

    return { code: 0, message: '工资条申诉已提交', data: dispute }
  })
}
