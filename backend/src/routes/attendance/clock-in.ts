import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { enqueueNotification } from '../../plugins/notification'
import { validateData } from '../../utils/validation'
import { calculateDailyAttendance } from '../../services/attendanceCalculation'

const clockInSchema = z.object({
  location: z.string().trim().max(100).optional(),
  type: z.enum(['in', 'out']),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  source: z.string().trim().max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  deviceId: z.string().trim().max(100).optional(),
  photoUrl: z.string().trim().url().max(500).optional(),
  isFieldWork: z.coerce.boolean().optional(),
  fieldWorkReason: z.string().trim().max(500).optional(),
  shiftId: z.coerce.number().int().positive().optional(),
})

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

async function verifyLocation(latitude?: number, longitude?: number): Promise<{
  valid: boolean
  location?: any
  distance?: number
}> {
  if (!latitude || !longitude) {
    return { valid: false }
  }

  const activeLocations = await prisma.attendanceLocation.findMany({
    where: { status: 'active' },
  })

  for (const loc of activeLocations) {
    if (loc.type === 'gps' || loc.type === 'both') {
      if (loc.latitude && loc.longitude) {
        const distance = haversineDistance(
          latitude,
          longitude,
          Number(loc.latitude),
          Number(loc.longitude)
        )
        if (distance <= loc.radiusMeters) {
          return { valid: true, location: loc, distance }
        }
      }
    }
  }

  return { valid: false }
}

export default async function clockInRoutes(fastify: FastifyInstance) {
  fastify.post('/clock-in', async (request: FastifyRequest<{
    Body: {
      location?: string
      type: 'in' | 'out'
      latitude?: number
      longitude?: number
      source?: string
      deviceId?: string
      photoUrl?: string
      isFieldWork?: boolean
      fieldWorkReason?: string
      shiftId?: number
    }
  }>) => {
    const userId = request.user.id
    const { location, type, latitude, longitude, source, deviceId, photoUrl, isFieldWork, fieldWorkReason, shiftId } = validateData(clockInSchema, request.body)

    const employee = await prisma.employee.findUnique({
      where: { userId },
      include: { user: true },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const schedule = await prisma.schedule.findFirst({
      where: { employeeId: employee.id, scheduleDate: today },
      include: { shift: true },
    })

    let shift = schedule?.shift
    let isManualShift = false

    if (shiftId) {
      const manualShift = await prisma.shift.findUnique({
        where: { id: shiftId, status: 'active' },
      })
      if (!manualShift) {
        return { code: 400, message: '所选班次不存在或已停用' }
      }
      shift = manualShift
      isManualShift = true
    }

    if (!shift) {
      return { code: 400, message: '请先选择班次再打卡' }
    }

    const todayCheckins = await prisma.attendanceCheckin.findMany({
      where: {
        employeeId: employee.id,
        checkTime: {
          gte: today,
          lt: new Date(today.getTime() + 86400000),
        },
        verified: true,
      },
      orderBy: { checkTime: 'asc' },
    })

    const inCheckins = todayCheckins.filter((c) => c.logType === 'in')
    const outCheckins = todayCheckins.filter((c) => c.logType === 'out')

    if (type === 'in' && inCheckins.length > 0) {
      return { code: 400, message: '今天已打过上班卡，每人每天只能打一次上班卡' }
    }

    const locationResult = await verifyLocation(latitude, longitude)

    const now = new Date()
    let verified = true
    let finalSource = source || 'web'
    let rawPayload: any = {
      latitude,
      longitude,
      location,
    }

    if (!locationResult.valid && isFieldWork) {
      verified = false
      finalSource = 'field_work'
      rawPayload = {
        ...rawPayload,
        fieldWorkReason,
        fieldWorkStatus: 'pending',
      }
    } else if (!locationResult.valid && !isFieldWork) {
      return { code: 400, message: '不在有效打卡范围内，请开启定位或联系管理员' }
    }

    setAudit(request, {
      action: type === 'in' ? 'clock_in' : 'clock_out',
      module: 'attendance',
      requestData: { type, source: finalSource, deviceId, location, isFieldWork, fieldWorkReason, shiftId, isManualShift },
    })

    const checkin = await prisma.attendanceCheckin.create({
      data: {
        userId,
        employeeId: employee.id,
        shiftId: shift.id,
        source: finalSource,
        deviceId,
        logType: type,
        checkTime: now,
        latitude,
        longitude,
        address: location || locationResult.location?.address || undefined,
        photoUrl,
        ipAddress: request.ip,
        rawPayload,
        verified,
      },
    })

    if (verified) {
      await calculateDailyAttendance(employee.id, today, userId, shift.id)
    }

    const daily = await prisma.attendanceDaily.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    })

    const statusText = isFieldWork ? '外勤打卡申请已提交' : type === 'in' ? '上班打卡成功' : '下班打卡成功'

    if (verified) {
      enqueueNotification(request, {
        userId,
        title: statusText,
        content: `${type === 'in' ? '上班' : '下班'}打卡时间：${now.toLocaleTimeString('zh-CN')}${daily?.status === 'late' ? '（迟到）' : daily?.status === 'early' ? '（早退）' : ''}`,
        type: 'system',
        relatedId: checkin.id,
        relatedType: 'attendance',
      })
    } else {
      enqueueNotification(request, {
        userId,
        title: '外勤打卡申请已提交',
        content: `外勤事由：${fieldWorkReason || '未填写'}，请等待审批`,
        type: 'system',
        relatedId: checkin.id,
        relatedType: 'attendance',
      })
    }

    return {
      code: 0,
      message: statusText,
      data: {
        checkin,
        daily,
        isFieldWork: !verified,
        locationValid: locationResult.valid,
      },
    }
  })

  fastify.get('/clock-in/today', async (request: FastifyRequest) => {
    const userId = request.user.id

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [schedule, daily, checkins] = await Promise.all([
      prisma.schedule.findFirst({
        where: { employeeId: employee.id, scheduleDate: today },
        include: { shift: true },
      }),
      prisma.attendanceDaily.findUnique({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
        include: { shift: true },
      }),
      prisma.attendanceCheckin.findMany({
        where: {
          employeeId: employee.id,
          checkTime: {
            gte: today,
            lt: new Date(today.getTime() + 86400000),
          },
        },
        include: { shift: true },
        orderBy: { checkTime: 'asc' },
      }),
    ])

    const inCheckins = checkins.filter((c) => c.logType === 'in' && c.verified)
    const outCheckins = checkins.filter((c) => c.logType === 'out' && c.verified)
    const fieldWorkCheckins = checkins.filter((c) => c.source === 'field_work')

    const firstIn = inCheckins[0]?.checkTime || null
    const lastOut = outCheckins.length > 0 ? outCheckins[outCheckins.length - 1].checkTime : null

    const now = new Date()
    let canCheckIn = inCheckins.length === 0
    let canCheckOut = inCheckins.length > 0

    let status = 'not_scheduled'
    let scheduleInfo: any = null

    if (schedule?.shift) {
      const s = schedule.shift
      scheduleInfo = {
        id: s.id,
        shiftName: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        lateGraceMinutes: s.lateGraceMinutes,
        earlyGraceMinutes: s.earlyGraceMinutes,
        isManual: false,
      }
    } else if (daily?.shift) {
      const s = daily.shift
      scheduleInfo = {
        id: s.id,
        shiftName: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        lateGraceMinutes: s.lateGraceMinutes,
        earlyGraceMinutes: s.earlyGraceMinutes,
        isManual: true,
      }
    } else if (checkins[0]?.shift) {
      const s = checkins[0].shift
      scheduleInfo = {
        id: s.id,
        shiftName: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        lateGraceMinutes: s.lateGraceMinutes,
        earlyGraceMinutes: s.earlyGraceMinutes,
        isManual: true,
      }
    }

    if (scheduleInfo) {
      if (!firstIn && !lastOut) {
        status = 'not_checked_in'
      } else if (firstIn && !lastOut) {
        status = 'working'
      } else if (firstIn && lastOut) {
        status = 'checked_out'
      }
    }

    return {
      code: 0,
      data: {
        date: today,
        schedule: scheduleInfo,
        daily: daily ? {
          status: daily.status,
          workMinutes: daily.workMinutes,
          lateMinutes: daily.lateMinutes,
          earlyMinutes: daily.earlyMinutes,
          absentMinutes: daily.absentMinutes,
        } : null,
        checkins: checkins.map((c) => ({
          id: c.id,
          type: c.logType,
          time: c.checkTime,
          source: c.source,
          verified: c.verified,
          address: c.address,
          latitude: c.latitude,
          longitude: c.longitude,
          shiftId: c.shiftId,
          shiftName: c.shift?.name,
        })),
        firstIn,
        lastOut,
        canCheckIn,
        canCheckOut,
        status,
        fieldWorkPending: fieldWorkCheckins.some((c) => !c.verified),
      },
    }
  })

  fastify.get('/clock-in/monthly-stats', async (request: FastifyRequest<{
    Querystring: { year?: string; month?: string }
  }>) => {
    const userId = request.user.id
    const { year, month } = request.query

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const now = new Date()
    const targetYear = year ? parseInt(year) : now.getFullYear()
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1

    const monthly = await prisma.attendanceMonthly.findUnique({
      where: { employeeId_year_month: { employeeId: employee.id, year: targetYear, month: targetMonth } },
    })

    const monthStart = new Date(targetYear, targetMonth - 1, 1)
    const monthEnd = new Date(targetYear, targetMonth, 0)

    const dailyRecords = await prisma.attendanceDaily.findMany({
      where: {
        employeeId: employee.id,
        date: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { date: 'asc' },
    })

    const calendarData = dailyRecords.map((d) => ({
      date: d.date,
      status: d.status,
      firstIn: d.firstIn,
      lastOut: d.lastOut,
      workMinutes: d.workMinutes,
      lateMinutes: d.lateMinutes,
      earlyMinutes: d.earlyMinutes,
    }))

    return {
      code: 0,
      data: {
        year: targetYear,
        month: targetMonth,
        summary: monthly ? {
          expectedWorkDays: monthly.expectedWorkDays,
          actualWorkDays: monthly.actualWorkDays,
          paidLeaveDays: monthly.paidLeaveDays,
          absentDays: monthly.absentDays,
          lateCount: monthly.lateCount,
          earlyCount: monthly.earlyCount,
          missingCheckinCount: monthly.missingCheckinCount,
          overtimeMinutes: monthly.overtimeMinutes,
          status: monthly.status,
        } : {
          expectedWorkDays: 0,
          actualWorkDays: 0,
          paidLeaveDays: 0,
          absentDays: 0,
          lateCount: 0,
          earlyCount: 0,
          missingCheckinCount: 0,
          overtimeMinutes: 0,
          status: 'draft',
        },
        calendar: calendarData,
      },
    }
  })

  fastify.get('/clock-in/calendar', async (request: FastifyRequest<{
    Querystring: { year?: string; month?: string }
  }>) => {
    const userId = request.user.id
    const { year, month } = request.query

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const now = new Date()
    const targetYear = year ? parseInt(year) : now.getFullYear()
    const targetMonth = month ? parseInt(month) : now.getMonth() + 1

    const monthStart = new Date(targetYear, targetMonth - 1, 1)
    const monthEnd = new Date(targetYear, targetMonth, 0)

    const [schedules, dailyRecords, exceptions] = await Promise.all([
      prisma.schedule.findMany({
        where: {
          employeeId: employee.id,
          scheduleDate: { gte: monthStart, lte: monthEnd },
        },
        include: { shift: true },
      }),
      prisma.attendanceDaily.findMany({
        where: {
          employeeId: employee.id,
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.attendanceException.findMany({
        where: {
          employeeId: employee.id,
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
    ])

    const scheduleMap = new Map(schedules.map((s) => [s.scheduleDate.toISOString().split('T')[0], s]))
    const dailyMap = new Map(dailyRecords.map((d) => [d.date.toISOString().split('T')[0], d]))
    const exceptionMap = new Map<string, any[]>()
    for (const e of exceptions) {
      const key = e.date.toISOString().split('T')[0]
      if (!exceptionMap.has(key)) exceptionMap.set(key, [])
      exceptionMap.get(key)!.push(e)
    }

    const daysInMonth = monthEnd.getDate()
    const calendar = []

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(targetYear, targetMonth - 1, i)
      const dateStr = date.toISOString().split('T')[0]
      const schedule = scheduleMap.get(dateStr)
      const daily = dailyMap.get(dateStr)
      const dayExceptions = exceptionMap.get(dateStr) || []

      calendar.push({
        date: dateStr,
        weekday: date.getDay(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        schedule: schedule ? {
          shiftName: schedule.shift.name,
          startTime: schedule.shift.startTime,
          endTime: schedule.shift.endTime,
        } : null,
        attendance: daily ? {
          status: daily.status,
          firstIn: daily.firstIn,
          lastOut: daily.lastOut,
          workMinutes: daily.workMinutes,
          lateMinutes: daily.lateMinutes,
          earlyMinutes: daily.earlyMinutes,
          absentMinutes: daily.absentMinutes,
        } : null,
        exceptions: dayExceptions.map((e) => ({
          type: e.type,
          status: e.status,
          reason: e.reason,
        })),
      })
    }

    return {
      code: 0,
      data: {
        year: targetYear,
        month: targetMonth,
        days: calendar,
      },
    }
  })

  fastify.get('/clock-in/shifts', async (request: FastifyRequest) => {
    const userId = request.user.id

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const shifts = await prisma.shift.findMany({
      where: {
        status: 'active',
        OR: [
          { departmentId: employee.departmentId },
          { departmentId: null },
        ],
      },
      orderBy: [
        { sortOrder: 'asc' },
        { startTime: 'asc' },
      ],
    })

    return {
      code: 0,
      data: shifts.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        startTime: s.startTime,
        endTime: s.endTime,
        workHours: s.workHours,
        lateGraceMinutes: s.lateGraceMinutes,
        earlyGraceMinutes: s.earlyGraceMinutes,
        color: s.color,
        description: s.description,
      })),
    }
  })
}
