import prisma from '../prisma'

type CalculatePayrollRunInput = {
  payrollRunId: number
  operatorId: number
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0
  return Number(value)
}

function calculateComponentAmount(input: {
  amountType: string
  amount?: unknown
  formula?: string | null
  baseSalary: number
  monthlyAttendance?: { expectedWorkDays: unknown; actualWorkDays: unknown; paidLeaveDays: unknown }
}) {
  const { amountType, amount, formula, baseSalary, monthlyAttendance } = input

  if (amountType === 'fixed') {
    return toNumber(amount)
  }

  if (amountType === 'attendance_based') {
    const expectedWorkDays = toNumber(monthlyAttendance?.expectedWorkDays)
    const paidDays = toNumber(monthlyAttendance?.actualWorkDays) + toNumber(monthlyAttendance?.paidLeaveDays)
    if (!expectedWorkDays) return 0
    return Number((baseSalary * paidDays / expectedWorkDays).toFixed(2))
  }

  if (amountType === 'formula') {
    if (formula === 'baseSalary') return baseSalary
    if (formula === 'baseSalary/21.75') return Number((baseSalary / 21.75).toFixed(2))
    return toNumber(amount)
  }

  return toNumber(amount)
}

function getMonthEndDate(year: number, month: number) {
  const end = new Date(year, month, 0)
  end.setHours(23, 59, 59, 999)
  return end
}

export async function calculatePayrollRun(input: CalculatePayrollRunInput) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: input.payrollRunId },
    include: { payrollPeriod: true },
  })

  if (!run) {
    throw new Error('薪资批次不存在')
  }

  if (!['draft', 'calculated'].includes(run.status)) {
    throw new Error('当前薪资批次状态不允许重新计算')
  }

  await prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: 'calculating' },
  })

  try {
    const periodEnd = getMonthEndDate(run.payrollPeriod.year, run.payrollPeriod.month)
    const employeeWhere: any = { status: 'active' }
    if (run.scopeType === 'employee' && Array.isArray(run.scopeValue)) {
      employeeWhere.id = { in: run.scopeValue.map(Number) }
    }
    if (run.scopeType === 'department' && Array.isArray(run.scopeValue)) {
      employeeWhere.user = { departmentId: { in: run.scopeValue.map(Number) } }
    }

    const employees = await prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, userId: true },
    })

    const employeeIds = employees.map((employee) => employee.id)
    if (!employeeIds.length) {
      await prisma.payrollRun.update({
        where: { id: run.id },
        data: { status: 'calculated' },
      })
      return []
    }

    const [assignments, monthlyAttendances, approvedAdjustments, existingPayslips] = await Promise.all([
      prisma.salaryAssignment.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'active',
          effectiveFrom: { lte: periodEnd },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: periodEnd } },
          ],
        },
        include: {
          salaryStructure: {
            include: {
              items: {
                include: { component: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
        orderBy: [{ employeeId: 'asc' }, { effectiveFrom: 'desc' }],
      }),
      prisma.attendanceMonthly.findMany({
        where: {
          employeeId: { in: employeeIds },
          year: run.payrollPeriod.year,
          month: run.payrollPeriod.month,
        },
      }),
      prisma.payrollAdjustment.findMany({
        where: {
          employeeId: { in: employeeIds },
          year: run.payrollPeriod.year,
          month: run.payrollPeriod.month,
          status: 'approved',
        },
        include: { component: true },
        orderBy: { id: 'asc' },
      }),
      prisma.payslip.findMany({
        where: { payrollRunId: run.id, employeeId: { in: employeeIds } },
        select: { id: true, employeeId: true },
      }),
    ])

    const assignmentMap = new Map<number, (typeof assignments)[number]>()
    for (const assignment of assignments) {
      if (!assignmentMap.has(assignment.employeeId)) {
        assignmentMap.set(assignment.employeeId, assignment)
      }
    }

    const attendanceMap = new Map(monthlyAttendances.map((attendance) => [attendance.employeeId, attendance]))
    const existingPayslipMap = new Map(existingPayslips.map((payslip) => [payslip.employeeId, payslip]))
    const adjustmentMap = new Map<number, typeof approvedAdjustments>()
    for (const adjustment of approvedAdjustments) {
      const grouped = adjustmentMap.get(adjustment.employeeId) || []
      grouped.push(adjustment)
      adjustmentMap.set(adjustment.employeeId, grouped)
    }

    const payslips = []

    for (const employee of employees) {
      const assignment = assignmentMap.get(employee.id)
      if (!assignment) continue

      const monthlyAttendance = attendanceMap.get(employee.id)
      const employeeAdjustments = adjustmentMap.get(employee.id) || []

      const structureItems = assignment.salaryStructure.items.map((item) => {
        const amount = calculateComponentAmount({
          amountType: item.component.amountType,
          amount: item.amount,
          formula: item.formula || item.component.formula,
          baseSalary: toNumber(assignment.baseSalary),
          monthlyAttendance: monthlyAttendance || undefined,
        })

        return {
          componentId: item.componentId,
          type: item.component.type,
          amount,
          formulaSnapshot: item.formula || item.component.formula,
          sortOrder: item.sortOrder,
        }
      })

      const adjustmentItems = employeeAdjustments.map((adjustment, index) => ({
        componentId: adjustment.componentId,
        type: adjustment.type,
        amount: toNumber(adjustment.amount),
        formulaSnapshot: `adjustment:${adjustment.reason}`,
        sourceType: 'payroll_adjustment',
        sourceId: adjustment.id,
        sortOrder: 1000 + index,
      }))

      const items = [...structureItems, ...adjustmentItems]

      const grossPay = items
        .filter((item) => item.type === 'earning')
        .reduce((sum, item) => sum + item.amount, 0)
      const totalDeduction = items
        .filter((item) => item.type === 'deduction')
        .reduce((sum, item) => sum + item.amount, 0)
      const netPay = grossPay - totalDeduction

      const existing = existingPayslipMap.get(employee.id)
      const payslip = await prisma.$transaction(async (tx) => {
        if (existing) {
          await tx.payslipItem.deleteMany({ where: { payslipId: existing.id } })
          return tx.payslip.update({
            where: { id: existing.id },
            data: {
              userId: employee.userId,
              grossPay,
              totalDeduction,
              netPay,
              expectedWorkDays: monthlyAttendance?.expectedWorkDays || 0,
              paidDays: toNumber(monthlyAttendance?.actualWorkDays) + toNumber(monthlyAttendance?.paidLeaveDays),
              absentDays: monthlyAttendance?.absentDays || 0,
              unpaidLeaveDays: monthlyAttendance?.unpaidLeaveDays || 0,
              overtimeAmount: 0,
              status: 'draft',
              attendanceSnapshot: monthlyAttendance as any,
              formulaSnapshot: assignment.salaryStructure as any,
              items: { create: items },
            },
            include: { items: true },
          })
        }

        return tx.payslip.create({
          data: {
            payrollRunId: run.id,
            employeeId: employee.id,
            userId: employee.userId,
            grossPay,
            totalDeduction,
            netPay,
            expectedWorkDays: monthlyAttendance?.expectedWorkDays || 0,
            paidDays: toNumber(monthlyAttendance?.actualWorkDays) + toNumber(monthlyAttendance?.paidLeaveDays),
            absentDays: monthlyAttendance?.absentDays || 0,
            unpaidLeaveDays: monthlyAttendance?.unpaidLeaveDays || 0,
            overtimeAmount: 0,
            status: 'draft',
            attendanceSnapshot: monthlyAttendance as any,
            formulaSnapshot: assignment.salaryStructure as any,
            items: { create: items },
          },
          include: { items: true },
        })
      })

      payslips.push(payslip)
    }

    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'calculated' },
    })

    return payslips
  } catch (error) {
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: { status: 'failed' },
    })
    throw error
  }
}

export async function publishPayrollRun(payrollRunId: number, operatorId: number) {
  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
  })

  if (!run) {
    throw new Error('薪资批次不存在')
  }

  if (!['calculated', 'approved'].includes(run.status)) {
    throw new Error('只有已计算或已审批的薪资批次可以发布')
  }

  await prisma.$transaction([
    prisma.payslip.updateMany({
      where: { payrollRunId, status: 'draft' },
      data: { status: 'published', publishedAt: new Date() },
    }),
    prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: 'published', approvedBy: operatorId, lockedAt: new Date() },
    }),
  ])
}

export async function recalculatePayslip(payslipId: number) {
  const existing = await prisma.payslip.findUnique({
    where: { id: payslipId },
    include: {
      payrollRun: { include: { payrollPeriod: true } },
      employee: { include: { user: true } },
    },
  })

  if (!existing) {
    throw new Error('工资条不存在')
  }

  if (['confirmed', 'cancelled'].includes(existing.status)) {
    throw new Error('已确认或已取消的工资条不允许重算')
  }

  const periodEnd = getMonthEndDate(existing.payrollRun.payrollPeriod.year, existing.payrollRun.payrollPeriod.month)
  const assignment = await prisma.salaryAssignment.findFirst({
    where: {
      employeeId: existing.employeeId,
      status: 'active',
      effectiveFrom: { lte: periodEnd },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: periodEnd } },
      ],
    },
    include: {
      salaryStructure: {
        include: {
          items: {
            include: { component: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!assignment) {
    throw new Error('员工没有有效薪资分配')
  }

  const monthlyAttendance = await prisma.attendanceMonthly.findUnique({
    where: {
      employeeId_year_month: {
        employeeId: existing.employeeId,
        year: existing.payrollRun.payrollPeriod.year,
        month: existing.payrollRun.payrollPeriod.month,
      },
    },
  })

  const approvedAdjustments = await prisma.payrollAdjustment.findMany({
    where: {
      employeeId: existing.employeeId,
      year: existing.payrollRun.payrollPeriod.year,
      month: existing.payrollRun.payrollPeriod.month,
      status: 'approved',
    },
    include: { component: true },
    orderBy: { id: 'asc' },
  })

  const structureItems = assignment.salaryStructure.items.map((item) => {
    const amount = calculateComponentAmount({
      amountType: item.component.amountType,
      amount: item.amount,
      formula: item.formula || item.component.formula,
      baseSalary: toNumber(assignment.baseSalary),
      monthlyAttendance: monthlyAttendance || undefined,
    })

    return {
      componentId: item.componentId,
      type: item.component.type,
      amount,
      formulaSnapshot: item.formula || item.component.formula,
      sortOrder: item.sortOrder,
    }
  })

  const adjustmentItems = approvedAdjustments.map((adjustment, index) => ({
    componentId: adjustment.componentId,
    type: adjustment.type,
    amount: toNumber(adjustment.amount),
    formulaSnapshot: `adjustment:${adjustment.reason}`,
    sourceType: 'payroll_adjustment',
    sourceId: adjustment.id,
    sortOrder: 1000 + index,
  }))

  const items = [...structureItems, ...adjustmentItems]

  const grossPay = items
    .filter((item) => item.type === 'earning')
    .reduce((sum, item) => sum + item.amount, 0)
  const totalDeduction = items
    .filter((item) => item.type === 'deduction')
    .reduce((sum, item) => sum + item.amount, 0)
  const netPay = grossPay - totalDeduction

  return prisma.$transaction(async (tx) => {
    await tx.payslipItem.deleteMany({ where: { payslipId } })
    return tx.payslip.update({
      where: { id: payslipId },
      data: {
        grossPay,
        totalDeduction,
        netPay,
        expectedWorkDays: monthlyAttendance?.expectedWorkDays || 0,
        paidDays: toNumber(monthlyAttendance?.actualWorkDays) + toNumber(monthlyAttendance?.paidLeaveDays),
        absentDays: monthlyAttendance?.absentDays || 0,
        unpaidLeaveDays: monthlyAttendance?.unpaidLeaveDays || 0,
        overtimeAmount: 0,
        status: 'draft',
        publishedAt: null,
        viewedAt: null,
        confirmedAt: null,
        attendanceSnapshot: monthlyAttendance as any,
        formulaSnapshot: assignment.salaryStructure as any,
        items: { create: items },
      },
      include: { items: true },
    })
  })
}

export async function withdrawPayslip(payslipId: number) {
  const existing = await prisma.payslip.findUnique({
    where: { id: payslipId },
  })

  if (!existing) {
    throw new Error('工资条不存在')
  }

  if (!['published', 'viewed'].includes(existing.status)) {
    throw new Error('只有已发布或已查看的工资条可以撤回')
  }

  return prisma.payslip.update({
    where: { id: payslipId },
    data: {
      status: 'draft',
      publishedAt: null,
      viewedAt: null,
    },
  })
}
