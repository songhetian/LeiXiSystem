import prisma from '../prisma'
import { processDailyExceptions } from './exceptionRuleEngine'

type CalculateMonthlyInput = {
  year: number
  month: number
  employeeId?: number
  operatorId?: number
  lock?: boolean
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function endOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 0)
  return { start: startOfDay(start), end: endOfDay(end) }
}

function getDatesBetween(start: Date, end: Date) {
  const dates: Date[] = []
  const cursor = startOfDay(start)
  const last = startOfDay(end)

  while (cursor <= last) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function parseShiftDateTime(date: Date, time: string) {
  const [hour = '0', minute = '0'] = time.split(':')
  const value = startOfDay(date)
  value.setHours(Number(hour), Number(minute), 0, 0)
  return value
}

function minutesBetween(start?: Date | null, end?: Date | null) {
  if (!start || !end) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function addMinutes(date: Date, minutes: number) {
  const value = new Date(date)
  value.setMinutes(value.getMinutes() + minutes)
  return value
}

async function ensureAttendanceException(input: {
  employeeId: number
  date: Date
  type: string
  relatedIds: number[]
  reason: string
}) {
  const existing = await prisma.attendanceException.findFirst({
    where: {
      employeeId: input.employeeId,
      date: input.date,
      type: input.type,
      status: { in: ['pending', 'approved'] },
    },
  })

  if (existing) return existing

  return prisma.attendanceException.create({
    data: {
      employeeId: input.employeeId,
      date: input.date,
      type: input.type,
      status: 'pending',
      relatedIds: input.relatedIds as any,
      reason: input.reason,
    },
  })
}

export async function calculateDailyAttendance(employeeId: number, date: Date, operatorId?: number) {
  const day = startOfDay(date)
  const nextDay = new Date(day)
  nextDay.setDate(day.getDate() + 1)

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  })

  if (!employee) {
    throw new Error('员工不存在')
  }

  const schedule = await prisma.schedule.findFirst({
    where: { employeeId, scheduleDate: day },
    include: { shift: true },
  })

  const fallbackShift = schedule?.shift || await prisma.shift.findFirst({
    where: { status: 'active' },
    orderBy: { sortOrder: 'asc' },
  })

  const windowStart = fallbackShift
    ? addMinutes(parseShiftDateTime(day, fallbackShift.startTime), -fallbackShift.beginCheckinMinutes)
    : day
  const windowEnd = fallbackShift
    ? addMinutes(parseShiftDateTime(day, fallbackShift.endTime), fallbackShift.allowCheckoutMinutes)
    : nextDay

  if (fallbackShift && (fallbackShift.isCrossDay || windowEnd <= windowStart)) {
    windowEnd.setDate(windowEnd.getDate() + 1)
  }

  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      status: 'approved',
      startDate: { lte: day },
      endDate: { gte: day },
    },
  })

  const checkins = await prisma.attendanceCheckin.findMany({
    where: {
      employeeId,
      checkTime: {
        gte: windowStart,
        lt: windowEnd,
      },
    },
    orderBy: { checkTime: 'asc' },
  })

  const firstIn = checkins[0]?.checkTime || null
  const lastOut = checkins.length > 1 ? checkins[checkins.length - 1].checkTime : null
  const approvedOvertime = await prisma.overtimeRequest.findFirst({
    where: {
      employeeId,
      status: 'approved',
      date: day,
    },
  })

  let status = 'normal'
  let lateMinutes = 0
  let earlyMinutes = 0
  let absentMinutes = 0

  if (approvedLeave) {
    status = 'leave'
  } else if (!fallbackShift) {
    status = 'rest'
  } else if (!firstIn && !lastOut) {
    status = 'absent'
    absentMinutes = Math.round(Number(fallbackShift.workHours) * 60)
  } else {
    const shiftStart = parseShiftDateTime(day, fallbackShift.startTime)
    const shiftEnd = parseShiftDateTime(day, fallbackShift.endTime)
    if (fallbackShift.isCrossDay || shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1)
    }

    const rawLateMinutes = firstIn && firstIn > shiftStart ? minutesBetween(shiftStart, firstIn) : 0
    const rawEarlyMinutes = lastOut && lastOut < shiftEnd ? minutesBetween(lastOut, shiftEnd) : 0
    lateMinutes = rawLateMinutes > fallbackShift.lateGraceMinutes ? rawLateMinutes : 0
    earlyMinutes = rawEarlyMinutes > fallbackShift.earlyGraceMinutes ? rawEarlyMinutes : 0

    if (!firstIn || !lastOut) {
      status = 'exception'
    } else if (lateMinutes > 0 && earlyMinutes > 0) {
      status = 'late_early'
    } else if (lateMinutes > 0) {
      status = 'late'
    } else if (earlyMinutes > 0) {
      status = 'early'
    }
  }

  const workMinutes = minutesBetween(firstIn, lastOut)
  const overtimeMinutes = approvedOvertime ? Math.round(Number(approvedOvertime.hours) * 60) : 0

  const daily = await prisma.attendanceDaily.upsert({
    where: { employeeId_date: { employeeId, date: day } },
    update: {
      userId: employee.userId,
      shiftId: fallbackShift?.id,
      status,
      firstIn,
      lastOut,
      workMinutes,
      lateMinutes,
      earlyMinutes,
      absentMinutes,
      overtimeMinutes,
      checkinSnapshot: checkins as any,
      ruleSnapshot: fallbackShift ? {
        shiftId: fallbackShift.id,
        startTime: fallbackShift.startTime,
        endTime: fallbackShift.endTime,
        workHours: fallbackShift.workHours,
        isCrossDay: fallbackShift.isCrossDay,
        beginCheckinMinutes: fallbackShift.beginCheckinMinutes,
        allowCheckoutMinutes: fallbackShift.allowCheckoutMinutes,
        lateGraceMinutes: fallbackShift.lateGraceMinutes,
        earlyGraceMinutes: fallbackShift.earlyGraceMinutes,
      } as any : undefined,
      calculationVersion: 'v2',
    },
    create: {
      userId: employee.userId,
      employeeId,
      date: day,
      shiftId: fallbackShift?.id,
      status,
      firstIn,
      lastOut,
      workMinutes,
      lateMinutes,
      earlyMinutes,
      absentMinutes,
      overtimeMinutes,
      checkinSnapshot: checkins as any,
      ruleSnapshot: fallbackShift ? {
        shiftId: fallbackShift.id,
        startTime: fallbackShift.startTime,
        endTime: fallbackShift.endTime,
        workHours: fallbackShift.workHours,
        isCrossDay: fallbackShift.isCrossDay,
        beginCheckinMinutes: fallbackShift.beginCheckinMinutes,
        allowCheckoutMinutes: fallbackShift.allowCheckoutMinutes,
        lateGraceMinutes: fallbackShift.lateGraceMinutes,
        earlyGraceMinutes: fallbackShift.earlyGraceMinutes,
      } as any : undefined,
      calculationVersion: 'v2',
    },
  })

  if (status === 'exception' || status === 'absent') {
    await ensureAttendanceException({
      employeeId,
      date: day,
      type: status === 'absent' ? 'absent' : 'missing_checkin',
      relatedIds: checkins.map((item) => item.id),
      reason: status === 'absent' ? '无有效打卡记录' : '缺少上班或下班打卡',
    })
  }

  // 应用异常规则引擎（针对迟到、早退、旷工）
  const currentLate = lateMinutes
  const currentEarly = earlyMinutes
  const currentAbsent = absentMinutes
  if (currentLate > 0 || currentEarly > 0 || currentAbsent > 0) {
    await processDailyExceptions(employeeId, day, {
      lateMinutes: currentLate,
      earlyMinutes: currentEarly,
      absentMinutes: currentAbsent,
    })
  }

  return daily
}

export async function calculateMonthlyAttendance(input: CalculateMonthlyInput) {
  const { year, month, employeeId, operatorId, lock } = input
  const { start, end } = getMonthRange(year, month)
  const dates = getDatesBetween(start, end)

  const employees = await prisma.employee.findMany({
    where: employeeId ? { id: employeeId, status: 'active' } : { status: 'active' },
    include: { user: true },
  })

  const result = []

  for (const employee of employees) {
    for (const date of dates) {
      await calculateDailyAttendance(employee.id, date, operatorId)
    }

    const dailyRecords = await prisma.attendanceDaily.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: start, lte: end },
      },
    })

    const expectedWorkDays = dailyRecords.filter((item) => item.status !== 'rest').length
    const actualWorkDays = dailyRecords.filter((item) => ['normal', 'late', 'early', 'late_early'].includes(item.status)).length
    const paidLeaveDays = dailyRecords.filter((item) => item.status === 'leave').length
    const absentDays = dailyRecords.filter((item) => item.status === 'absent').length
    const missingCheckinCount = dailyRecords.filter((item) => item.status === 'exception').length
    const lateCount = dailyRecords.filter((item) => ['late', 'late_early'].includes(item.status)).length
    const earlyCount = dailyRecords.filter((item) => ['early', 'late_early'].includes(item.status)).length
    const overtimeMinutes = dailyRecords.reduce((sum, item) => sum + item.overtimeMinutes, 0)

    const monthly = await prisma.attendanceMonthly.upsert({
      where: { employeeId_year_month: { employeeId: employee.id, year, month } },
      update: {
        userId: employee.userId,
        expectedWorkDays,
        actualWorkDays,
        paidLeaveDays,
        unpaidLeaveDays: 0,
        absentDays,
        lateCount,
        earlyCount,
        missingCheckinCount,
        overtimeMinutes,
        status: lock ? 'locked' : 'calculated',
        lockedAt: lock ? new Date() : undefined,
        lockedBy: lock ? operatorId : undefined,
      },
      create: {
        userId: employee.userId,
        employeeId: employee.id,
        year,
        month,
        expectedWorkDays,
        actualWorkDays,
        paidLeaveDays,
        unpaidLeaveDays: 0,
        absentDays,
        lateCount,
        earlyCount,
        missingCheckinCount,
        overtimeMinutes,
        status: lock ? 'locked' : 'calculated',
        lockedAt: lock ? new Date() : undefined,
        lockedBy: lock ? operatorId : undefined,
      },
    })

    result.push(monthly)
  }

  return result
}

export async function recalculateAttendanceRange(input: {
  employeeId: number
  startDate: Date
  endDate: Date
  operatorId?: number
}) {
  const dates = getDatesBetween(input.startDate, input.endDate)
  for (const date of dates) {
    await calculateDailyAttendance(input.employeeId, date, input.operatorId)
  }

  const touchedMonths = new Set(dates.map((date) => `${date.getFullYear()}-${date.getMonth() + 1}`))
  for (const key of touchedMonths) {
    const [year, month] = key.split('-').map(Number)
    await calculateMonthlyAttendance({
      year,
      month,
      employeeId: input.employeeId,
      operatorId: input.operatorId,
    })
  }
}
