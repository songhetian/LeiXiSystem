import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { enqueueNotification } from '../../plugins/notification'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { normalizePagination } from '../../utils/pagination'
import { dateRangeBaseQuerySchema } from '../../utils/schemas'
import { leaveStatusSchema } from '../../utils/schemas/status'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safeExtend, safeOmit } from '../../utils/validation'

const dateRangeQuerySchema = dateRangeBaseQuerySchema.refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

const leaveListQuerySchema = safeExtend(dateRangeQuerySchema, {
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  status: leaveStatusSchema.optional(),
})

const leaveCreateSchema = z.object({
  leaveType: z.string().trim().min(1).max(50),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  days: z.coerce.number().min(0.5).max(365),
  reason: z.string().trim().min(1).max(1000),
}).refine((value) => new Date(value.endDate) >= new Date(value.startDate), {
  message: '结束日期不能早于开始日期',
  path: ['endDate'],
})

const leaveUpdateSchema = partialUpdateSchema(leaveCreateSchema)

const leaveApproveSchema = z.object({
  opinion: z.string().trim().max(500).optional().nullable(),
})

export default async function leaveRoutes(fastify: FastifyInstance) {
  fastify.get('/leave', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{
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
    const query = validateData(leaveListQuerySchema, request.query)
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
      where.startDate = {
        gte: new Date(startDate),
      }
      where.endDate = {
        lte: new Date(endDate),
      }
    }
    if (status) {
      where.status = status
    }

    const [total, list] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          employeeId: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          days: true,
          reason: true,
          status: true,
          currentStep: true,
          workflowId: true,
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
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((item) => ({
          id: item.id,
          userId: item.userId,
          employeeId: item.employeeId,
          employeeName: item.employee.user.realName,
          employeeNo: item.employee.employeeNo,
          departmentName: item.employee.user.department?.name,
          leaveType: item.leaveType,
          startDate: item.startDate,
          endDate: item.endDate,
          days: Number(item.days),
          reason: item.reason,
          status: item.status,
          currentStep: item.currentStep,
          workflowId: item.workflowId,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/leave/my', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      status?: string
      startDate?: string
      endDate?: string
    }
  }>) => {
    const query = validateData(safeOmit(leaveListQuerySchema, ['keyword', 'departmentId']), request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { status, startDate, endDate } = query

    const employee = await prisma.employee.findUnique({
      where: { userId: request.user.id },
    })

    if (!employee) {
      return { code: 0, data: { list: [], total: 0, page, pageSize } }
    }

    const where: any = { employeeId: employee.id }
    if (startDate && endDate) {
      where.startDate = { gte: new Date(startDate) }
      where.endDate = { lte: new Date(endDate) }
    }
    if (status) {
      where.status = status
    }

    const [total, list] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      code: 0,
      data: {
        list: list.map((item) => ({
          ...item,
          days: Number(item.days),
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/leave/:id', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const record = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: {
              select: {
                realName: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    if (!record) {
      return { code: 404, message: '记录不存在' }
    }

    return {
      code: 0,
      data: {
        ...record,
        days: Number(record.days),
        employeeName: record.employee.user.realName,
        employeeNo: record.employee.employeeNo,
        departmentName: record.employee.user.department?.name,
      },
    }
  })

  fastify.post('/leave', async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(leaveCreateSchema, request.body)

    const employee = await prisma.employee.findUnique({
      where: { userId: request.user.id },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    setAudit(request, {
      action: 'leave.create',
      module: 'attendance',
      requestData: body,
    })

    const record = await prisma.leaveRequest.create({
      data: {
        userId: request.user.id,
        employeeId: employee.id,
        leaveType: body.leaveType,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        days: body.days,
        reason: body.reason,
        status: 'pending',
      },
    })

    setAfter(request, { id: record.id })

    const { createApprovalRecord } = await import('../../services/approvalRecord')
    createApprovalRecord({
      requestType: 'leave',
      requestId: record.id,
      nodeOrder: 0,
      nodeName: '提交申请',
      action: 'submit',
    }).catch(() => {})

    const managers = await prisma.user.findMany({
      where: {
        role: { name: { in: ['admin', 'hr', 'department_manager'] } },
        status: 'active',
      },
      select: { id: true },
    })
    managers.forEach(m => {
      enqueueNotification(request, {
        userId: m.id,
        title: '新的请假申请待审批',
        content: `${request.user.realName || '员工'}提交了${body.leaveType}请假申请，共${body.days}天`,
        type: 'approval',
        relatedId: record.id,
        relatedType: 'leave',
      })
    })

    return { code: 0, message: '申请成功', data: { ...record, days: Number(record.days) } }
  })

  fastify.put('/leave/:id', async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(leaveUpdateSchema, request.body)
    requireAtLeastOneField(data)

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    if (existing.userId !== request.user.id) {
      return { code: 403, message: '无权限修改' }
    }

    if (existing.status !== 'pending') {
      return { code: 400, message: '只能修改待审批的申请' }
    }

    captureBefore(request, existing)
    setAudit(request, {
      action: 'leave.update',
      module: 'attendance',
      requestData: data,
      beforeData: existing,
    })

    const updateData: any = { ...data }
    if (data.startDate) {
      updateData.startDate = new Date(data.startDate)
    }
    if (data.endDate) {
      updateData.endDate = new Date(data.endDate)
    }

    await prisma.leaveRequest.update({
      where: { id },
      data: updateData,
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.post('/leave/:id/cancel', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    if (existing.userId !== request.user.id) {
      return { code: 403, message: '无权限撤销' }
    }

    if (existing.status !== 'pending') {
      return { code: 400, message: '只能撤销待审批的申请' }
    }

    setAudit(request, {
      action: 'leave.cancel',
      module: 'attendance',
      beforeData: existing,
    })

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    return { code: 0, message: '撤销成功' }
  })

  fastify.post('/leave/:id/approve', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(leaveApproveSchema, request.body)

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    if (existing.status !== 'pending') {
      return { code: 400, message: '只能审批待审批的申请' }
    }

    setAudit(request, {
      action: 'leave.approve',
      module: 'attendance',
      beforeData: existing,
      requestData: body,
    })

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'approved' },
    })

    const { createApprovalRecord } = await import('../../services/approvalRecord')
    createApprovalRecord({
      requestType: 'leave',
      requestId: existing.id,
      nodeOrder: 1,
      nodeName: '审批',
      approverId: request.user.id,
      approverName: request.user.realName,
      action: 'approve',
      opinion: body?.opinion,
    }).catch(() => {})

    enqueueNotification(request, {
      userId: existing.userId,
      title: '请假申请已通过',
      content: `您的${existing.leaveType}请假申请已通过审批`,
      type: 'approval',
      relatedId: existing.id,
      relatedType: 'leave',
    })

    return { code: 0, message: '审批通过' }
  })

  fastify.post('/leave/:id/reject', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(leaveApproveSchema, request.body)

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    if (existing.status !== 'pending') {
      return { code: 400, message: '只能驳回待审批的申请' }
    }

    setAudit(request, {
      action: 'leave.reject',
      module: 'attendance',
      beforeData: existing,
      requestData: body,
    })

    await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'rejected' },
    })

    const { createApprovalRecord } = await import('../../services/approvalRecord')
    createApprovalRecord({
      requestType: 'leave',
      requestId: existing.id,
      nodeOrder: 1,
      nodeName: '审批',
      approverId: request.user.id,
      approverName: request.user.realName,
      action: 'reject',
      opinion: body?.opinion,
    }).catch(() => {})

    enqueueNotification(request, {
      userId: existing.userId,
      title: '请假申请已驳回',
      content: `您的${existing.leaveType}请假申请已被驳回`,
      type: 'approval',
      relatedId: existing.id,
      relatedType: 'leave',
    })

    return { code: 0, message: '已驳回' }
  })

  fastify.delete('/leave/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    setAudit(request, {
      action: 'leave_delete',
      module: 'attendance',
      beforeData: existing,
    })

    await prisma.leaveRequest.delete({
      where: { id },
    })

    return { code: 0, message: '删除成功' }
  })
}
