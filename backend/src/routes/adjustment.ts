import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { recalculateAttendanceRange } from '../services/attendanceCalculation'
import { normalizePagination } from '../utils/pagination'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, statusSchema, timeSchema, validateData } from '../utils/validation'

const leaveListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: statusSchema,
  leaveType: z.string().trim().max(50).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  keyword: optionalKeywordSchema,
})

const overtimeListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: statusSchema,
  overtimeType: z.string().trim().max(50).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  keyword: optionalKeywordSchema,
})

const leaveApplySchema = z.object({
  leaveType: z.string().trim().min(1).max(50),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  days: z.coerce.number().positive().max(366),
  reason: z.string().trim().min(1).max(1000),
}).refine((value) => new Date(value.startDate) <= new Date(value.endDate), {
  message: '开始日期不能晚于结束日期',
})

const overtimeApplySchema = z.object({
  overtimeType: z.string().trim().min(1).max(50),
  date: dateStringSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  hours: z.coerce.number().positive().max(24),
  reason: z.string().trim().min(1).max(1000),
})

const opinionSchema = z.object({
  opinion: z.string().trim().max(1000).optional(),
})

export default async function adjustmentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/leave', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      status?: string
      leaveType?: string
      departmentId?: number
      keyword?: string
    }
  }>) => {
    const query = validateData(leaveListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { status, leaveType, departmentId, keyword } = query

    const where: any = hasPermission(request, 'approval:view') || hasPermission(request, 'vacation:manage')
      ? {}
      : { userId: request.user.id }
    if (status) where.status = status
    if (leaveType) where.leaveType = leaveType
    if (departmentId) {
      where.employee = { user: { departmentId } }
    }
    if (keyword) {
      where.employee = { ...where.employee, user: { ...where.employee?.user, realName: { contains: keyword } } }
    }

    const [total, list] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { include: { user: { include: { department: true } } } },
          approvalRecords: { orderBy: { approvedAt: 'asc' } },
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
          leaveType: item.leaveType,
          startDate: item.startDate,
          endDate: item.endDate,
          days: item.days,
          reason: item.reason,
          status: item.status,
          currentStep: item.currentStep,
          createdAt: item.createdAt,
          approvalRecords: item.approvalRecords,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.post('/leave', { preHandler: [requireAnyPermission(['vacation:view', 'vacation:manage'])] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(leaveApplySchema, request.body)
    const userId = request.user.id

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        userId,
        employeeId: employee.id,
        leaveType: body.leaveType,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        days: body.days,
        reason: body.reason,
        status: 'pending',
        currentStep: 0,
      },
    })

    return { code: 0, message: '申请成功', data: leave }
  })

  fastify.get('/leave/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { user: { include: { department: true } } } },
        approvalRecords: { orderBy: { approvedAt: 'asc' } },
      },
    })

    if (!leave) {
      return { code: 404, message: '请假申请不存在' }
    }

    const canViewAll = hasPermission(request, 'approval:view') || hasPermission(request, 'vacation:manage')
    if (!canViewAll && leave.userId !== request.user.id) {
      return { code: 403, message: '没有权限查看该请假申请' }
    }

    return {
      code: 0,
      data: {
        id: leave.id,
        employeeId: leave.employeeId,
        employeeName: leave.employee.user.realName,
        employeeNo: leave.employee.employeeNo,
        departmentName: leave.employee.user.department?.name,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days,
        reason: leave.reason,
        status: leave.status,
        currentStep: leave.currentStep,
        createdAt: leave.createdAt,
        approvalRecords: leave.approvalRecords,
      },
    }
  })

  fastify.post('/leave/:id/cancel', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const leave = await prisma.leaveRequest.update({
      where: { id, userId: request.user.id },
      data: { status: 'cancelled' },
    })

    await recalculateAttendanceRange({
      employeeId: leave.employeeId,
      startDate: leave.startDate,
      endDate: leave.endDate,
      operatorId: request.user.id,
    })

    return { code: 0, message: '已撤销' }
  })

  fastify.post('/leave/:id/approve', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(opinionSchema, request.body || {})

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'approved', currentStep: 100 },
    })

    await prisma.leaveApprovalRecord.create({
      data: {
        leaveId: id,
        approverId: request.user.id,
        action: 'approve',
        opinion,
        nodeOrder: 1,
      },
    })

    await recalculateAttendanceRange({
      employeeId: leave.employeeId,
      startDate: leave.startDate,
      endDate: leave.endDate,
      operatorId: request.user.id,
    })

    return { code: 0, message: '审批通过' }
  })

  fastify.post('/leave/:id/reject', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(opinionSchema, request.body || {})

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'rejected' },
    })

    await prisma.leaveApprovalRecord.create({
      data: {
        leaveId: id,
        approverId: request.user.id,
        action: 'reject',
        opinion,
        nodeOrder: 1,
      },
    })

    return { code: 0, message: '已驳回' }
  })

  fastify.get('/overtime', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      status?: string
      overtimeType?: string
      departmentId?: number
      keyword?: string
    }
  }>) => {
    const query = validateData(overtimeListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { status, overtimeType, departmentId, keyword } = query

    const where: any = hasPermission(request, 'approval:view') || hasPermission(request, 'attendance:calculate')
      ? {}
      : { userId: request.user.id }
    if (status) where.status = status
    if (overtimeType) where.overtimeType = overtimeType
    if (departmentId) {
      where.employee = { user: { departmentId } }
    }
    if (keyword) {
      where.employee = { ...where.employee, user: { ...where.employee?.user, realName: { contains: keyword } } }
    }

    const [total, list] = await Promise.all([
      prisma.overtimeRequest.count({ where }),
      prisma.overtimeRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { include: { user: { include: { department: true } } } },
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
          overtimeType: item.overtimeType,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          hours: item.hours,
          reason: item.reason,
          status: item.status,
          currentStep: item.currentStep,
          createdAt: item.createdAt,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.post('/overtime', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:calculate'])] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(overtimeApplySchema, request.body)
    const userId = request.user.id

    const employee = await prisma.employee.findUnique({
      where: { userId },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    const overtime = await prisma.overtimeRequest.create({
      data: {
        userId,
        employeeId: employee.id,
        overtimeType: body.overtimeType,
        date: new Date(body.date),
        startTime: body.startTime,
        endTime: body.endTime,
        hours: body.hours,
        reason: body.reason,
        status: 'pending',
        currentStep: 0,
      },
    })

    return { code: 0, message: '申请成功', data: overtime }
  })

  fastify.get('/overtime/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const overtime = await prisma.overtimeRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { user: { include: { department: true } } } },
      },
    })

    if (!overtime) {
      return { code: 404, message: '加班申请不存在' }
    }

    const canViewAll = hasPermission(request, 'approval:view') || hasPermission(request, 'attendance:calculate')
    if (!canViewAll && overtime.userId !== request.user.id) {
      return { code: 403, message: '没有权限查看该加班申请' }
    }

    return {
      code: 0,
      data: {
        id: overtime.id,
        employeeId: overtime.employeeId,
        employeeName: overtime.employee.user.realName,
        employeeNo: overtime.employee.employeeNo,
        departmentName: overtime.employee.user.department?.name,
        overtimeType: overtime.overtimeType,
        date: overtime.date,
        startTime: overtime.startTime,
        endTime: overtime.endTime,
        hours: overtime.hours,
        reason: overtime.reason,
        status: overtime.status,
        currentStep: overtime.currentStep,
        createdAt: overtime.createdAt,
      },
    }
  })

  fastify.post('/overtime/:id/cancel', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const overtime = await prisma.overtimeRequest.update({
      where: { id, userId: request.user.id },
      data: { status: 'cancelled' },
    })

    await recalculateAttendanceRange({
      employeeId: overtime.employeeId,
      startDate: overtime.date,
      endDate: overtime.date,
      operatorId: request.user.id,
    })

    return { code: 0, message: '已撤销' }
  })

  fastify.post('/overtime/:id/approve', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    validateData(opinionSchema, request.body || {})

    const overtime = await prisma.overtimeRequest.update({
      where: { id },
      data: { status: 'approved', currentStep: 100 },
    })

    await recalculateAttendanceRange({
      employeeId: overtime.employeeId,
      startDate: overtime.date,
      endDate: overtime.date,
      operatorId: request.user.id,
    })

    return { code: 0, message: '审批通过' }
  })

  fastify.post('/overtime/:id/reject', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(opinionSchema, request.body || {})

    await prisma.overtimeRequest.update({
      where: { id },
      data: { status: 'rejected' },
    })

    return { code: 0, message: '已驳回' }
  })

  fastify.get('/shift-change', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; status?: string }
  }>) => {
    const { page = 1, pageSize = 10, status } = request.query

    const where: any = { userId: request.user.id }
    if (status) where.status = status

    return { code: 0, data: { list: [], total: 0, page, pageSize } }
  })
}
