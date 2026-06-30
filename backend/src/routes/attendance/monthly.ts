import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { calculateMonthlyAttendance } from '../../services/attendanceCalculation'
import { positiveIntSchema, validateData } from '../../utils/validation'

const calculateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  date: z.string().trim().optional(),
  employeeId: positiveIntSchema.optional(),
}).refine((value) => (!value.date && !value.employeeId) || (value.date && value.employeeId), {
  message: '单日核算必须同时提供日期和员工 id',
})

const monthlyLockSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  employeeId: positiveIntSchema.optional(),
})

export default async function monthlyRoutes(fastify: FastifyInstance) {
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
      select: {
        id: true,
        userId: true,
        employeeId: true,
        year: true,
        month: true,
        expectedWorkDays: true,
        actualWorkDays: true,
        paidLeaveDays: true,
        unpaidLeaveDays: true,
        absentDays: true,
        lateCount: true,
        earlyCount: true,
        missingCheckinCount: true,
        overtimeMinutes: true,
        status: true,
        lockedAt: true,
        lockedBy: true,
        createdAt: true,
        updatedAt: true,
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
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })

    return { code: 0, data: list }
  })

  fastify.post('/calculate', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Body: { year?: number; month?: number; date?: string; employeeId?: number }
  }>) => {
    const { year, month, date, employeeId } = validateData(calculateSchema, request.body || {})
    let result: any

    if (date && employeeId) {
      const { calculateDailyAttendance } = await import('../../services/attendanceCalculation')
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

    setAudit(request, {
      module: 'attendance',
      action: 'attendance.calculate.completed',
      requestData: { year, month, date, employeeId },
    })
    setAfter(request, { count: Array.isArray(result) ? result.length : 1 })

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

    setAudit(request, {
      module: 'attendance',
      action: 'attendance.monthly.lock',
      requestData: { year, month, employeeId },
    })
    setAfter(request, { count: result.length })

    return { code: 0, message: '月考勤已锁定', data: result }
  })
}