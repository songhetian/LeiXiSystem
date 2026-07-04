import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requirePermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { normalizePagination } from '../../utils/pagination'
import { dateRangeBaseQuerySchema } from '../../utils/schemas'
import { dateStringSchema, optionalKeywordSchema, statusSchema, validateData } from '../../utils/validation'

const dateRangeQuerySchema = dateRangeBaseQuerySchema.refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

export default async function recordsRoutes(fastify: FastifyInstance) {
  fastify.get('/records', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      keyword?: string
      departmentId?: number
      startDate?: string
      endDate?: string
      status?: string
    }
  }>) => {
    const query = validateData(dateRangeQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { keyword, departmentId, startDate, endDate, status } = query

    const where: any = await buildAttendanceDataScopeWhere(request.user)
    if (keyword) {
      where.employee = {
        user: { realName: { contains: keyword } },
      }
    }
    if (departmentId) {
      where.employee = {
        ...where.employee,
        user: { ...where.employee?.user, departmentId },
      }
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    if (status) {
      where.status = status
    }

    const [total, list] = await Promise.all([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        skip,
        take,
        orderBy: { date: 'desc' },
        select: {
          id: true,
          employeeId: true,
          date: true,
          checkIn: true,
          checkOut: true,
          workHours: true,
          status: true,
          lateMinutes: true,
          earlyMinutes: true,
          locationIn: true,
          locationOut: true,
          employee: {
            select: {
              employeeNo: true,
              user: {
                select: {
                  realName: true,
                  department: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((item) => ({
          id: item.id,
          employeeId: item.employeeId,
          employeeName: item.employee.user.realName,
          employeeNo: item.employee.employeeNo,
          departmentName: item.employee.user.department?.name,
          date: item.date,
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          workHours: item.workHours,
          status: item.status,
          lateMinutes: item.lateMinutes,
          earlyMinutes: item.earlyMinutes,
          locationIn: item.locationIn,
          locationOut: item.locationOut,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/stats', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { departmentId?: number; month?: string }
  }>) => {
    const { departmentId, month } = request.query

    const where: any = await buildAttendanceDataScopeWhere(request.user)
    if (departmentId) {
      where.employee = { user: { departmentId } }
    }
    if (month) {
      const [year, m] = month.split('-')
      where.date = {
        gte: new Date(`${year}-${m}-01`),
        lte: new Date(`${year}-${m}-31`),
      }
    }

    const records = await prisma.attendanceRecord.findMany({ where })

    const total = records.length
    const normal = records.filter((r) => r.status === 'normal').length
    const late = records.filter((r) => r.status === 'late').length
    const early = records.filter((r) => r.status === 'early').length
    const absent = records.filter((r) => r.status === 'absent').length
    const leave = records.filter((r) => r.status === 'leave').length

    const attendanceRate = total > 0 ? ((normal + leave) / total * 100).toFixed(1) : '0'

    return {
      code: 0,
      data: {
        total,
        normal,
        late,
        early,
        absent,
        leave,
        attendanceRate,
      },
    }
  })

  // 考勤统计报表
  fastify.get('/statistics', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { departmentId?: number; startDate?: string; endDate?: string }
  }>) => {
    const { departmentId, startDate, endDate } = request.query as { departmentId?: number; startDate?: string; endDate?: string }

    const where: any = await buildAttendanceDataScopeWhere(request.user)
    if (departmentId) {
      where.employee = { user: { departmentId } }
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const records = await prisma.attendanceRecord.findMany({ where })

    const total = records.length
    const normal = records.filter((r) => r.status === 'normal').length
    const late = records.filter((r) => r.status === 'late').length
    const early = records.filter((r) => r.status === 'early').length
    const absent = records.filter((r) => r.status === 'absent').length
    const leave = records.filter((r) => r.status === 'leave').length
    const attendanceRate = total > 0 ? ((normal + leave) / total * 100).toFixed(1) : '0'

    // 按部门统计
    const departmentStats = await prisma.attendanceRecord.groupBy({
      by: ['employeeId'],
      where,
      _count: { id: true },
    })

    const employeeIds = departmentStats.map((d) => d.employeeId)
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        employeeNo: true,
        department: { select: { name: true } },
        user: { select: { realName: true } },
      },
    })
    const empMap = new Map(employees.map((e) => [e.id, e]))

    const detailStats = departmentStats.map((d: any) => {
      const emp = empMap.get(d.employeeId) as any
      const empRecords = records.filter((r) => r.employeeId === d.employeeId)
      const empNormal = empRecords.filter((r) => r.status === 'normal').length
      const empLate = empRecords.filter((r) => r.status === 'late').length
      const empEarly = empRecords.filter((r) => r.status === 'early').length
      const empAbsent = empRecords.filter((r) => r.status === 'absent').length
      const empLeave = empRecords.filter((r) => r.status === 'leave').length
      return {
        employeeId: d.employeeId,
        employeeNo: emp?.employeeNo || '-',
        employeeName: emp?.user?.realName || '-',
        department: emp?.department?.name || '-',
        total: d._count.id,
        normal: empNormal,
        late: empLate,
        early: empEarly,
        absent: empAbsent,
        leave: empLeave,
        attendanceRate: ((empNormal + empLeave) / d._count.id * 100).toFixed(1),
      }
    })

    return {
      code: 0,
      data: {
        summary: { total, normal, late, early, absent, leave, attendanceRate },
        details: detailStats,
      },
    }
  })

  // 导出考勤记录
  fastify.post('/records/export', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Body: {
      departmentId?: number
      startDate?: string
      endDate?: string
      status?: string
      fields?: string[]
    }
  }>) => {
    const body = request.body as any
    const { departmentId, startDate, endDate, status, fields = [] } = body || {}

    const where: any = await buildAttendanceDataScopeWhere(request.user)
    if (departmentId) {
      where.employee = { user: { departmentId } }
    }
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    if (status) {
      where.status = status
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      select: {
        date: true,
        checkinTime: true,
        checkoutTime: true,
        status: true,
        employee: {
          select: {
            employeeNo: true,
            department: { select: { name: true } },
            user: { select: { realName: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { employee: { employeeNo: 'asc' } }],
    })

    const rows = records.map((r: any) => ({
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '-',
      employeeNo: r.employee?.employeeNo || '-',
      employeeName: r.employee?.user?.realName || '-',
      department: r.employee?.department?.name || '-',
      checkinTime: r.checkinTime || '-',
      checkoutTime: r.checkoutTime || '-',
      status: r.status === 'normal' ? '正常' : r.status === 'late' ? '迟到' : r.status === 'early' ? '早退' : r.status === 'absent' ? '缺勤' : r.status === 'leave' ? '请假' : '其他',
    }))

    return {
      code: 0,
      message: `共 ${rows.length} 条数据`,
      data: {
        filename: `考勤记录_${new Date().toISOString().split('T')[0]}.xlsx`,
        fields: fields.length > 0 ? fields : ['date', 'employeeNo', 'employeeName', 'department', 'checkinTime', 'checkoutTime', 'status'],
        rows,
      },
    }
  })

  // 批量删除打卡记录
  fastify.post('/records/batch-delete', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Body: { ids: number[] }
  }>) => {
    const { ids } = validateData(z.object({
      ids: z.array(z.number().int().positive()).min(1, '至少选择一条记录'),
    }), request.body)

    const records = await prisma.attendanceRecord.findMany({
      where: { id: { in: ids } },
    })

    if (records.length === 0) {
      return { code: 404, message: '未找到相关记录' }
    }

    setAudit(request, {
      action: 'attendance.records.batchDelete',
      module: 'attendance',
      requestData: { ids },
    })

    await prisma.attendanceRecord.deleteMany({
      where: { id: { in: ids } },
    })

    return {
      code: 0,
      message: `成功删除 ${records.length} 条记录`,
      data: { deletedCount: records.length },
    }
  })

  // 批量修改打卡记录
  fastify.post('/records/batch-update', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Body: {
      ids: number[]
      checkIn?: string | null
      checkOut?: string | null
      status?: string
      workHours?: number | null
    }
  }>) => {
    const { ids, checkIn, checkOut, status, workHours } = validateData(z.object({
      ids: z.array(z.number().int().positive()).min(1, '至少选择一条记录'),
      checkIn: z.string().nullable().optional(),
      checkOut: z.string().nullable().optional(),
      status: z.string().optional(),
      workHours: z.number().nullable().optional(),
    }), request.body)

    const records = await prisma.attendanceRecord.findMany({
      where: { id: { in: ids } },
    })

    if (records.length === 0) {
      return { code: 404, message: '未找到相关记录' }
    }

    const updateData: any = {}
    if (checkIn !== undefined) updateData.checkIn = checkIn ? new Date(checkIn) : null
    if (checkOut !== undefined) updateData.checkOut = checkOut ? new Date(checkOut) : null
    if (status !== undefined) updateData.status = status
    if (workHours !== undefined) updateData.workHours = workHours

    setAudit(request, {
      action: 'attendance.records.batchUpdate',
      module: 'attendance',
      requestData: { ids, ...updateData },
    })

    await prisma.attendanceRecord.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    })

    return {
      code: 0,
      message: `成功修改 ${records.length} 条记录`,
      data: { updatedCount: records.length },
    }
  })
}