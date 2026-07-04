import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { hasPermission, requireAnyPermission, requirePermission } from '../middleware/permission'
import { getAccessibleLeaveRequest, getAccessibleOvertimeRequest } from '../services/objectAuthorization'
import { recalculateAttendanceRange } from '../services/attendanceCalculation'
import { normalizePagination } from '../utils/pagination'
import { opinionSchema, leaveStatusSchema, overtimeStatusSchema, adjustmentStatusSchema } from '../utils/schemas'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, timeSchema, validateData } from '../utils/validation'
import { enqueueNotification, enqueueNotifications } from '../plugins/notification'
import type { SendNotificationInput } from '../services/notification'

const leaveListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: leaveStatusSchema,
  leaveType: z.string().trim().max(50).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  keyword: optionalKeywordSchema,
})

const overtimeListQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: overtimeStatusSchema,
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
}).refine((value) => value.endTime > value.startTime, {
  message: '结束时间必须晚于开始时间',
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
      include: { user: { select: { realName: true } } },
    })

    if (!employee) {
      return { code: 400, message: '员工信息不存在' }
    }

    // leaveType 存储的是 VacationType.code，需要先查找 VacationType 得到 id
    const vacationType = await prisma.vacationType.findUnique({ where: { code: body.leaveType } })
    if (!vacationType) {
      return { code: 400, message: '假期类型不存在' }
    }

    // 检查假期余额（警告提示，不阻止申请）
    const year = new Date(body.startDate).getFullYear()
    const balance = await prisma.vacationBalance.findUnique({
      where: { employeeId_vacationTypeId_year: { employeeId: employee.id, vacationTypeId: vacationType.id, year } },
      include: { vacationType: true },
    })
    const balanceNum = balance ? Number(balance.balance) : 0
    if (balance && balanceNum < body.days) {
      // 余额不足仍可提交申请，但提示审批人注意
      await prisma.leaveRequest.create({
        data: {
          userId,
          employeeId: employee.id,
          leaveType: body.leaveType,
          startDate: new Date(body.startDate),
          endDate: new Date(body.endDate),
          days: body.days,
          reason: `[余额不足警告] ${body.reason || ''}`,
          status: 'pending',
          currentStep: 0,
        },
      })
      return { code: 0, message: '申请已提交（余额不足，请注意审批）', data: null }
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

    // 通知审批人
    const approvers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              rolePermissions: {
                some: { permission: { code: 'vacation:manage' } },
              },
            },
          },
        },
      },
      select: { id: true },
    })
    const notifications: SendNotificationInput[] = approvers.map((approver) => ({
      userId: approver.id,
      title: '新的请假申请待审批',
      content: `${employee.user?.realName || '员工'} 提交了 ${body.days} 天 ${vacationType.name} 申请，请及时审批。`,
      type: 'approval',
      relatedId: leave.id,
      relatedType: 'leave_request',
    }))
    enqueueNotifications(request, notifications)

    return { code: 0, message: '申请成功', data: leave }
  })

  fastify.get('/leave/:id', async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const leave = await getAccessibleLeaveRequest(
      request.user,
      () => prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: { include: { user: { include: { department: true } } } },
          approvalRecords: { orderBy: { approvedAt: 'asc' } },
        },
      }),
      (item) => item.id,
    )

    if (!leave) {
      return { code: 404, message: '请假申请不存在' }
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

    const leave = await prisma.leaveRequest.findUnique({
      where: { id, userId: request.user.id },
      include: { employee: true },
    })
    if (!leave) return { code: 404, message: '请假申请不存在' }
    if (leave.status === 'cancelled') return { code: 400, message: '已取消' }
    if (leave.status === 'rejected') return { code: 400, message: '已驳回无法取消' }

    // 如果已批准，需要恢复假期余额
    if (leave.status === 'approved') {
      const year = new Date(leave.startDate).getFullYear()
      // leave.leaveType 是 VacationType.code，需要先查找 VacationType 得到 id
      const vacationType = await prisma.vacationType.findUnique({ where: { code: leave.leaveType } })
      if (vacationType) {
        const balance = await prisma.vacationBalance.findUnique({
          where: { employeeId_vacationTypeId_year: { employeeId: leave.employeeId, vacationTypeId: vacationType.id, year } },
        })
        if (balance) {
          const daysNum = Number(leave.days)
          const usedNum = Number(balance.used)
          const totalNum = Number(balance.total)
          const balNum = Number(balance.balance)
          await prisma.vacationBalance.update({
            where: { id: balance.id },
            data: {
              used: Math.max(0, usedNum - daysNum),
              balance: Math.min(totalNum, balNum + daysNum),
            },
          })
        }
      }
    }

    await prisma.leaveRequest.update({
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

    // 查找请假单
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { employee: true },
    })
    if (!leave) return { code: 404, message: '请假申请不存在' }
    if (leave.status !== 'pending') return { code: 400, message: '只能审批待审批状态的请假' }

    // leave.leaveType 是 VacationType.code，需要先查找 VacationType 得到 id
    const vacationType = await prisma.vacationType.findUnique({ where: { code: leave.leaveType } })
    if (!vacationType) return { code: 400, message: '假期类型不存在' }

    // 扣减假期余额
    const year = new Date(leave.startDate).getFullYear()
    const balance = await prisma.vacationBalance.findUnique({
      where: { employeeId_vacationTypeId_year: { employeeId: leave.employeeId, vacationTypeId: vacationType.id, year } },
    })
    if (balance) {
      const daysNum = Number(leave.days)
      const usedNum = Number(balance.used)
      const totalNum = Number(balance.total)
      const balNum = Number(balance.balance)
      const newUsed = usedNum + daysNum
      const newBalance = totalNum - newUsed
      if (newBalance < 0) {
        return { code: 400, message: `余额不足，该假期类型剩余${balNum}天，申请${daysNum}天` }
      }
      await prisma.vacationBalance.update({
        where: { id: balance.id },
        data: { used: newUsed, balance: Math.max(0, newBalance) },
      })
    }

    await prisma.leaveRequest.update({
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

    enqueueNotification(request, {
      userId: leave.userId,
      title: '请假申请已通过',
      content: `您的 ${leave.leaveType} 请假申请（${leave.days}天）已审批通过。`,
      type: 'approval',
      relatedId: leave.id,
      relatedType: 'leave_request',
    })

    return { code: 0, message: '审批通过' }
  })

  fastify.post('/leave/:id/reject', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: { opinion?: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { opinion } = validateData(opinionSchema, request.body || {})

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { id: true, userId: true, leaveType: true, days: true },
    })
    if (!leave) return { code: 404, message: '请假申请不存在' }

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

    enqueueNotification(request, {
      userId: leave.userId,
      title: '请假申请已驳回',
      content: `您的 ${leave.leaveType} 请假申请已被驳回${opinion ? `：${opinion}` : ''}`,
      type: 'approval',
      relatedId: leave.id,
      relatedType: 'leave_request',
    })

    return { code: 0, message: '已驳回' }
  })

  // 批量审批请假申请
  fastify.post('/leave/batch-approve', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Body: { ids: number[]; opinion?: string }
  }>) => {
    const { ids, opinion } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个请假申请'),
      opinion: z.string().trim().max(1000).optional(),
    }), request.body)
    const opinionValue: string | null = (opinion as string | undefined) ?? null

    const leaves = await prisma.leaveRequest.findMany({
      where: { id: { in: ids }, status: 'pending' },
      include: { employee: true },
    })

    let successCount = 0
    for (const leave of leaves) {
      try {
        // 查找假期类型
        const vacationType = await prisma.vacationType.findUnique({ where: { code: leave.leaveType } })
        if (!vacationType) continue

        // 扣减假期余额
        const year = new Date(leave.startDate).getFullYear()
        const balance = await prisma.vacationBalance.findUnique({
          where: { employeeId_vacationTypeId_year: { employeeId: leave.employeeId, vacationTypeId: vacationType.id, year } },
        })
        if (balance) {
          const daysNum = Number(leave.days)
          const usedNum = Number(balance.used)
          const totalNum = Number(balance.total)
          const newUsed = usedNum + daysNum
          const newBalance = totalNum - newUsed
          if (newBalance >= 0) {
            await prisma.vacationBalance.update({
              where: { id: balance.id },
              data: { used: newUsed, balance: Math.max(0, newBalance) },
            })
          }
        }

        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { status: 'approved', currentStep: 100 },
        })

        await prisma.leaveApprovalRecord.create({
          data: {
            leaveId: leave.id,
            approverId: request.user.id,
            action: 'approve',
            opinion: opinionValue,
            nodeOrder: 1,
          },
        })

        enqueueNotification(request, {
          userId: leave.userId,
          title: '请假申请已通过',
          content: `您的 ${leave.leaveType} 请假申请已通过${opinion ? `：${opinion}` : ''}`,
          type: 'approval',
          relatedId: leave.id,
          relatedType: 'leave_request',
        })

        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    return { code: 0, message: `成功批准 ${successCount} 个请假申请`, data: { successCount, total: ids.length } }
  })

  // 批量驳回请假申请
  fastify.post('/leave/batch-reject', { preHandler: [requirePermission('approval:view')] }, async (request: FastifyRequest<{
    Body: { ids: number[]; opinion?: string }
  }>) => {
    const { ids, opinion } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个请假申请'),
      opinion: z.string().trim().max(1000).optional(),
    }), request.body)
    const opinionValue: string | null = (opinion as string | undefined) ?? null

    const leaves = await prisma.leaveRequest.findMany({
      where: { id: { in: ids }, status: 'pending' },
      select: { id: true, userId: true, leaveType: true },
    })

    let successCount = 0
    for (const leave of leaves) {
      try {
        await prisma.leaveRequest.update({
          where: { id: leave.id },
          data: { status: 'rejected' },
        })

        await prisma.leaveApprovalRecord.create({
          data: {
            leaveId: leave.id,
            approverId: request.user.id,
            action: 'reject',
            opinion: opinionValue,
            nodeOrder: 1,
          },
        })

        enqueueNotification(request, {
          userId: leave.userId,
          title: '请假申请已驳回',
          content: `您的 ${leave.leaveType} 请假申请已被驳回${opinionValue ? `：${opinionValue}` : ''}`,
          type: 'approval',
          relatedId: leave.id,
          relatedType: 'leave_request',
        })

        successCount++
      } catch (e) {
        // 忽略单个失败
      }
    }

    return { code: 0, message: `成功驳回 ${successCount} 个请假申请`, data: { successCount, total: ids.length } }
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

    const overtime = await getAccessibleOvertimeRequest(
      request.user,
      () => prisma.overtimeRequest.findUnique({
        where: { id },
        include: {
          employee: { include: { user: { include: { department: true } } } },
        },
      }),
      (item) => item.id,
    )

    if (!overtime) {
      return { code: 404, message: '加班申请不存在' }
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
