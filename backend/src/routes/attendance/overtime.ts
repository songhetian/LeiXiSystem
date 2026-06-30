import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { normalizePagination } from '../../utils/pagination'
import { dateRangeBaseQuerySchema } from '../../utils/schemas'
import { overtimeStatusSchema } from '../../utils/schemas/status'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, validateData } from '../../utils/validation'

const dateRangeQuerySchema = dateRangeBaseQuerySchema.refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

const overtimeListQuerySchema = dateRangeQuerySchema.extend({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  keyword: optionalKeywordSchema,
  departmentId: z.coerce.number().int().positive().optional(),
  status: overtimeStatusSchema.optional(),
})

const overtimeCreateSchema = z.object({
  overtimeType: z.string().trim().min(1).max(50),
  date: dateStringSchema,
  startTime: z.string().trim().min(1).max(10),
  endTime: z.string().trim().min(1).max(10),
  hours: z.coerce.number().min(0).max(24),
  reason: z.string().trim().min(1).max(500),
})

const overtimeUpdateSchema = overtimeCreateSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: '至少需要提交一个更新字段',
})

const overtimeApproveSchema = z.object({
  opinion: z.string().trim().max(500).optional().nullable(),
})

export default async function overtimeRoutes(fastify: FastifyInstance) {
  fastify.get('/overtime', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{
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
    const query = validateData(overtimeListQuerySchema, request.query)
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
      prisma.overtimeRequest.count({ where }),
      prisma.overtimeRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          employeeId: true,
          overtimeType: true,
          date: true,
          startTime: true,
          endTime: true,
          hours: true,
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
          overtimeType: item.overtimeType,
          date: item.date,
          startTime: item.startTime,
          endTime: item.endTime,
          hours: Number(item.hours),
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

  fastify.get('/overtime/my', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      status?: string
      startDate?: string
      endDate?: string
    }
  }>) => {
    const query = validateData(overtimeListQuerySchema.omit({ keyword: true, departmentId: true }), request.query)
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
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    }
    if (status) {
      where.status = status
    }

    const [total, list] = await Promise.all([
      prisma.overtimeRequest.count({ where }),
      prisma.overtimeRequest.findMany({
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
          hours: Number(item.hours),
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/overtime/:id', { preHandler: [requireAnyPermission(['attendance:view', 'attendance:manage'])] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const record = await prisma.overtimeRequest.findUnique({
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
        hours: Number(record.hours),
        employeeName: record.employee.user.realName,
        employeeNo: record.employee.employeeNo,
        departmentName: record.employee.user.department?.name,
      },
    }
  })

  fastify.post('/overtime', async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(overtimeCreateSchema, request.body)

    const employee = await prisma.employee.findUnique({
      where: { userId: request.user.id },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    setAudit(request, {
      action: 'overtime.create',
      module: 'attendance',
      requestData: body,
    })

    const record = await prisma.overtimeRequest.create({
      data: {
        userId: request.user.id,
        employeeId: employee.id,
        overtimeType: body.overtimeType,
        date: new Date(body.date),
        startTime: body.startTime,
        endTime: body.endTime,
        hours: body.hours,
        reason: body.reason,
        status: 'pending',
      },
    })

    setAfter(request, { id: record.id })

    return { code: 0, message: '申请成功', data: { ...record, hours: Number(record.hours) } }
  })

  fastify.put('/overtime/:id', async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(overtimeUpdateSchema, request.body)

    const existing = await prisma.overtimeRequest.findUnique({
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
      action: 'overtime_update',
      module: 'attendance',
      requestData: body,
      beforeData: existing,
    })

    const updateData: any = { ...body }
    if (body.date) {
      updateData.date = new Date(body.date)
    }

    await prisma.overtimeRequest.update({
      where: { id },
      data: updateData,
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.post('/overtime/:id/cancel', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.overtimeRequest.findUnique({
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
      action: 'overtime_cancel',
      module: 'attendance',
      beforeData: existing,
    })

    await prisma.overtimeRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    return { code: 0, message: '撤销成功' }
  })

  fastify.post('/overtime/:id/approve', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(overtimeApproveSchema, request.body)

    const existing = await prisma.overtimeRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    if (existing.status !== 'pending') {
      return { code: 400, message: '只能审批待审批的申请' }
    }

    setAudit(request, {
      action: 'overtime.approve',
      module: 'attendance',
      beforeData: existing,
      requestData: body,
    })

    await prisma.overtimeRequest.update({
      where: { id },
      data: { status: 'approved' },
    })

    const { createApprovalRecord } = await import('../../services/approvalRecord')
    createApprovalRecord({
      requestType: 'overtime',
      requestId: existing.id,
      nodeOrder: 1,
      nodeName: '审批',
      approverId: request.user.id,
      approverName: request.user.realName,
      action: 'approve',
      opinion: body?.opinion,
    }).catch(() => {})

    return { code: 0, message: '审批通过' }
  })

  fastify.post('/overtime/:id/reject', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(overtimeApproveSchema, request.body)

    const existing = await prisma.overtimeRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    if (existing.status !== 'pending') {
      return { code: 400, message: '只能驳回待审批的申请' }
    }

    setAudit(request, {
      action: 'overtime_reject',
      module: 'attendance',
      beforeData: existing,
      requestData: body,
    })

    await prisma.overtimeRequest.update({
      where: { id },
      data: { status: 'rejected' },
    })

    const { createApprovalRecord } = await import('../../services/approvalRecord')
    createApprovalRecord({
      requestType: 'overtime',
      requestId: existing.id,
      nodeOrder: 1,
      nodeName: '审批',
      approverId: request.user.id,
      approverName: request.user.realName,
      action: 'reject',
      opinion: body?.opinion,
    }).catch(() => {})

    return { code: 0, message: '已驳回' }
  })

  fastify.delete('/overtime/:id', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.overtimeRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return { code: 404, message: '记录不存在' }
    }

    setAudit(request, {
      action: 'overtime_delete',
      module: 'attendance',
      beforeData: existing,
    })

    await prisma.overtimeRequest.delete({
      where: { id },
    })

    return { code: 0, message: '删除成功' }
  })
}
