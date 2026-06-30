import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { calculateDailyAttendance } from '../../services/attendanceCalculation'
import { normalizePagination } from '../../utils/pagination'
import { dateRangeBaseQuerySchema, attendanceExceptionResolutionStatusSchema } from '../../utils/schemas'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, statusSchema, validateData } from '../../utils/validation'

const exceptionResolveSchema = z.object({
  status: attendanceExceptionResolutionStatusSchema,
  reason: z.string().trim().max(1000).optional(),
})

const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  late: '迟到',
  early: '早退',
  absent: '旷工',
  missing_checkin: '缺上班卡',
  missing_checkout: '缺下班卡',
  overtime_less: '工时不足',
  work_duration_less: '工作时长不足',
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  resolved: '已解决',
  rejected: '已驳回',
}

export default async function exceptionsRoutes(fastify: FastifyInstance) {
  fastify.get('/exceptions', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { employeeId?: number; status?: string; startDate?: string; endDate?: string; type?: string; page?: number; pageSize?: number }
  }>) => {
    const query = validateData(dateRangeBaseQuerySchema.pick({
      employeeId: true,
      status: true,
      startDate: true,
      endDate: true,
      page: true,
      pageSize: true,
    }).extend({
      type: z.string().optional(),
    }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { employeeId, status, startDate, endDate, type } = query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = { ...scopeWhere }

    if (employeeId) where.employeeId = Number(employeeId)
    if (status) where.status = status
    if (type) where.type = type
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const [total, list] = await Promise.all([
      prisma.attendanceException.count({ where }),
      prisma.attendanceException.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { employee: { include: { user: { include: { department: true } } } } },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 异常统计
  fastify.get('/exceptions/stats/summary', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { startDate?: string; endDate?: string; departmentId?: number }
  }>) => {
    const { startDate, endDate } = request.query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = { ...scopeWhere }

    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const allExceptions = await prisma.attendanceException.findMany({
      where,
      select: {
        type: true,
        status: true,
        employeeId: true,
        date: true,
      },
    })

    const total = allExceptions.length
    const pendingCount = allExceptions.filter((e) => e.status === 'pending').length
    const resolvedCount = allExceptions.filter((e) => e.status === 'resolved').length
    const rejectedCount = allExceptions.filter((e) => e.status === 'rejected').length

    const typeStats: Record<string, number> = {}
    for (const e of allExceptions) {
      typeStats[e.type] = (typeStats[e.type] || 0) + 1
    }

    const typeList = Object.entries(typeStats).map(([type, count]) => ({
      type,
      label: EXCEPTION_TYPE_LABELS[type] || type,
      count,
    })).sort((a, b) => b.count - a.count)

    // 按日期统计趋势
    const dateStatsMap = new Map<string, number>()
    for (const e of allExceptions) {
      const dateStr = e.date.toISOString().split('T')[0]
      dateStatsMap.set(dateStr, (dateStatsMap.get(dateStr) || 0) + 1)
    }

    const trend = Array.from(dateStatsMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Top 10 异常员工
    const employeeStatsMap = new Map<number, number>()
    for (const e of allExceptions) {
      employeeStatsMap.set(e.employeeId, (employeeStatsMap.get(e.employeeId) || 0) + 1)
    }

    const topEmployeeIds = Array.from(employeeStatsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id)

    const topEmployees = await prisma.employee.findMany({
      where: { id: { in: topEmployeeIds } },
      select: {
        id: true,
        employeeNo: true,
        user: { select: { realName: true, department: { select: { name: true } } } },
      },
    })

    const topEmployeesWithCount = topEmployees
      .map((emp) => ({
        ...emp,
        count: employeeStatsMap.get(emp.id) || 0,
      }))
      .sort((a, b) => b.count - a.count)

    return {
      code: 0,
      data: {
        summary: {
          total,
          pending: pendingCount,
          resolved: resolvedCount,
          rejected: rejectedCount,
          resolveRate: total > 0 ? Math.round((resolvedCount / total) * 100) : 0,
        },
        typeStats: typeList,
        trend,
        topEmployees: topEmployeesWithCount,
      },
    }
  })

  // 导出异常记录
  fastify.get('/exceptions/export/csv', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { employeeId?: number; status?: string; startDate?: string; endDate?: string; type?: string }
  }>, reply) => {
    const query = validateData(dateRangeBaseQuerySchema.pick({
      employeeId: true,
      status: true,
      startDate: true,
      endDate: true,
    }).extend({
      type: z.string().optional(),
    }), request.query)

    const { employeeId, status, startDate, endDate, type } = query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = { ...scopeWhere }

    if (employeeId) where.employeeId = Number(employeeId)
    if (status) where.status = status
    if (type) where.type = type
    if (startDate || endDate) {
      where.date = {}
      if (startDate) where.date.gte = new Date(startDate)
      if (endDate) where.date.lte = new Date(endDate)
    }

    const list = await prisma.attendanceException.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { employee: { include: { user: { include: { department: true } } } } },
    })

    const headers = ['日期', '员工编号', '员工姓名', '部门', '异常类型', '状态', '原因', '处理时间']
    const rows = list.map((item) => [
      item.date.toISOString().split('T')[0],
      item.employee?.employeeNo || '',
      item.employee?.user?.realName || '',
      item.employee?.user?.department?.name || '',
      EXCEPTION_TYPE_LABELS[item.type] || item.type,
      STATUS_LABELS[item.status] || item.status,
      item.reason || '',
      item.status !== 'pending' ? (item.updatedAt.toISOString().split('T')[0]) : '',
    ])

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const bom = '\uFEFF'
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="attendance-exceptions-${Date.now()}.csv"`)
      .send(bom + csv)
  })

  fastify.post('/exceptions/:id/resolve', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { status: 'resolved' | 'rejected'; reason?: string }
  }>, reply) => {
    const exception = await prisma.attendanceException.findUnique({
      where: { id: validateData(idParamsSchema, request.params).id },
    })

    if (!exception) {
      return reply.status(404).send({ code: 404, message: '考勤异常不存在' })
    }

    const body = validateData(exceptionResolveSchema, request.body)
    setAudit(request, {
      module: 'attendance',
      action: 'attendance.exception.resolve',
      requestData: { id: exception.id, ...body },
    })
    captureBefore(request, exception)
    const updated = await prisma.attendanceException.update({
      where: { id: exception.id },
      data: {
        status: body.status,
        reason: body.reason || exception.reason,
      },
    })

    await calculateDailyAttendance(exception.employeeId, exception.date, request.user.id)

    setAfter(request, { id: updated.id, status: updated.status })

    return { code: 0, message: '考勤异常已处理', data: updated }
  })
}