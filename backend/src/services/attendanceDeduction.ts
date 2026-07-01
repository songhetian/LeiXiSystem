import prisma from '../prisma'

export type DeductionType = 'late' | 'early_leave' | 'absent' | 'missing_checkin'

export type DeductionCalcType = 'fixed' | 'percentage' | 'salary_multiple' | 'leave_days'

export interface DeductionRuleFilter {
  page?: number
  pageSize?: number
  type?: DeductionType
  status?: string
  departmentId?: number
  keyword?: string
}

export interface DeductionRuleCreate {
  name: string
  type: DeductionType
  minMinutes: number
  maxMinutes?: number | null
  deductionType: DeductionCalcType
  deductionValue: number
  salaryMultiplier?: number | null
  affectAttendance: boolean
  leaveType?: string | null
  description?: string | null
  sortOrder?: number
  status?: string
  departmentId?: number | null
  createdBy?: number
}

export type DeductionRuleUpdate = Partial<DeductionRuleCreate>

export interface DeductionResult {
  ruleId: number | null
  ruleName: string | null
  deductionType: DeductionCalcType | null
  deductionAmount: number
  leaveDays: number
  affectAttendance: boolean
  leaveType: string | null
}

async function getDeductionRules(filter: DeductionRuleFilter = {}) {
  const page = filter.page || 1
  const pageSize = filter.pageSize || 20
  const skip = (page - 1) * pageSize
  const take = pageSize

  const where: any = {}

  if (filter.type) where.type = filter.type
  if (filter.status) where.status = filter.status
  if (filter.departmentId) where.departmentId = filter.departmentId
  if (filter.keyword) where.name = { contains: filter.keyword }

  const [total, list] = await Promise.all([
    prisma.attendanceDeductionRule.count({ where }),
    prisma.attendanceDeductionRule.findMany({
      where,
      skip,
      take,
      orderBy: [{ sortOrder: 'asc' }, { id: 'desc' }],
      include: {
        department: true,
        creator: { select: { id: true, realName: true } },
      },
    }),
  ])

  return { list, total, page, pageSize }
}

async function getDeductionRule(id: number) {
  return prisma.attendanceDeductionRule.findUnique({
    where: { id },
    include: {
      department: true,
      creator: { select: { id: true, realName: true } },
    },
  })
}

async function createDeductionRule(data: DeductionRuleCreate) {
  return prisma.attendanceDeductionRule.create({
    data: {
      ...data,
    },
  })
}

async function updateDeductionRule(id: number, data: DeductionRuleUpdate) {
  return prisma.attendanceDeductionRule.update({
    where: { id },
    data,
  })
}

async function deleteDeductionRule(id: number) {
  return prisma.attendanceDeductionRule.delete({
    where: { id },
  })
}

async function matchDeductionRule(type: DeductionType, minutes: number, departmentId?: number): Promise<any | null> {
  const rules = await prisma.attendanceDeductionRule.findMany({
    where: {
      type,
      status: 'active',
      OR: [
        { departmentId: null },
        ...(departmentId ? [{ departmentId }] : []),
      ],
    },
    orderBy: [
      { departmentId: 'desc' },
      { sortOrder: 'asc' },
      { minMinutes: 'asc' },
    ],
  })

  const matchedRule = rules.find((rule) => {
    if (minutes < rule.minMinutes) return false
    if (rule.maxMinutes !== null && minutes >= rule.maxMinutes) return false
    return true
  })

  return matchedRule || null
}

function calculateDeduction(type: DeductionType, minutes: number, dailySalary: number, rule: any): DeductionResult {
  if (!rule) {
    return {
      ruleId: null,
      ruleName: null,
      deductionType: null,
      deductionAmount: 0,
      leaveDays: 0,
      affectAttendance: true,
      leaveType: null,
    }
  }

  let deductionAmount = 0
  let leaveDays = 0

  switch (rule.deductionType) {
    case 'fixed':
      deductionAmount = Number(rule.deductionValue)
      break
    case 'percentage':
      deductionAmount = dailySalary * (Number(rule.deductionValue) / 100)
      break
    case 'salary_multiple':
      const multiplier = rule.salaryMultiplier ? Number(rule.salaryMultiplier) : 1
      deductionAmount = dailySalary * multiplier
      break
    case 'leave_days':
      leaveDays = Number(rule.deductionValue)
      break
  }

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    deductionType: rule.deductionType,
    deductionAmount: Math.round(deductionAmount * 100) / 100,
    leaveDays,
    affectAttendance: rule.affectAttendance,
    leaveType: rule.leaveType || null,
  }
}

export {
  getDeductionRules,
  getDeductionRule,
  createDeductionRule,
  updateDeductionRule,
  deleteDeductionRule,
  matchDeductionRule,
  calculateDeduction,
}
