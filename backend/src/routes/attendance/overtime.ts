import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requirePermission, requireAnyPermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { normalizePagination } from '../../utils/pagination'
import { dateRangeBaseQuerySchema } from '../../utils/schemas'
import { overtimeStatusSchema } from '../../utils/schemas/status'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, validateData, partialUpdateSchema, requireAtLeastOneField, safeExtend, safeOmit, positiveIntSchema } from '../../utils/validation'

const dateRangeQuerySchema = dateRangeBaseQuerySchema.refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

const overtimeListQuerySchema = safeExtend(dateRangeQuerySchema, {
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

const overtimeUpdateSchema = partialUpdateSchema(overtimeCreateSchema)

const overtimeApproveSchema = z.object({
  opinion: z.string().trim().max(500).optional().nullable(),
})

const overtimeBatchApproveSchema = z.object({
  ids: z.array(positiveIntSchema).min(1, '至少选择一个加班申请'),
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
    const query = validateData(safeOmit(overtimeListQuerySchema, ['keyword', 'departmentId']), request.query)
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
    const data = validateData(overtimeUpdateSchema, request.body)
    requireAtLeastOneField(data)

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
      requestData: data,
      beforeData: existing,
    })

    const updateData: any = { ...data }
    if (data.date) {
      updateData.date = new Date(data.date)
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

  fastify.post('/overtime/batch-approve', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(overtimeBatchApproveSchema, request.body)
    const opinionValue: string | null = body.opinion ?? null

    const records = await prisma.overtimeRequest.findMany({
      where: { id: { in: body.ids }, status: 'pending' },
    })

    let successCount = 0
    const { createApprovalRecord } = await import('../../services/approvalRecord')

    for (const record of records) {
      try {
        setAudit(request, {
          action: 'overtime.batch_approve',
          module: 'attendance',
          beforeData: record,
          requestData: { id: record.id, opinion: opinionValue },
        })

        await prisma.overtimeRequest.update({
          where: { id: record.id },
          data: { status: 'approved' },
        })

        createApprovalRecord({
          requestType: 'overtime',
          requestId: record.id,
          nodeOrder: 1,
          nodeName: '审批',
          approverId: request.user.id,
          approverName: request.user.realName,
          action: 'approve',
          opinion: opinionValue,
        }).catch(() => {})

        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    return { code: 0, message: `成功批准 ${successCount} 个加班申请`, data: { successCount, total: body.ids.length } }
  })

  fastify.post('/overtime/batch-reject', { preHandler: [requirePermission('attendance:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(overtimeBatchApproveSchema, request.body)
    const opinionValue: string | null = body.opinion ?? null

    const records = await prisma.overtimeRequest.findMany({
      where: { id: { in: body.ids }, status: 'pending' },
    })

    let successCount = 0
    const { createApprovalRecord } = await import('../../services/approvalRecord')

    for (const record of records) {
      try {
        setAudit(request, {
          action: 'overtime.batch_reject',
          module: 'attendance',
          beforeData: record,
          requestData: { id: record.id, opinion: opinionValue },
        })

        await prisma.overtimeRequest.update({
          where: { id: record.id },
          data: { status: 'rejected' },
        })

        createApprovalRecord({
          requestType: 'overtime',
          requestId: record.id,
          nodeOrder: 1,
          nodeName: '审批',
          approverId: request.user.id,
          approverName: request.user.realName,
          action: 'reject',
          opinion: opinionValue,
        }).catch(() => {})

        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    return { code: 0, message: `成功驳回 ${successCount} 个加班申请`, data: { successCount, total: body.ids.length } }
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
