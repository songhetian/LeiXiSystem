import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '../../prisma'
import { setAudit, setAfter } from '../../plugins/audit'
import { enqueueNotification } from '../../plugins/notification'
import { requireAnyPermission } from '../../middleware/permission'
import { normalizePagination } from '../../utils/pagination'
import { idParamsSchema, validateData, requireAtLeastOneField } from '../../utils/validation'
import { canAccessEmployee } from '../../services/objectAuthorization'

const changeTypeSchema = z.enum(['basic_info', 'contact_info', 'position_info', 'other'])

const changeRequestCreateSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  type: changeTypeSchema,
  changeData: z.record(z.string(), z.unknown()),
  reason: z.string().trim().max(500).optional().nullable(),
})

const changeRequestListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: z.string().trim().max(20).optional(),
  type: changeTypeSchema.optional(),
  scope: z.enum(['mine', 'pending_approval', 'all']).optional().default('mine'),
  keyword: z.string().trim().max(100).optional(),
})

const changeRequestApproveSchema = z.object({
  approvalComment: z.string().trim().max(500).optional().nullable(),
})

const changeRequestRejectSchema = z.object({
  approvalComment: z.string().trim().max(500),
})

const ALLOWED_CHANGE_FIELDS: Record<string, string[]> = {
  basic_info: ['gender', 'birthDate', 'idCardNo', 'nationality', 'maritalStatus', 'education'],
  contact_info: ['phone', 'email', 'address', 'emergencyContact', 'emergencyPhone'],
  position_info: ['departmentId', 'positionId', 'salary', 'status'],
  other: ['bankName', 'bankAccountNo', 'skills', 'remark'],
}

export default async function employeeChangeRoutes(fastify: FastifyInstance) {
  fastify.post('/info-changes', async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(changeRequestCreateSchema, request.body)
    requireAtLeastOneField(body.changeData)

    const canAccess = await canAccessEmployee(request.user, body.employeeId, {
      adminPermissions: ['personnel:edit', 'personnel:employee:update', 'employee:manage'],
      allowSelf: true,
    })

    if (!canAccess) {
      return { code: 403, message: '无权限操作此员工' }
    }

    const employee = await prisma.employee.findUnique({
      where: { id: body.employeeId },
      include: { user: true },
    })

    if (!employee) {
      return { code: 404, message: '员工不存在' }
    }

    const allowedFields = ALLOWED_CHANGE_FIELDS[body.type] || []
    const filteredChangeData: Record<string, unknown> = {}
    const filteredOriginalData: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body.changeData) {
        filteredChangeData[field] = body.changeData[field]
        if (field in employee) {
          filteredOriginalData[field] = (employee as any)[field]
        } else if (field in employee.user) {
          filteredOriginalData[field] = (employee.user as any)[field]
        }
      }
    }

    if (Object.keys(filteredChangeData).length === 0) {
      return { code: 400, message: '没有有效的变更字段' }
    }

    const pendingCount = await prisma.employeeInfoChangeRequest.count({
      where: {
        employeeId: body.employeeId,
        status: 'pending',
      },
    })

    if (pendingCount > 0) {
      return { code: 400, message: '该员工已有待审批的变更申请，请先处理' }
    }

    setAudit(request, {
      action: 'employee_info_change.create',
      module: 'personnel',
      requestData: body,
    })

    const changeRequest = await prisma.employeeInfoChangeRequest.create({
      data: {
        employeeId: body.employeeId,
        requesterId: request.user.id,
        type: body.type,
        changeData: filteredChangeData as Prisma.InputJsonValue,
        originalData: filteredOriginalData as Prisma.InputJsonValue,
        reason: body.reason ?? undefined,
        status: 'pending',
      },
    })

    setAfter(request, { id: changeRequest.id })

    const managers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              name: { in: ['admin', 'hr', 'department_manager'] },
            },
          },
        },
        status: 'active',
      },
      select: { id: true },
    })

    managers.forEach((m) => {
      enqueueNotification(request, {
        userId: m.id,
        title: '员工信息变更待审批',
        content: `${request.user.realName || '员工'}提交了员工信息变更申请，请审批`,
        type: 'approval',
        priority: 'normal',
        category: 'personnel',
        relatedId: changeRequest.id,
        relatedType: 'employee_info_change',
      })
    })

    return {
      code: 0,
      message: '申请提交成功',
      data: { id: changeRequest.id },
    }
  })

  fastify.get('/info-changes', async (request: FastifyRequest<{
    Querystring: {
      page?: number
      pageSize?: number
      status?: string
      type?: string
      scope?: string
      keyword?: string
    }
  }>) => {
    const query = validateData(changeRequestListQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { status, type, scope, keyword } = query

    const where: any = {}

    if (scope === 'mine') {
      where.requesterId = request.user.id
    } else if (scope === 'pending_approval') {
      where.status = 'pending'
      where.approverId = null
    }

    if (status) {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    if (keyword) {
      where.employee = {
        user: {
          realName: { contains: keyword },
        },
      }
    }

    const [total, list] = await Promise.all([
      prisma.employeeInfoChangeRequest.count({ where }),
      prisma.employeeInfoChangeRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: {
            include: {
              user: {
                select: {
                  realName: true,
                  employeeNo: true,
                  department: { select: { name: true } },
                  position: { select: { name: true } },
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              realName: true,
            },
          },
          approver: {
            select: {
              id: true,
              realName: true,
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
          employeeNo: (item.employee as any).employeeNo,
          departmentName: item.employee.user.department?.name,
          positionName: item.employee.user.position?.name,
          requesterId: item.requesterId,
          requesterName: item.requester.realName,
          approverId: item.approverId,
          approverName: item.approver?.realName,
          type: item.type,
          status: item.status,
          reason: item.reason,
          approvalComment: item.approvalComment,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          approvedAt: item.approvedAt,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/info-changes/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const changeRequest = await prisma.employeeInfoChangeRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                realName: true,
                username: true,
                email: true,
                phone: true,
                avatar: true,
                departmentId: true,
                positionId: true,
                department: { select: { id: true, name: true } },
                position: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: {
          select: {
            id: true,
            realName: true,
            username: true,
          },
        },
        approver: {
          select: {
            id: true,
            realName: true,
            username: true,
          },
        },
      },
    })

    if (!changeRequest) {
      return { code: 404, message: '申请记录不存在' }
    }

    const canAccess = await canAccessEmployee(request.user, changeRequest.employeeId, {
      adminPermissions: ['personnel:view', 'personnel:employee:view', 'employee:manage'],
      allowSelf: true,
    })

    if (!canAccess && changeRequest.requesterId !== request.user.id) {
      return { code: 403, message: '无权限查看此申请' }
    }

    return {
      code: 0,
      data: {
        id: changeRequest.id,
        employeeId: changeRequest.employeeId,
        employee: {
          id: changeRequest.employee.id,
          userId: changeRequest.employee.userId,
          employeeNo: changeRequest.employee.employeeNo,
          realName: changeRequest.employee.user.realName,
          departmentId: changeRequest.employee.user.departmentId,
          departmentName: changeRequest.employee.user.department?.name,
          positionId: changeRequest.employee.user.positionId,
          positionName: changeRequest.employee.user.position?.name,
        },
        requesterId: changeRequest.requesterId,
        requesterName: changeRequest.requester.realName,
        approverId: changeRequest.approverId,
        approverName: changeRequest.approver?.realName,
        type: changeRequest.type,
        changeData: changeRequest.changeData,
        originalData: changeRequest.originalData,
        status: changeRequest.status,
        reason: changeRequest.reason,
        approvalComment: changeRequest.approvalComment,
        createdAt: changeRequest.createdAt,
        updatedAt: changeRequest.updatedAt,
        approvedAt: changeRequest.approvedAt,
      },
    }
  })

  fastify.post('/info-changes/:id/approve', { preHandler: [requireAnyPermission(['personnel:edit', 'personnel:employee:update', 'employee:manage'])] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(changeRequestApproveSchema, request.body)

    const changeRequest = await prisma.employeeInfoChangeRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { user: true } },
      },
    })

    if (!changeRequest) {
      return { code: 404, message: '申请记录不存在' }
    }

    if (changeRequest.status !== 'pending') {
      return { code: 400, message: '只能审批待处理的申请' }
    }

    setAudit(request, {
      action: 'employee_info_change.approve',
      module: 'personnel',
      requestData: { id, ...body },
      beforeData: changeRequest,
    })

    const changeData = changeRequest.changeData as Record<string, unknown>
    const employeeUpdateData: Record<string, unknown> = {}
    const userUpdateData: Record<string, unknown> = {}

    const employeeFields = new Set([
      'gender', 'birthDate', 'idCardNo', 'nationality', 'maritalStatus',
      'bankName', 'bankAccountNo', 'emergencyContact', 'emergencyPhone',
      'address', 'education', 'skills', 'remark', 'salary', 'status',
    ])

    const userFields = new Set(['phone', 'email', 'departmentId', 'positionId'])

    for (const [field, value] of Object.entries(changeData)) {
      if (employeeFields.has(field)) {
        if (field === 'birthDate' && typeof value === 'string') {
          employeeUpdateData[field] = new Date(value)
        } else {
          employeeUpdateData[field] = value
        }
      } else if (userFields.has(field)) {
        userUpdateData[field] = value
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(employeeUpdateData).length > 0) {
        await tx.employee.update({
          where: { id: changeRequest.employeeId },
          data: employeeUpdateData,
        })
      }

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: changeRequest.employee.userId },
          data: userUpdateData,
        })
      }

      await tx.employeeInfoChangeRequest.update({
        where: { id },
        data: {
          status: 'approved',
          approverId: request.user.id,
          approvalComment: body.approvalComment ?? undefined,
          approvedAt: new Date(),
        },
      })

      await tx.employeeChange.create({
        data: {
          employeeId: changeRequest.employeeId,
          changeType: changeRequest.type,
          oldValue: changeRequest.originalData,
          newValue: changeRequest.changeData,
          reason: changeRequest.reason ?? undefined,
          effectiveDate: new Date(),
          operatorId: request.user.id,
          status: 'completed',
        },
      })
    })

    enqueueNotification(request, {
      userId: changeRequest.requesterId,
      title: '员工信息变更申请已通过',
      content: `您提交的员工信息变更申请已通过审批`,
      type: 'system',
      priority: 'normal',
      category: 'personnel',
      relatedId: id,
      relatedType: 'employee_info_change',
    })

    setAfter(request, { id })

    return { code: 0, message: '审批通过' }
  })

  fastify.post('/info-changes/:id/reject', { preHandler: [requireAnyPermission(['personnel:edit', 'personnel:employee:update', 'employee:manage'])] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(changeRequestRejectSchema, request.body)

    const changeRequest = await prisma.employeeInfoChangeRequest.findUnique({
      where: { id },
    })

    if (!changeRequest) {
      return { code: 404, message: '申请记录不存在' }
    }

    if (changeRequest.status !== 'pending') {
      return { code: 400, message: '只能驳回待处理的申请' }
    }

    setAudit(request, {
      action: 'employee_info_change.reject',
      module: 'personnel',
      requestData: { id, ...body },
      beforeData: changeRequest,
    })

    await prisma.employeeInfoChangeRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approverId: request.user.id,
        approvalComment: body.approvalComment,
      },
    })

    enqueueNotification(request, {
      userId: changeRequest.requesterId,
      title: '员工信息变更申请已驳回',
      content: `您提交的员工信息变更申请已被驳回，原因：${body.approvalComment}`,
      type: 'system',
      priority: 'normal',
      category: 'personnel',
      relatedId: id,
      relatedType: 'employee_info_change',
    })

    setAfter(request, { id })

    return { code: 0, message: '已驳回' }
  })

  fastify.post('/info-changes/:id/cancel', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const changeRequest = await prisma.employeeInfoChangeRequest.findUnique({
      where: { id },
    })

    if (!changeRequest) {
      return { code: 404, message: '申请记录不存在' }
    }

    if (changeRequest.requesterId !== request.user.id) {
      return { code: 403, message: '只能撤销自己提交的申请' }
    }

    if (changeRequest.status !== 'pending') {
      return { code: 400, message: '只能撤销待处理的申请' }
    }

    setAudit(request, {
      action: 'employee_info_change.cancel',
      module: 'personnel',
      requestData: { id },
      beforeData: changeRequest,
    })

    await prisma.employeeInfoChangeRequest.update({
      where: { id },
      data: {
        status: 'cancelled',
      },
    })

    setAfter(request, { id })

    return { code: 0, message: '已撤销' }
  })
}
