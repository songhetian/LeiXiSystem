import prisma from '../prisma'

type ExceptionRule = {
  id: number
  name: string
  type: string
  threshold: number
  thresholdMax?: number | null
  autoResolve: boolean
  autoResolveType?: string | null
  deductMinutes: number
  status: string
  departmentId?: number | null
}

/**
 * 根据异常类型获取适用的规则
 */
export async function getApplicableRules(
  type: string,
  departmentId?: number
): Promise<ExceptionRule[]> {
  // 优先获取部门专属规则，再获取通用规则
  const rules = await prisma.attendanceExceptionRule.findMany({
    where: {
      type,
      status: 'active',
      OR: [
        { departmentId: departmentId || null },
        { departmentId: undefined },
      ],
    },
    orderBy: [
      // 部门专属规则优先
      { departmentId: 'desc' },
      { sortOrder: 'asc' },
    ],
  })

  return rules as ExceptionRule[]
}

/**
 * 判断异常是否匹配规则
 */
export function matchRule(rule: ExceptionRule, minutes: number): boolean {
  if (rule.thresholdMax) {
    // 区间判断
    return minutes >= rule.threshold && minutes <= rule.thresholdMax
  }
  // 单阈值判断
  return minutes >= rule.threshold
}

/**
 * 应用异常规则，计算扣除时长
 */
export function applyRule(rule: ExceptionRule, minutes: number): {
  shouldAutoResolve: boolean
  deductMinutes: number
  resolveType?: string
} {
  if (!matchRule(rule, minutes)) {
    return { shouldAutoResolve: false, deductMinutes: 0 }
  }

  return {
    shouldAutoResolve: rule.autoResolve,
    deductMinutes: rule.deductMinutes || 0,
    resolveType: rule.autoResolveType || undefined,
  }
}

/**
 * 处理考勤异常，根据规则自动应用处理
 */
export async function processExceptionWithRules(
  exceptionId: number,
  additionalMinutes: number = 0
): Promise<{
  resolved: boolean
  deductMinutes: number
  reason?: string
}> {
  const exception = await prisma.attendanceException.findUnique({
    where: { id: exceptionId },
    include: { employee: { include: { user: true } } },
  })

  if (!exception) {
    return { resolved: false, deductMinutes: 0 }
  }

  const rules = await getApplicableRules(
    exception.type,
    exception.employee?.user?.departmentId
  )

  let totalDeduct = 0
  let resolved = false
  let resolveType: string | undefined

  // 按优先级匹配第一条适用规则
  for (const rule of rules) {
    const result = applyRule(rule, additionalMinutes)
    if (result.shouldAutoResolve) {
      totalDeduct = result.deductMinutes
      resolved = true
      resolveType = result.resolveType
      break
    }
  }

  // 如果有匹配的规则，更新异常状态
  if (rules.length > 0) {
    await prisma.attendanceException.update({
      where: { id: exceptionId },
      data: {
        status: resolved ? 'resolved' : 'pending',
        reason: resolved
          ? `规则[${resolveType === 'ignore' ? '忽略' : resolveType === 'warn' ? '警告' : '扣除'}]自动处理`
          : undefined,
      },
    })
  }

  return {
    resolved,
    deductMinutes: totalDeduct,
  }
}

/**
 * 批量处理某日的考勤异常
 */
export async function processDailyExceptions(
  employeeId: number,
  date: Date,
  exceptionDetails: {
    lateMinutes?: number
    earlyMinutes?: number
    absentMinutes?: number
  }
): Promise<{
  lateResolved: boolean
  earlyResolved: boolean
  absentResolved: boolean
  totalDeductMinutes: number
}> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  })

  const departmentId = employee?.user?.departmentId

  const [lateRules, earlyRules, absentRules] = await Promise.all([
    getApplicableRules('late', departmentId),
    getApplicableRules('early', departmentId),
    getApplicableRules('absent', departmentId),
  ])

  let totalDeductMinutes = 0
  let lateResolved = false
  let earlyResolved = false
  let absentResolved = false

  // 处理迟到
  if (exceptionDetails.lateMinutes && exceptionDetails.lateMinutes > 0) {
    for (const rule of lateRules) {
      if (matchRule(rule, exceptionDetails.lateMinutes)) {
        if (rule.autoResolve) {
          lateResolved = true
          totalDeductMinutes += rule.deductMinutes || 0
        }
        break
      }
    }
  }

  // 处理早退
  if (exceptionDetails.earlyMinutes && exceptionDetails.earlyMinutes > 0) {
    for (const rule of earlyRules) {
      if (matchRule(rule, exceptionDetails.earlyMinutes)) {
        if (rule.autoResolve) {
          earlyResolved = true
          totalDeductMinutes += rule.deductMinutes || 0
        }
        break
      }
    }
  }

  // 处理旷工
  if (exceptionDetails.absentMinutes && exceptionDetails.absentMinutes > 0) {
    for (const rule of absentRules) {
      if (matchRule(rule, exceptionDetails.absentMinutes)) {
        if (rule.autoResolve) {
          absentResolved = true
          totalDeductMinutes += rule.deductMinutes || 0
        }
        break
      }
    }
  }

  return {
    lateResolved,
    earlyResolved,
    absentResolved,
    totalDeductMinutes,
  }
}

/**
 * 获取异常规则处理预览（不实际应用）
 */
export async function previewExceptionRules(
  type: string,
  minutes: number,
  departmentId?: number
): Promise<{
  matched: boolean
  ruleName?: string
  autoResolve?: boolean
  resolveType?: string
  deductMinutes: number
}[]> {
  const rules = await getApplicableRules(type, departmentId)

  const results = []
  for (const rule of rules) {
    if (matchRule(rule, minutes)) {
      results.push({
        matched: true,
        ruleName: rule.name,
        autoResolve: rule.autoResolve,
        resolveType: rule.autoResolveType || undefined,
        deductMinutes: rule.deductMinutes || 0,
      })
    }
  }

  return results
}
