import prisma from '../prisma'
import { Decimal } from '@prisma/client/runtime/library'

export interface RecommendParams {
  departmentId?: number
  startDate: string
  endDate: string
  ruleId?: number
  excludeEmployeeIds?: number[]
}

export interface ScheduleRecommendation {
  employeeId: number
  employeeNo: string
  realName: string
  scheduleDate: string
  shiftId: number
  shiftName: string
  shiftColor?: string
  confidence: number
  conflicts: string[]
}

export interface ConflictWarning {
  date: string
  employeeId: number
  employeeName: string
  type: 'hard' | 'soft'
  message: string
}

export interface ScheduleStatistics {
  total: number
  byShift: Record<string, number>
  byEmployee: Record<string, number>
}

export interface RecommendResult {
  recommendations: ScheduleRecommendation[]
  warnings: ConflictWarning[]
  statistics: ScheduleStatistics
}

// 计算两个班次之间的休息时长（小时）
function getRestHours(prevEndTime: string, nextStartTime: string): number {
  const [prevH, prevM] = prevEndTime.split(':').map(Number)
  const [nextH, nextM] = nextStartTime.split(':').map(Number)
  let hours = (nextH + 24) - prevH
  if (hours < 0) hours += 24
  hours -= (nextM - prevM) / 60
  return hours
}

// 检查是否是夜班
function isNightShift(shift: { startTime: string; endTime: string }): boolean {
  const [startH] = shift.startTime.split(':').map(Number)
  return startH >= 20 || startH < 6
}

// 智能推荐引擎
export async function generateScheduleRecommendations(params: RecommendParams): Promise<RecommendResult> {
  const { departmentId, startDate, endDate, ruleId, excludeEmployeeIds = [] } = params

  // 1. 获取适用的规则
  let rule = ruleId
    ? await prisma.scheduleRule.findUnique({ where: { id: ruleId } })
    : departmentId
      ? await prisma.scheduleRule.findFirst({
          where: { departmentId, status: 'active' },
          orderBy: { priority: 'desc' },
        })
      : await prisma.scheduleRule.findFirst({
          where: { departmentId: null, status: 'active' },
          orderBy: { priority: 'desc' },
        })

  // 如果没有找到规则，使用默认配置
  if (!rule) {
    rule = {
      id: 0,
      name: '默认规则',
      code: 'default',
      departmentId: null,
      shiftIds: '',
      pattern: null,
      maxWorkHoursPerWeek: new Decimal(44),
      maxConsecutiveDays: 6,
      minRestHoursBetween: 11,
      maxNightShiftsPerWeek: null,
      priority: 0,
      fairnessWeight: 50,
      preferenceEnabled: true,
      status: 'active',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  // 2. 获取班次列表
  const shiftIdList = rule.shiftIds ? rule.shiftIds.split(',').map(Number).filter(Boolean) : []
  const shifts = shiftIdList.length > 0
    ? await prisma.shift.findMany({ where: { id: { in: shiftIdList }, status: 'active' } })
    : await prisma.shift.findMany({ where: { status: 'active' } })

  if (shifts.length === 0) {
    return {
      recommendations: [],
      warnings: [],
      statistics: { total: 0, byShift: {}, byEmployee: {} },
    }
  }

  // 3. 获取部门员工
  const employeeWhere: any = {
    status: 'active',
    user: { status: 'active' },
  }
  if (departmentId) {
    employeeWhere.user = { ...employeeWhere.user, departmentId }
  }
  if (excludeEmployeeIds.length > 0) {
    employeeWhere.id = { notIn: excludeEmployeeIds }
  }

  const employees = await prisma.employee.findMany({
    where: employeeWhere,
    select: {
      id: true,
      employeeNo: true,
      userId: true,
      user: { select: { realName: true } },
    },
  })

  // 4. 获取已有排班
  const existingSchedules = await prisma.schedule.findMany({
    where: {
      scheduleDate: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
      employeeId: { in: employees.map((e) => e.id) },
    },
    include: { shift: true },
  })

  // 5. 获取员工偏好
  const preferences = await prisma.employeeSchedulePreference.findMany({
    where: { employeeId: { in: employees.map((e) => e.id) } },
  })
  const prefMap = new Map(preferences.map((p) => [p.employeeId, p]))

  // 6. 获取请假/出差等日历冲突
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      status: 'approved',
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) },
    },
  })

  // 7. 生成日期列表
  const dates: Date[] = []
  const start = new Date(startDate)
  const end = new Date(endDate)
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d))
  }

  const recommendations: ScheduleRecommendation[] = []
  const warnings: ConflictWarning[] = []

  // 按日期逐日处理
  for (const date of dates) {
    const dateStr = date.toISOString().split('T')[0]
    const dayOfWeek = date.getDay()

    // 获取当天的已排班记录
    const daySchedules = existingSchedules.filter(
      (s) => s.scheduleDate.toISOString().split('T')[0] === dateStr
    )

    for (const employee of employees) {
      // 7.1 检查是否已有排班
      const existingSchedule = daySchedules.find((s) => s.employeeId === employee.id)
      if (existingSchedule) continue

      // 7.2 检查请假冲突
      const leaveConflict = leaves.find(
        (l) =>
          l.employeeId === employee.id &&
          new Date(l.startDate) <= date &&
          new Date(l.endDate) >= date
      )
      if (leaveConflict) {
        warnings.push({
          date: dateStr,
          employeeId: employee.id,
          employeeName: employee.user.realName,
          type: 'hard',
          message: `员工请假中：${(leaveConflict as any).leaveType || '请假'}`,
        })
        continue
      }

      // 7.3 检查偏好避开日期
      const pref = prefMap.get(employee.id)
      if (pref?.avoidDates) {
        const avoidDateList = pref.avoidDates.split(',').map((d) => d.trim())
        if (avoidDateList.includes(dateStr)) {
          warnings.push({
            date: dateStr,
            employeeId: employee.id,
            employeeName: employee.user.realName,
            type: 'soft',
            message: '该日期在员工偏好避开日期列表中',
          })
        }
      }

      // 7.4 检查偏好工作日
      const preferredDays = pref?.preferredDays?.split(',').map(Number) || []
      const avoidDaysList = pref?.avoidDays?.split(',').map(Number) || []
      const prefersRest = avoidDaysList.includes(dayOfWeek)

      // 7.5 计算历史班次统计（用于公平性）
      const employeeHistory = existingSchedules.filter((s) => s.employeeId === employee.id)
      const shiftCountMap = new Map<number, number>()
      for (const s of employeeHistory) {
        shiftCountMap.set(s.shiftId, (shiftCountMap.get(s.shiftId) || 0) + 1)
      }

      // 7.6 为员工选择最优班次
      let bestShift = shifts[0]
      let bestScore = -1
      const conflicts: string[] = []

      for (const shift of shifts) {
        let score = 100

        // 硬约束检查
        const prevDay = new Date(date)
        prevDay.setDate(prevDay.getDate() - 1)
        const prevSchedule = existingSchedules.find(
          (s) =>
            s.employeeId === employee.id &&
            s.scheduleDate.toISOString().split('T')[0] === prevDay.toISOString().split('T')[0]
        )

        if (prevSchedule) {
          const restHours = getRestHours(prevSchedule.shift.endTime, shift.startTime)
          if (rule.minRestHoursBetween && restHours < rule.minRestHoursBetween) {
            conflicts.push(`休息间隔不足（${restHours.toFixed(1)}小时 < ${rule.minRestHoursBetween}小时）`)
            score -= 50
          }
        }

        // 检查连班天数
        let consecutiveDays = 0
        for (let i = 1; i <= (rule.maxConsecutiveDays || 6); i++) {
          const checkDate = new Date(date)
          checkDate.setDate(checkDate.getDate() - i)
          const found = existingSchedules.find(
            (s) =>
              s.employeeId === employee.id &&
              s.scheduleDate.toISOString().split('T')[0] === checkDate.toISOString().split('T')[0]
          )
          if (found) consecutiveDays++
          else break
        }
        if (rule.maxConsecutiveDays && consecutiveDays >= rule.maxConsecutiveDays) {
          conflicts.push(`已达最大连班天数（${consecutiveDays}天）`)
          score -= 30
        }

        // 夜班限制
        if (rule.maxNightShiftsPerWeek && isNightShift(shift)) {
          const weekStart = new Date(date)
          weekStart.setDate(weekStart.getDate() - dayOfWeek)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 6)
          const weekNightShifts = existingSchedules.filter(
            (s) =>
              s.employeeId === employee.id &&
              s.scheduleDate >= weekStart &&
              s.scheduleDate <= weekEnd &&
              isNightShift(s.shift)
          ).length
          if (weekNightShifts >= rule.maxNightShiftsPerWeek) {
            conflicts.push('周夜班数量已达上限')
            score -= 20
          }
        }

        // 偏好匹配
        if (rule.preferenceEnabled && pref) {
          if (pref.preferredShiftId === shift.id) {
            score += 30
          }
          if (preferredDays.includes(dayOfWeek)) {
            score += 10
          }
          if (prefersRest) {
            score -= 20
          }
        }

        // 公平性权重
        if (rule.fairnessWeight) {
          const shiftUsage = shiftCountMap.get(shift.id) || 0
          score -= shiftUsage * (rule.fairnessWeight / 10)
        }

        if (score > bestScore) {
          bestScore = score
          bestShift = shift
        }
      }

      // 添加推荐
      recommendations.push({
        employeeId: employee.id,
        employeeNo: employee.employeeNo,
        realName: employee.user.realName,
        scheduleDate: dateStr,
        shiftId: bestShift.id,
        shiftName: bestShift.name,
        shiftColor: bestShift.color || undefined,
        confidence: Math.max(0, Math.min(100, bestScore)) / 100,
        conflicts,
      })

      // 更新已分配记录
      existingSchedules.push({
        id: 0,
        userId: employee.userId,
        employeeId: employee.id,
        shiftId: bestShift.id,
        scheduleDate: date,
        status: 'normal',
        note: null,
        source: 'auto',
        ruleId: rule.id || null,
        confidence: new Decimal(bestScore / 100),
        conflictWarnings: conflicts.length > 0 ? JSON.stringify(conflicts) : null,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        shift: bestShift,
      })
    }
  }

  // 8. 汇总统计
  const statistics: ScheduleStatistics = {
    total: recommendations.length,
    byShift: {},
    byEmployee: {},
  }
  for (const r of recommendations) {
    statistics.byShift[r.shiftName] = (statistics.byShift[r.shiftName] || 0) + 1
    statistics.byEmployee[r.realName] = (statistics.byEmployee[r.realName] || 0) + 1
  }

  return { recommendations, warnings, statistics }
}

// 应用推荐方案
export async function applyRecommendations(
  recommendations: ScheduleRecommendation[],
  userId: number
): Promise<{ successCount: number; failedCount: number }> {
  let successCount = 0
  let failedCount = 0

  for (const rec of recommendations) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: rec.employeeId },
        select: { userId: true },
      })

      if (!employee) {
        failedCount++
        continue
      }

      await prisma.schedule.upsert({
        where: {
          userId_scheduleDate: {
            userId: employee.userId,
            scheduleDate: new Date(rec.scheduleDate),
          },
        },
        create: {
          userId: employee.userId,
          employeeId: rec.employeeId,
          shiftId: rec.shiftId,
          scheduleDate: new Date(rec.scheduleDate),
          source: 'auto',
          confidence: new Decimal(rec.confidence),
          conflictWarnings: rec.conflicts.length > 0 ? JSON.stringify(rec.conflicts) : null,
          createdBy: userId,
        },
        update: {
          shiftId: rec.shiftId,
          source: 'auto',
          confidence: new Decimal(rec.confidence),
          conflictWarnings: rec.conflicts.length > 0 ? JSON.stringify(rec.conflicts) : null,
        },
      })
      successCount++
    } catch {
      failedCount++
    }
  }

  return { successCount, failedCount }
}
