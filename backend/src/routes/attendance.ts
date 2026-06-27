import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../services/dataScope'
import { writeAuditLog } from '../services/audit'
import { calculateDailyAttendance, calculateMonthlyAttendance, recalculateAttendanceRange } from '../services/attendanceCalculation'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../utils/validation'

const dateRangeBaseQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  employeeId: z.coerce.number().int().positive().optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  status: statusSchema,
})

const dateRangeQuerySchema = dateRangeBaseQuerySchema.refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

const clockInSchema = z.object({
  location: z.string().trim().max(100).optional(),
  type: z.enum(['in', 'out']),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  source: z.string().trim().max(30).regex(/^[a-zA-Z0-9_-]+$/).optional(),
  deviceId: z.string().trim().max(100).optional(),
  photoUrl: z.string().trim().url().max(500).optional(),
})

const correctionCreateSchema = z.object({
  date: dateStringSchema,
  logType: z.enum(['in', 'out']),
  checkTime: dateStringSchema,
  reason: z.string().trim().min(1).max(1000),
})

const opinionSchema = z.object({
  opinion: z.string().trim().max(1000).optional(),
})

const exceptionResolveSchema = z.object({
  status: z.enum(['resolved', 'rejected']),
  reason: z.string().trim().max(1000).optional(),
})

const calculateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  date: dateStringSchema.optional(),
  employeeId: positiveIntSchema.optional(),
}).refine((value) => (!value.date && !value.employeeId) || (value.date && value.employeeId), {
  message: '单日核算必须同时提供日期和员工 ID',
})

const monthlyLockSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  employeeId: positiveIntSchema.optional(),
})

export default async function attendanceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

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
        include: {
          employee: {
            include: { user: { include: { department: true } } },
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

  fastify.get('/checkins', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:checkin:view'])] }, async (request: FastifyRequest<{
    Querystring: { employeeId?: number; startDate?: string; endDate?: string; page?: number; pageSize?: number }
  }>) => {
    const query = validateData(dateRangeBaseQuerySchema.pick({
      employeeId: true,
      startDate: true,
      endDate: true,
      page: true,
      pageSize: true,
    }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { employeeId, startDate, endDate } = query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = {}

    if (employeeId) where.employeeId = Number(employeeId)
    if (startDate && endDate) {
      where.checkTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }

    const [total, list] = await Promise.all([
      prisma.attendanceCheckin.count({ where: { ...where, ...scopeWhere } }),
      prisma.attendanceCheckin.findMany({
        where: { ...where, ...scopeWhere },
        skip,
        take,
        orderBy: { checkTime: 'desc' },
        include: { employee: { include: { user: { include: { department: true } } } } },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/clock-in', async (request: FastifyRequest<{
    Body: {
      location?: string
      type: 'in' | 'out'
      latitude?: number
      longitude?: number
      source?: string
      deviceId?: string
      photoUrl?: string
    }
  }>) => {
    const userId = request.user.id
    const { location, type, latitude, longitude, source, deviceId, photoUrl } = validateData(clockInSchema, request.body)

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let record = await prisma.attendanceRecord.findUnique({
      where: { userId_date: { userId, date: today } },
    })

    if (!record) {
      record = await prisma.attendanceRecord.create({
        data: {
          userId,
          employeeId: employee.id,
          date: today,
          status: 'normal',
        },
      })
    }

    const now = new Date()
    const checkin = await prisma.attendanceCheckin.create({
      data: {
        userId,
        employeeId: employee.id,
        source: source || 'web',
        deviceId,
        logType: type,
        checkTime: now,
        latitude,
        longitude,
        address: location,
        photoUrl,
        ipAddress: request.ip,
        rawPayload: request.body as any,
        verified: false,
      },
    })

    const updateData: any = {}

    if (type === 'in') {
      updateData.checkIn = now
      updateData.locationIn = location

      const shiftStart = new Date(today)
      shiftStart.setHours(9, 0, 0, 0)
      if (now > shiftStart) {
        const lateMinutes = Math.round((now.getTime() - shiftStart.getTime()) / 60000)
        updateData.lateMinutes = lateMinutes
        updateData.status = 'late'
      }
    } else {
      updateData.checkOut = now
      updateData.locationOut = location

      const shiftEnd = new Date(today)
      shiftEnd.setHours(18, 0, 0, 0)
      if (now < shiftEnd) {
        const earlyMinutes = Math.round((shiftEnd.getTime() - now.getTime()) / 60000)
        updateData.earlyMinutes = earlyMinutes
        if (record.status === 'normal') {
          updateData.status = 'early'
        }
      }

      if (record.checkIn) {
        const workHours = ((now.getTime() - record.checkIn.getTime()) / 3600000).toFixed(2)
        updateData.workHours = parseFloat(workHours)
      }
    }

    record = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: updateData,
    })

    await writeAuditLog(request, {
      module: 'attendance',
      action: type === 'in' ? 'clock_in' : 'clock_out',
      requestData: { type, source, deviceId, location },
      responseData: { checkinId: checkin.id, attendanceRecordId: record.id },
    })

    return {
      code: 0,
      message: type === 'in' ? '上班打卡成功' : '下班打卡成功',
      data: { record, checkin },
    }
  })

  fastify.get('/corrections', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { status?: string; employeeId?: number; page?: number; pageSize?: number }
  }>) => {
    const query = validateData(dateRangeBaseQuerySchema.pick({
      status: true,
      employeeId: true,
      page: true,
      pageSize: true,
    }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { status, employeeId } = query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = { ...scopeWhere }

    if (status) where.status = status
    if (employeeId) where.employeeId = Number(employeeId)

    const [total, list] = await Promise.all([
      prisma.attendanceCorrectionRequest.count({ where }),
      prisma.attendanceCorrectionRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { employee: { include: { user: { include: { department: true } } } } },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  fastify.post('/corrections', async (request: FastifyRequest<{
    Body: { date: string; logType: 'in' | 'out'; checkTime: string; reason: string }
  }>, reply) => {
    const body = validateData(correctionCreateSchema, request.body)
    const employee = await prisma.employee.findUnique({
      where: { userId: request.user.id },
    })

    if (!employee) {
      return reply.status(400).send({ code: 400, message: '员工信息不存在' })
    }

    const correction = await prisma.attendanceCorrectionRequest.create({
      data: {
        userId: request.user.id,
        employeeId: employee.id,
        date: new Date(body.date),
        logType: body.logType,
        checkTime: new Date(body.checkTime),
        reason: body.reason,
      },
    })

    await writeAuditLog(request, {
      module: 'attendance',
      action: 'correction_create',
      requestData: body,
      responseData: { id: correction.id },
    })

    return { code: 0, message: '补卡申请已提交', data: correction }
  })

  fastify.post('/corrections/:id/approve', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>, reply) => {
    const correction = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id: validateData(idParamsSchema, request.params).id },
    })

    if (!correction) {
      return reply.status(404).send({ code: 404, message: '补卡申请不存在' })
    }

    if (correction.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该补卡申请已处理' })
    }

    const checkin = await prisma.attendanceCheckin.create({
      data: {
        userId: correction.userId,
        employeeId: correction.employeeId,
        source: 'correction',
        logType: correction.logType,
        checkTime: correction.checkTime,
        rawPayload: {
          correctionId: correction.id,
          reason: correction.reason,
          approverId: request.user.id,
        } as any,
        verified: true,
      },
    })

    const updated = await prisma.attendanceCorrectionRequest.update({
      where: { id: correction.id },
      data: {
        status: 'approved',
        approverId: request.user.id,
        approvedAt: new Date(),
        opinion: validateData(opinionSchema, request.body || {}).opinion,
        checkinId: checkin.id,
      },
    })

    await recalculateAttendanceRange({
      employeeId: correction.employeeId,
      startDate: correction.date,
      endDate: correction.date,
      operatorId: request.user.id,
    })

    await writeAuditLog(request, {
      module: 'attendance',
      action: 'correction_approve',
      requestData: { id: correction.id, opinion: validateData(opinionSchema, request.body || {}).opinion },
      responseData: { checkinId: checkin.id },
    })

    return { code: 0, message: '补卡申请已通过并重算考勤', data: updated }
  })

  fastify.post('/corrections/:id/reject', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>, reply) => {
    const correction = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id: validateData(idParamsSchema, request.params).id },
    })

    if (!correction) {
      return reply.status(404).send({ code: 404, message: '补卡申请不存在' })
    }

    if (correction.status !== 'pending') {
      return reply.status(400).send({ code: 400, message: '该补卡申请已处理' })
    }

    const updated = await prisma.attendanceCorrectionRequest.update({
      where: { id: correction.id },
      data: {
        status: 'rejected',
        approverId: request.user.id,
        approvedAt: new Date(),
        opinion: validateData(opinionSchema, request.body || {}).opinion,
      },
    })

    await writeAuditLog(request, {
      module: 'attendance',
      action: 'correction_reject',
      requestData: { id: correction.id, opinion: validateData(opinionSchema, request.body || {}).opinion },
    })

    return { code: 0, message: '补卡申请已驳回', data: updated }
  })

  fastify.get('/monthly', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { year?: number; month?: number; employeeId?: number }
  }>) => {
    const { year, month, employeeId } = request.query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = { ...scopeWhere }
    if (year) where.year = Number(year)
    if (month) where.month = Number(month)
    if (employeeId) where.employeeId = Number(employeeId)

    const list = await prisma.attendanceMonthly.findMany({
      where,
      include: { employee: { include: { user: { include: { department: true } } } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return { code: 0, data: list }
  })

  fastify.get('/exceptions', { preHandler: [requirePermission('attendance:view')] }, async (request: FastifyRequest<{
    Querystring: { employeeId?: number; status?: string; startDate?: string; endDate?: string; page?: number; pageSize?: number }
  }>) => {
    const query = validateData(dateRangeBaseQuerySchema.pick({
      employeeId: true,
      status: true,
      startDate: true,
      endDate: true,
      page: true,
      pageSize: true,
    }), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { employeeId, status, startDate, endDate } = query
    const scopeWhere = await buildAttendanceDataScopeWhere(request.user)
    const where: any = { ...scopeWhere }

    if (employeeId) where.employeeId = Number(employeeId)
    if (status) where.status = status
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
    const updated = await prisma.attendanceException.update({
      where: { id: exception.id },
      data: {
        status: body.status,
        reason: body.reason || exception.reason,
      },
    })

    await calculateDailyAttendance(exception.employeeId, exception.date, request.user.id)

    await writeAuditLog(request, {
      module: 'attendance',
      action: 'exception_resolve',
      requestData: { id: exception.id, ...body },
      responseData: { id: updated.id, status: updated.status },
    })

    return { code: 0, message: '考勤异常已处理', data: updated }
  })

  fastify.post('/calculate', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Body: { year?: number; month?: number; date?: string; employeeId?: number }
  }>) => {
    const { year, month, date, employeeId } = validateData(calculateSchema, request.body || {})
    let result: any

    if (date && employeeId) {
      result = await calculateDailyAttendance(Number(employeeId), new Date(date), request.user.id)
    } else {
      const now = new Date()
      result = await calculateMonthlyAttendance({
        year: Number(year || now.getFullYear()),
        month: Number(month || now.getMonth() + 1),
        employeeId: employeeId ? Number(employeeId) : undefined,
        operatorId: request.user.id,
      })
    }

    await writeAuditLog(request, {
      module: 'attendance',
      action: 'calculate_completed',
      requestData: { year, month, date, employeeId },
      responseData: { count: Array.isArray(result) ? result.length : 1 },
    })

    return { code: 0, message: '考勤核算完成', data: result }
  })

  fastify.post('/monthly/lock', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Body: { year: number; month: number; employeeId?: number }
  }>) => {
    const { year, month, employeeId } = validateData(monthlyLockSchema, request.body)
    const result = await calculateMonthlyAttendance({
      year: Number(year),
      month: Number(month),
      employeeId: employeeId ? Number(employeeId) : undefined,
      operatorId: request.user.id,
      lock: true,
    })

    await writeAuditLog(request, {
      module: 'attendance',
      action: 'monthly_lock',
      requestData: { year, month, employeeId },
      responseData: { count: result.length },
    })

    return { code: 0, message: '月考勤已锁定', data: result }
  })
}
