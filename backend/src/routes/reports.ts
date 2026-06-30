import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../services/dataScope'
import { getJSON, setJSON, isAvailable } from '../utils/cache'
import * as crypto from 'crypto'

const reportQuerySchema = z.object({
  type: z.enum(['employee', 'department', 'monthly', 'yearly']).default('monthly'),
  employeeId: z.coerce.number().int().positive().optional(),
  departmentIds: z.string().optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  keyword: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

function parseDepartmentIds(departmentIds?: string): number[] {
  if (!departmentIds) return []
  try {
    const parsed = JSON.parse(departmentIds)
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter(n => !isNaN(n))
    }
  } catch {
    // ignore
  }
  return []
}

function buildDepartmentWhere(departmentIds: number[], path: string) {
  if (departmentIds.length === 0) return {}
  return {
    [path]: {
      departmentId: { in: departmentIds },
    },
  }
}

function getReportCacheKey(reportName: string, params: Record<string, any>): string {
  const sorted = Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key]
    return acc
  }, {} as Record<string, any>)
  const hash = crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex')
  return `report:${reportName}:${hash}`
}

const REPORT_CACHE_TTL = 10 * 60

async function getCachedReport(reportName: string, cacheParams: Record<string, any>, fetcher: () => Promise<any>): Promise<any> {
  if (!isAvailable()) {
    return fetcher()
  }

  const cacheKey = getReportCacheKey(reportName, cacheParams)
  const cached = await getJSON<any>(cacheKey)
  if (cached) {
    return cached
  }

  const result = await fetcher()
  setJSON(cacheKey, result, REPORT_CACHE_TTL).catch(() => {})
  return result
}

export default async function scheduleReportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // ============================================================
  // 排班统计报表
  // ============================================================
  fastify.get('/schedule', { preHandler: [requirePermission('schedule:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = reportQuerySchema.parse(request.query)
    const now = new Date()
    const currentYear = query.year || now.getFullYear()
    const currentMonth = query.month || now.getMonth() + 1
    const departmentIds = parseDepartmentIds(query.departmentIds)

    let startDate: Date
    let endDate: Date

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else if (query.type === 'yearly') {
      startDate = new Date(currentYear, 0, 1)
      endDate = new Date(currentYear, 11, 31)
    } else {
      startDate = new Date(currentYear, currentMonth - 1, 1)
      endDate = new Date(currentYear, currentMonth, 0)
    }

    const scheduleWhere: any = {
      scheduleDate: { gte: startDate, lte: endDate },
    }
    if (query.employeeId) {
      scheduleWhere.employeeId = query.employeeId
    }
    if (departmentIds.length > 0) {
      scheduleWhere.employee = { user: { departmentId: { in: departmentIds } } }
    }
    if (query.keyword) {
      scheduleWhere.employee = {
        ...scheduleWhere.employee,
        user: {
          ...scheduleWhere.employee?.user,
          realName: { contains: query.keyword },
        },
      }
    }

    const schedules = await prisma.schedule.findMany({
      where: scheduleWhere,
      include: {
        shift: true,
        employee: {
          select: {
            id: true,
            employeeNo: true,
            userId: true,
            user: { select: { id: true, realName: true, departmentId: true, department: { select: { id: true, name: true } } } },
          },
        },
      },
    })

    const shifts = await prisma.shift.findMany()
    const shiftMap = new Map(shifts.map(s => [s.id, { name: s.name, color: s.color }]))

    // 员工统计
    const employeeStats = schedules.reduce((acc: any, s) => {
      const empId = s.employeeId
      if (!acc[empId]) {
        acc[empId] = {
          employeeId: empId,
          employeeNo: s.employee?.employeeNo,
          employeeName: s.employee?.user?.realName,
          departmentName: s.employee?.user?.department?.name,
          departmentId: s.employee?.user?.departmentId,
          totalDays: 0,
          shifts: {} as Record<number, number>,
          totalHours: 0,
        }
      }
      acc[empId].totalDays++
      const shiftId = s.shiftId
      acc[empId].shifts[shiftId] = (acc[empId].shifts[shiftId] || 0) + 1
      if (s.shift.startTime && s.shift.endTime) {
        const startParts = s.shift.startTime.split(':')
        const endParts = s.shift.endTime.split(':')
        const startHour = parseInt(startParts[0]) + parseInt(startParts[1]) / 60
        const endHour = parseInt(endParts[0]) + parseInt(endParts[1]) / 60
        let hours = endHour - startHour
        if (hours < 0) hours += 24
        acc[empId].totalHours += hours
      }
      return acc
    }, {})

    const employeeList = Object.values(employeeStats).map((emp: any) => ({
      ...emp,
      shifts: Object.entries(emp.shifts).map(([id, count]) => ({
        shiftId: Number(id),
        shiftName: shiftMap.get(Number(id))?.name || `班次${id}`,
        count,
      })),
      totalHours: Math.round(emp.totalHours * 100) / 100,
    }))

    // 部门统计
    const deptStats = schedules.reduce((acc: any, s) => {
      const deptId = s.employee?.user?.departmentId || 0
      const deptName = s.employee?.user?.department?.name || '未知'
      if (!acc[deptId]) {
        acc[deptId] = {
          departmentId: deptId,
          departmentName: deptName,
          totalDays: 0,
          employeeCount: new Set<number>(),
          shifts: {} as Record<number, number>,
          totalHours: 0,
        }
      }
      acc[deptId].totalDays++
      acc[deptId].employeeCount.add(s.employeeId)
      acc[deptId].shifts[s.shiftId] = (acc[deptId].shifts[s.shiftId] || 0) + 1
      if (s.shift.startTime && s.shift.endTime) {
        const startParts = s.shift.startTime.split(':')
        const endParts = s.shift.endTime.split(':')
        const startHour = parseInt(startParts[0]) + parseInt(startParts[1]) / 60
        const endHour = parseInt(endParts[0]) + parseInt(endParts[1]) / 60
        let hours = endHour - startHour
        if (hours < 0) hours += 24
        acc[deptId].totalHours += hours
      }
      return acc
    }, {})

    const departmentList = Object.values(deptStats).map((dept: any) => ({
      ...dept,
      employeeCount: dept.employeeCount.size,
      avgDays: Math.round(dept.totalDays / dept.employeeCount.size * 100) / 100,
      totalHours: Math.round(dept.totalHours * 100) / 100,
      shifts: Object.entries(dept.shifts).map(([id, count]) => ({
        shiftId: Number(id),
        shiftName: shiftMap.get(Number(id))?.name || `班次${id}`,
        count,
      })),
    }))

    // 月度每日统计
    const dailyStats: any[] = []
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0]
      const daySchedules = schedules.filter(s =>
        s.scheduleDate.toISOString().split('T')[0] === dayStr
      )
      const shiftCounts: Record<number, number> = {}
      daySchedules.forEach(s => {
        shiftCounts[s.shiftId] = (shiftCounts[s.shiftId] || 0) + 1
      })
      dailyStats.push({
        date: dayStr,
        weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
        total: daySchedules.length,
        shiftCounts,
      })
    }

    // 月度汇总
    const monthlySummary = {
      totalDays: schedules.length,
      employeeCount: new Set(schedules.map(s => s.employeeId)).size,
      avgPerEmployee: schedules.length > 0
        ? Math.round(schedules.length / new Set(schedules.map(s => s.employeeId)).size * 100) / 100
        : 0,
      shiftSummary: Object.entries(schedules.reduce((acc: any, s) => {
        acc[s.shiftId] = (acc[s.shiftId] || 0) + 1
        return acc
      }, {})).map(([id, count]) => ({
        shiftId: Number(id),
        shiftName: shiftMap.get(Number(id))?.name || `班次${id}`,
        shiftColor: shiftMap.get(Number(id))?.color,
        count,
        percent: schedules.length > 0 ? Math.round(Number(count) / schedules.length * 100) : 0,
      })),
    }

    // 年度统计
    const monthlyData: any[] = []
    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(currentYear, m - 1, 1)
      const monthEnd = new Date(currentYear, m, 0)
      const monthSchedules = schedules.filter(s =>
        s.scheduleDate >= monthStart && s.scheduleDate <= monthEnd
      )
      monthlyData.push({
        month: m,
        monthName: `${m}月`,
        totalDays: monthSchedules.length,
        employeeCount: new Set(monthSchedules.map(s => s.employeeId)).size,
      })
    }

    const yearlySummary = {
      totalDays: schedules.length,
      employeeCount: new Set(schedules.map(s => s.employeeId)).size,
      avgPerMonth: Math.round(schedules.length / 12),
    }

    // 图表数据
    const chartData = {
      // 趋势折线图：每日排班人数趋势
      dailyTrend: dailyStats.map(d => ({
        date: d.date,
        total: d.total,
      })),
      // 部门对比柱状图
      departmentCompare: departmentList.map((d: any) => ({
        departmentName: d.departmentName,
        totalDays: d.totalDays,
        employeeCount: d.employeeCount,
      })),
      // 班次占比饼图
      shiftPie: monthlySummary.shiftSummary.map(s => ({
          name: s.shiftName,
          value: s.count,
        })),
      // 年度月度趋势
      yearlyTrend: monthlyData.map(m => ({
        month: m.monthName,
        totalDays: m.totalDays,
      })),
    }

    return {
      code: 0,
      data: {
        list: employeeList,
        departmentList,
        dailyStats,
        monthlySummary,
        monthlyData,
        yearlySummary,
        chartData,
        shiftMap: Object.fromEntries(shiftMap),
        startDate,
        endDate,
        year: currentYear,
        total: employeeList.length,
      },
    }
  })

  // ============================================================
  // 考勤统计报表
  // ============================================================
  fastify.get('/attendance', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = reportQuerySchema.parse(request.query)

    const cacheParams = { ...query, userId: request.user.id }
    const result = await getCachedReport('attendance', cacheParams, async () => {
    const now = new Date()
    const currentYear = query.year || now.getFullYear()
    const currentMonth = query.month || now.getMonth() + 1
    const departmentIds = parseDepartmentIds(query.departmentIds)

    let startDate: Date
    let endDate: Date

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else {
      startDate = new Date(currentYear, currentMonth - 1, 1)
      endDate = new Date(currentYear, currentMonth, 0)
    }

    const where: any = await buildAttendanceDataScopeWhere(request.user)
    where.date = { gte: startDate, lte: endDate }

    if (query.employeeId) {
      where.employeeId = query.employeeId
    }
    if (departmentIds.length > 0) {
      where.employee = { user: { departmentId: { in: departmentIds } } }
    }
    if (query.keyword) {
      where.employee = {
        ...where.employee,
        user: {
          ...where.employee?.user,
          realName: { contains: query.keyword },
        },
      }
    }
    if (query.status) {
      where.status = query.status
    }

    const dailyRecords = await prisma.attendanceDaily.findMany({
      where,
      include: {
        employee: {
          select: {
            employeeNo: true,
            user: {
              select: {
                realName: true,
                departmentId: true,
                department: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // 按员工统计
    const employeeStats = dailyRecords.reduce((acc: any, r) => {
      const empId = r.employeeId
      if (!acc[empId]) {
        acc[empId] = {
          employeeId: empId,
          employeeNo: r.employee?.employeeNo,
          employeeName: r.employee?.user?.realName,
          departmentName: r.employee?.user?.department?.name,
          departmentId: r.employee?.user?.departmentId,
          workDays: 0,
          normalDays: 0,
          lateDays: 0,
          earlyDays: 0,
          absentDays: 0,
          leaveDays: 0,
          overtimeHours: 0,
          totalHours: 0,
        }
      }
      acc[empId].workDays++
      if (r.status === 'normal') acc[empId].normalDays++
      if (r.lateMinutes > 0) acc[empId].lateDays++
      if (r.earlyMinutes > 0) acc[empId].earlyDays++
      if (r.status === 'absent') acc[empId].absentDays++
      if (r.status === 'leave') acc[empId].leaveDays++
      if (r.overtimeMinutes) acc[empId].overtimeHours += r.overtimeMinutes / 60
      if (r.workMinutes) acc[empId].totalHours += r.workMinutes / 60
      return acc
    }, {})

    const list = Object.values(employeeStats).map((emp: any) => ({
      ...emp,
      overtimeHours: Math.round(emp.overtimeHours * 100) / 100,
      totalHours: Math.round(emp.totalHours * 100) / 100,
      attendanceRate: emp.workDays > 0 ? Math.round((emp.normalDays / emp.workDays) * 100) : 0,
    }))

    // 分页
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const total = list.length
    const paginatedList = list.slice((page - 1) * pageSize, page * pageSize)

    // 按部门汇总
    const deptStats = list.reduce((acc: any, emp: any) => {
      const deptName = emp.departmentName || '未知'
      if (!acc[deptName]) {
        acc[deptName] = {
          departmentName: deptName,
          employeeCount: 0,
          totalWorkDays: 0,
          totalNormalDays: 0,
          totalLateDays: 0,
          totalEarlyDays: 0,
          totalAbsentDays: 0,
          totalLeaveDays: 0,
          totalOvertimeHours: 0,
        }
      }
      acc[deptName].employeeCount++
      acc[deptName].totalWorkDays += emp.workDays
      acc[deptName].totalNormalDays += emp.normalDays
      acc[deptName].totalLateDays += emp.lateDays
      acc[deptName].totalEarlyDays += emp.earlyDays
      acc[deptName].totalAbsentDays += emp.absentDays
      acc[deptName].totalLeaveDays += emp.leaveDays
      acc[deptName].totalOvertimeHours += emp.overtimeHours
      return acc
    }, {})

    const departmentSummary = Object.values(deptStats).map((dept: any) => ({
      ...dept,
      totalOvertimeHours: Math.round(dept.totalOvertimeHours * 100) / 100,
      avgAttendanceRate: dept.totalWorkDays > 0
        ? Math.round(dept.totalNormalDays / dept.totalWorkDays * 100)
        : 0,
    }))

    // 每日趋势数据（用于折线图）
    const dailyTrend: any[] = []
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0]
      const dayRecords = dailyRecords.filter(r => r.date.toISOString().split('T')[0] === dayStr)
      const normal = dayRecords.filter(r => r.status === 'normal').length
      const late = dayRecords.filter(r => r.lateMinutes > 0).length
      const early = dayRecords.filter(r => r.earlyMinutes > 0).length
      const absent = dayRecords.filter(r => r.status === 'absent').length
      dailyTrend.push({
        date: dayStr,
        total: dayRecords.length,
        normal,
        late,
        early,
        absent,
        attendanceRate: dayRecords.length > 0 ? Math.round(normal / dayRecords.length * 100) : 0,
      })
    }

    // 部门排名
    const departmentRanking = [...departmentSummary].sort((a: any, b: any) => b.avgAttendanceRate - a.avgAttendanceRate).reverse()

    // 图表数据
    const chartData = {
      dailyTrend,
      departmentCompare: departmentSummary.map((d: any) => ({
        departmentName: d.departmentName,
        avgAttendanceRate: d.avgAttendanceRate,
        totalWorkDays: d.totalWorkDays,
      })),
      statusPie: [
        { name: '正常', value: list.reduce((sum: number, e: any) => sum + e.normalDays, 0) },
        { name: '迟到', value: list.reduce((sum: number, e: any) => sum + e.lateDays, 0) },
        { name: '早退', value: list.reduce((sum: number, e: any) => sum + e.earlyDays, 0) },
        { name: '缺勤', value: list.reduce((sum: number, e: any) => sum + e.absentDays, 0) },
        { name: '请假', value: list.reduce((sum: number, e: any) => sum + e.leaveDays, 0) },
      ],
      departmentRanking: departmentRanking.map((d: any, i) => ({
        rank: i + 1,
        departmentName: d.departmentName,
        avgAttendanceRate: d.avgAttendanceRate,
      })),
    }

    return {
      code: 0,
      data: {
        list: paginatedList,
        departmentSummary,
        departmentRanking,
        chartData,
        startDate,
        endDate,
        total,
        totalEmployees: list.length,
        avgAttendanceRate: list.length > 0
          ? Math.round(list.reduce((sum: number, e: any) => sum + e.attendanceRate, 0) / list.length)
          : 0,
      },
    }
    })

    return result
  })

  // ============================================================
  // 加班请假统计报表
  // ============================================================
  fastify.get('/leave-overtime', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = reportQuerySchema.parse(request.query)
    const now = new Date()
    const currentYear = query.year || now.getFullYear()
    const currentMonth = query.month || now.getMonth() + 1
    const departmentIds = parseDepartmentIds(query.departmentIds)

    let startDate: Date
    let endDate: Date

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else {
      startDate = new Date(currentYear, currentMonth - 1, 1)
      endDate = new Date(currentYear, currentMonth, 0)
    }

    // 请假数据
    const leaveWhere: any = {
      startDate: { gte: startDate },
      endDate: { lte: endDate },
      status: 'approved',
    }
    if (query.employeeId) leaveWhere.employeeId = query.employeeId
    if (departmentIds.length > 0) leaveWhere.employee = { user: { departmentId: { in: departmentIds } } }
    if (query.keyword) leaveWhere.employee = {
      ...leaveWhere.employee,
      user: { ...leaveWhere.employee?.user, realName: { contains: query.keyword } },
    }

    const leaves = await prisma.leaveRequest.findMany({
      where: leaveWhere,
      include: {
        employee: { select: { employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
      },
    })

    // 加班数据
    const overtimeWhere: any = {
      date: { gte: startDate, lte: endDate },
      status: 'approved',
    }
    if (query.employeeId) overtimeWhere.employeeId = query.employeeId
    if (departmentIds.length > 0) overtimeWhere.employee = { user: { departmentId: { in: departmentIds } } }
    if (query.keyword) overtimeWhere.employee = {
      ...overtimeWhere.employee,
      user: { ...overtimeWhere.employee?.user, realName: { contains: query.keyword } },
    }

    const overtimes = await prisma.overtimeRequest.findMany({
      where: overtimeWhere,
      include: {
        employee: { select: { employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
      },
    })

    // 按员工统计
    const employeeMap: Record<number, any> = {}

    leaves.forEach(l => {
      const empId = l.employeeId
      if (!employeeMap[empId]) {
        employeeMap[empId] = {
          employeeId: empId,
          employeeNo: l.employee?.employeeNo,
          employeeName: l.employee?.user?.realName,
          departmentName: l.employee?.user?.department?.name,
          departmentId: l.employee?.user?.departmentId,
          leaveDays: 0,
          leaveTypes: {} as Record<string, number>,
          overtimeHours: 0,
          overtimeTypes: {} as Record<string, number>,
        }
      }
      employeeMap[empId].leaveDays += Number(l.days || 0)
      employeeMap[empId].leaveTypes[l.leaveType] = (employeeMap[empId].leaveTypes[l.leaveType] || 0) + Number(l.days || 0)
    })

    overtimes.forEach(o => {
      const empId = o.employeeId
      if (!employeeMap[empId]) {
        employeeMap[empId] = {
          employeeId: empId,
          employeeNo: o.employee?.employeeNo,
          employeeName: o.employee?.user?.realName,
          departmentName: o.employee?.user?.department?.name,
          departmentId: o.employee?.user?.departmentId,
          leaveDays: 0,
          leaveTypes: {},
          overtimeHours: 0,
          overtimeTypes: {} as Record<string, number>,
        }
      }
      employeeMap[empId].overtimeHours += Number(o.hours || 0)
      employeeMap[empId].overtimeTypes[o.overtimeType] = (employeeMap[empId].overtimeTypes[o.overtimeType] || 0) + Number(o.hours || 0)
    })

    const list = Object.values(employeeMap).map((emp: any) => ({
      ...emp,
      overtimeHours: Math.round(emp.overtimeHours * 100) / 100,
      leaveDays: Math.round(emp.leaveDays * 100) / 100,
    }))

    // 按类型汇总
    const leaveTypeSummary = leaves.reduce((acc: any, l) => {
      acc[l.leaveType] = (acc[l.leaveType] || 0) + Number(l.days || 0)
      return acc
    }, {})

    const overtimeTypeSummary = overtimes.reduce((acc: any, o) => {
      acc[o.overtimeType] = (acc[o.overtimeType] || 0) + Number(o.hours || 0)
      return acc
    }, {})

    // 部门汇总
    const deptStats = list.reduce((acc: any, emp: any) => {
      const deptName = emp.departmentName || '未知'
      if (!acc[deptName]) {
        acc[deptName] = {
          departmentName: deptName,
          employeeCount: 0,
          totalLeaveDays: 0,
          totalOvertimeHours: 0,
        }
      }
      acc[deptName].employeeCount++
      acc[deptName].totalLeaveDays += emp.leaveDays
      acc[deptName].totalOvertimeHours += emp.overtimeHours
      return acc
    }, {})

    const departmentSummary = Object.values(deptStats).map((d: any) => ({
      ...d,
      totalLeaveDays: Math.round(d.totalLeaveDays * 100) / 100,
      totalOvertimeHours: Math.round(d.totalOvertimeHours * 100) / 100,
    }))

    // 月度趋势（用于堆叠柱状图）
    const monthlyTrend: any[] = []
    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(currentYear, m - 1, 1)
      const monthEnd = new Date(currentYear, m, 0)
      const monthLeaves = leaves.filter(l => l.startDate >= monthStart && l.endDate <= monthEnd)
      const monthOvertimes = overtimes.filter(o => o.date >= monthStart && o.date <= monthEnd)

      const leaveByType: Record<string, number> = {}
      monthLeaves.forEach(l => {
        leaveByType[l.leaveType] = (leaveByType[l.leaveType] || 0) + Number(l.days || 0)
      })

      monthlyTrend.push({
        month: `${m}月`,
        totalLeaveDays: Math.round(monthLeaves.reduce((sum, l) => sum + Number(l.days || 0), 0) * 100) / 100,
        totalOvertimeHours: Math.round(monthOvertimes.reduce((sum, o) => sum + Number(o.hours || 0), 0) * 100) / 100,
        leaveByType,
      })
    }

    // 图表数据
    const chartData = {
      leaveTypePie: Object.entries(leaveTypeSummary).map(([name, value]) => ({ name, value: Math.round(Number(value) * 100) / 100 })),
      overtimeTypePie: Object.entries(overtimeTypeSummary).map(([name, value]) => ({ name, value: Math.round(Number(value) * 100) / 100 })),
      departmentCompare: departmentSummary.map((d: any) => ({
        departmentName: d.departmentName,
        totalLeaveDays: d.totalLeaveDays,
        totalOvertimeHours: d.totalOvertimeHours,
      })),
      monthlyTrend,
    }

    return {
      code: 0,
      data: {
        list,
        departmentSummary,
        leaveTypeSummary,
        overtimeTypeSummary,
        chartData,
        startDate,
        endDate,
        total: list.length,
        totalLeaveDays: Math.round(leaves.reduce((sum, l) => sum + Number(l.days || 0), 0) * 100) / 100,
        totalOvertimeHours: Math.round(overtimes.reduce((sum, o) => sum + Number(o.hours || 0), 0) * 100) / 100,
      },
    }
  })

  // ============================================================
  // 财务汇总报表
  // ============================================================
  fastify.get('/finance', { preHandler: [requirePermission('finance:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = reportQuerySchema.parse(request.query)
    const now = new Date()
    const currentYear = query.year || now.getFullYear()
    const currentMonth = query.month || now.getMonth() + 1
    const departmentIds = parseDepartmentIds(query.departmentIds)

    let startDate: Date
    let endDate: Date

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else {
      startDate = new Date(currentYear, currentMonth - 1, 1)
      endDate = new Date(currentYear, currentMonth, 0)
    }

    // 工资数据
    const payrollPeriod = await prisma.payrollPeriod.findFirst({
      where: { startDate: { gte: startDate }, endDate: { lte: endDate } },
    })

    let payslips: any[] = []
    if (payrollPeriod) {
      const payrollRuns = await prisma.payrollRun.findMany({
        where: { payrollPeriodId: payrollPeriod.id, status: 'paid' },
        select: { id: true },
      })
      const runIds = payrollRuns.map(r => r.id)
      if (runIds.length > 0) {
        const payslipWhere: any = { payrollRunId: { in: runIds } }
        if (departmentIds.length > 0) {
          payslipWhere.employee = { user: { departmentId: { in: departmentIds } } }
        }
        if (query.keyword) {
          payslipWhere.employee = {
            ...payslipWhere.employee,
            user: { ...payslipWhere.employee?.user, realName: { contains: query.keyword } },
          }
        }
        payslips = await prisma.payslip.findMany({
          where: payslipWhere,
          include: {
            employee: { select: { id: true, employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
          },
        })
      }
    }

    // 报销数据
    const reimburseWhere: any = {
      createdAt: { gte: startDate, lte: endDate },
      status: 'paid',
    }
    if (departmentIds.length > 0) {
      reimburseWhere.employee = { user: { departmentId: { in: departmentIds } } }
    }
    if (query.keyword) {
      reimburseWhere.employee = {
        ...reimburseWhere.employee,
        user: { ...reimburseWhere.employee?.user, realName: { contains: query.keyword } },
      }
    }
    const reimbursements = await prisma.reimbursement.findMany({
      where: reimburseWhere,
      include: {
        employee: { select: { employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
      },
    })

    // 按部门汇总
    const deptMap: Record<string, any> = {}

    payslips.forEach(p => {
      const deptName = p.employee?.user?.department?.name || '未知'
      if (!deptMap[deptName]) {
        deptMap[deptName] = { departmentName: deptName, salary: 0, reimbursement: 0, employeeCount: new Set() }
      }
      deptMap[deptName].salary += Number(p.netPay || 0)
      deptMap[deptName].employeeCount.add(p.employeeId)
    })

    reimbursements.forEach(r => {
      const deptName = r.employee?.user?.department?.name || '未知'
      if (!deptMap[deptName]) {
        deptMap[deptName] = { departmentName: deptName, salary: 0, reimbursement: 0, employeeCount: new Set() }
      }
      deptMap[deptName].reimbursement += Number(r.amount || 0)
    })

    const departmentSummary = Object.values(deptMap).map((dept: any) => ({
      departmentName: dept.departmentName,
      employeeCount: dept.employeeCount.size,
      totalSalary: Math.round(dept.salary * 100) / 100,
      totalReimbursement: Math.round(dept.reimbursement * 100) / 100,
      totalExpense: Math.round((dept.salary + dept.reimbursement) * 100) / 100,
    }))

    // 汇总
    const totalSalary = payslips.reduce((sum, p) => sum + Number(p.netPay || 0), 0)
    const totalReimbursement = reimbursements.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    const employeeCount = new Set(payslips.map(p => p.employeeId)).size
    const summary = {
      totalSalary: Math.round(totalSalary * 100) / 100,
      totalReimbursement: Math.round(totalReimbursement * 100) / 100,
      totalExpense: Math.round((totalSalary + totalReimbursement) * 100) / 100,
      employeeCount,
      avgSalary: payslips.length > 0
        ? Math.round(totalSalary / payslips.length * 100) / 100
        : 0,
    }

    // 月度趋势
    const monthlyTrend: any[] = []
    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(currentYear, m - 1, 1)
      const monthEnd = new Date(currentYear, m, 0)
      const monthPayslips = payslips.filter(p => {
        const d = p.createdAt || p.publishedAt
        return d >= monthStart && d <= monthEnd
      })
      const monthReimbs = reimbursements.filter(r => r.createdAt >= monthStart && r.createdAt <= monthEnd)
      const monthSalary = monthPayslips.reduce((sum, p) => sum + Number(p.netPay || 0), 0)
      const monthReimb = monthReimbs.reduce((sum, r) => sum + Number(r.amount || 0), 0)
      monthlyTrend.push({
        month: `${m}月`,
        totalSalary: Math.round(monthSalary * 100) / 100,
        totalReimbursement: Math.round(monthReimb * 100) / 100,
        totalExpense: Math.round((monthSalary + monthReimb) * 100) / 100,
      })
    }

    // 图表数据
    const chartData = {
      expensePie: [
        { name: '工资', value: summary.totalSalary },
        { name: '报销', value: summary.totalReimbursement },
      ],
      departmentCompare: departmentSummary.map(d => ({
        departmentName: d.departmentName,
        totalSalary: d.totalSalary,
        totalReimbursement: d.totalReimbursement,
        totalExpense: d.totalExpense,
      })),
      monthlyTrend,
    }

    return {
      code: 0,
      data: {
        departmentSummary,
        summary,
        chartData,
        startDate,
        endDate,
        total: departmentSummary.length,
      },
    }
  })

  // ============================================================
  // 员工考勤明细报表
  // ============================================================
  fastify.get('/attendance/detail', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = reportQuerySchema.parse(request.query)
    const departmentIds = parseDepartmentIds(query.departmentIds)
    const startDate = query.startDate ? new Date(query.startDate) : new Date()
    const endDate = query.endDate ? new Date(query.endDate) : new Date()

    const where: any = await buildAttendanceDataScopeWhere(request.user)
    where.date = { gte: startDate, lte: endDate }
    if (query.employeeId) where.employeeId = query.employeeId
    if (departmentIds.length > 0) where.employee = { user: { departmentId: { in: departmentIds } } }
    if (query.keyword) where.employee = {
      ...where.employee,
      user: { ...where.employee?.user, realName: { contains: query.keyword } },
    }
    if (query.status) where.status = query.status

    const page = query.page || 1
    const pageSize = query.pageSize || 50

    const [total, records] = await Promise.all([
      prisma.attendanceDaily.count({ where }),
      prisma.attendanceDaily.findMany({
        where,
        include: {
          employee: {
            select: {
              employeeNo: true,
              user: {
                select: {
                  realName: true,
                  department: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    const list = records.map(r => ({
      id: r.id,
      employeeNo: r.employee?.employeeNo,
      employeeName: r.employee?.user?.realName,
      departmentName: r.employee?.user?.department?.name,
      date: r.date,
      status: r.status,
      firstIn: r.firstIn,
      lastOut: r.lastOut,
      workMinutes: r.workMinutes,
      lateMinutes: r.lateMinutes,
      earlyMinutes: r.earlyMinutes,
      absentMinutes: r.absentMinutes,
      overtimeMinutes: r.overtimeMinutes,
    }))

    return {
      code: 0,
      data: { list, total, page, pageSize, startDate, endDate },
    }
  })

  // ============================================================
  // 部门排名报表
  // ============================================================
  fastify.get('/attendance/ranking', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = reportQuerySchema.parse(request.query)
    const now = new Date()
    const currentYear = query.year || now.getFullYear()
    const currentMonth = query.month || now.getMonth() + 1
    const departmentIds = parseDepartmentIds(query.departmentIds)

    let startDate: Date
    let endDate: Date

    if (query.startDate && query.endDate) {
      startDate = new Date(query.startDate)
      endDate = new Date(query.endDate)
    } else {
      startDate = new Date(currentYear, currentMonth - 1, 1)
      endDate = new Date(currentYear, currentMonth, 0)
    }

    const where: any = await buildAttendanceDataScopeWhere(request.user)
    where.date = { gte: startDate, lte: endDate }
    if (departmentIds.length > 0) where.employee = { user: { departmentId: { in: departmentIds } } }

    const dailyRecords = await prisma.attendanceDaily.findMany({
      where,
      include: {
        employee: {
          select: {
            user: { select: { departmentId: true, department: { select: { name: true } } } },
          },
        },
      },
    })

    // 按部门统计
    const deptStats = dailyRecords.reduce((acc: any, r) => {
      const deptId = r.employee?.user?.departmentId || 0
      const deptName = r.employee?.user?.department?.name || '未知'
      if (!acc[deptId]) {
        acc[deptId] = {
          departmentId: deptId,
          departmentName: deptName,
          totalDays: 0,
          normalDays: 0,
          lateDays: 0,
          earlyDays: 0,
          absentDays: 0,
          employeeCount: new Set<number>(),
        }
      }
      acc[deptId].totalDays++
      acc[deptId].employeeCount.add(r.employeeId)
      if (r.status === 'normal') acc[deptId].normalDays++
      if (r.lateMinutes > 0) acc[deptId].lateDays++
      if (r.earlyMinutes > 0) acc[deptId].earlyDays++
      if (r.status === 'absent') acc[deptId].absentDays++
      return acc
    }, {})

    const ranking = Object.values(deptStats).map((dept: any) => ({
      departmentId: dept.departmentId,
      departmentName: dept.departmentName,
      employeeCount: dept.employeeCount.size,
      totalDays: dept.totalDays,
      normalDays: dept.normalDays,
      lateDays: dept.lateDays,
      earlyDays: dept.earlyDays,
      absentDays: dept.absentDays,
      attendanceRate: dept.totalDays > 0
        ? Math.round(dept.normalDays / dept.totalDays * 100)
        : 0,
    })).sort((a: any, b: any) => b.attendanceRate - a.attendanceRate)
      .map((item: any, index: number) => ({ ...item, rank: index + 1 }))

    return {
      code: 0,
      data: { list: ranking, startDate, endDate, total: ranking.length },
    }
  })

  // ============================================================
  // 同比环比分析报表
  // ============================================================
  fastify.get('/attendance/trend', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = reportQuerySchema.parse(request.query)
    const now = new Date()
    const currentYear = query.year || now.getFullYear()
    const departmentIds = parseDepartmentIds(query.departmentIds)

    // 今年和去年数据
    const thisYearStart = new Date(currentYear, 0, 1)
    const thisYearEnd = new Date(currentYear, 11, 31)
    const lastYearStart = new Date(currentYear - 1, 0, 1)
    const lastYearEnd = new Date(currentYear - 1, 11, 31)

    const buildWhere = (start: Date, end: Date) => {
      const w: any = { date: { gte: start, lte: end } }
      if (departmentIds.length > 0) w.employee = { user: { departmentId: { in: departmentIds } } }
      return w
    }

    const [thisYearRecords, lastYearRecords] = await Promise.all([
      prisma.attendanceDaily.findMany({ where: buildWhere(thisYearStart, thisYearEnd) }),
      prisma.attendanceDaily.findMany({ where: buildWhere(lastYearStart, lastYearEnd) }),
    ])

    const calcMonthlyStats = (records: any[]) => {
      const monthly: Record<number, any> = {}
      for (let m = 1; m <= 12; m++) {
        monthly[m] = { total: 0, normal: 0, late: 0, early: 0, absent: 0 }
      }
      records.forEach(r => {
        const month = r.date.getMonth() + 1
        monthly[month].total++
        if (r.status === 'normal') monthly[month].normal++
        if (r.lateMinutes > 0) monthly[month].late++
        if (r.earlyMinutes > 0) monthly[month].early++
        if (r.status === 'absent') monthly[month].absent++
      })
      return Object.entries(monthly).map(([month, data]) => ({
        month: Number(month),
        monthName: `${month}月`,
        ...data,
        attendanceRate: data.total > 0 ? Math.round(data.normal / data.total * 100) : 0,
      }))
    }

    const thisYearMonthly = calcMonthlyStats(thisYearRecords)
    const lastYearMonthly = calcMonthlyStats(lastYearRecords)

    // 同比数据
    const yearOverYear = thisYearMonthly.map((item, index) => {
      const lastYear = lastYearMonthly[index]
      const rateDiff = lastYear.attendanceRate > 0
        ? Math.round(item.attendanceRate - lastYear.attendanceRate)
        : 0
      return {
        month: item.monthName,
        thisYear: item.attendanceRate,
        lastYear: lastYear.attendanceRate,
        diff: rateDiff,
        diffPercent: lastYear.attendanceRate > 0
          ? Math.round(rateDiff / lastYear.attendanceRate * 100)
          : 0,
      }
    })

    // 环比数据（按月）
    const monthOverMonth = thisYearMonthly.map((item, index) => {
      if (index === 0) {
        return { month: item.monthName, current: item.attendanceRate, prev: 0, diff: 0 }
      }
      const prev = thisYearMonthly[index - 1]
      const diff = item.attendanceRate - prev.attendanceRate
      return {
        month: item.monthName,
        current: item.attendanceRate,
        prev: prev.attendanceRate,
        diff: Math.round(diff),
      }
    })

    return {
      code: 0,
      data: {
        year: currentYear,
        thisYear: {
          total: thisYearRecords.length,
          normal: thisYearRecords.filter(r => r.status === 'normal').length,
          avgAttendanceRate: thisYearRecords.length > 0
            ? Math.round(thisYearRecords.filter(r => r.status === 'normal').length / thisYearRecords.length * 100)
            : 0,
          monthly: thisYearMonthly,
        },
        lastYear: {
          total: lastYearRecords.length,
          normal: lastYearRecords.filter(r => r.status === 'normal').length,
          avgAttendanceRate: lastYearRecords.length > 0
            ? Math.round(lastYearRecords.filter(r => r.status === 'normal').length / lastYearRecords.length * 100)
            : 0,
          monthly: lastYearMonthly,
        },
        yearOverYear,
        monthOverMonth,
      },
    }
  })
}
