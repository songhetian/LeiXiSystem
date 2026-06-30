import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit, captureBefore, setAfter } from '../../plugins/audit'
import { requireAnyPermission, requirePermission } from '../../middleware/permission'
import { buildAttendanceDataScopeWhere } from '../../services/dataScope'
import { recalculateAttendanceRange } from '../../services/attendanceCalculation'
import { normalizePagination } from '../../utils/pagination'
import { dateRangeBaseQuerySchema, opinionSchema, correctionLogTypeSchema } from '../../utils/schemas'
import { dateStringSchema, idParamsSchema, optionalKeywordSchema, positiveIntSchema, statusSchema, validateData } from '../../utils/validation'

const correctionCreateSchema = z.object({
  date: dateStringSchema,
  logType: correctionLogTypeSchema,
  checkTime: dateStringSchema,
  reason: z.string().trim().min(1).max(1000),
})

export default async function correctionsRoutes(fastify: FastifyInstance) {
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

    setAudit(request, {
      action: 'attendance.correction.create',
      module: 'attendance',
      requestData: body,
    })
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
    setAfter(request, { id: correction.id })

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

    setAudit(request, {
      module: 'attendance',
      action: 'attendance.correction.approve',
      requestData: { id: correction.id, opinion: validateData(opinionSchema, request.body || {}).opinion },
    })
    captureBefore(request, correction)
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

    setAfter(request, { checkinId: checkin.id })

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

    setAudit(request, {
      module: 'attendance',
      action: 'attendance.correction.reject',
      requestData: { id: correction.id, opinion: validateData(opinionSchema, request.body || {}).opinion },
    })
    captureBefore(request, correction)
    const updated = await prisma.attendanceCorrectionRequest.update({
      where: { id: correction.id },
      data: {
        status: 'rejected',
        approverId: request.user.id,
        approvedAt: new Date(),
        opinion: validateData(opinionSchema, request.body || {}).opinion,
      },
    })

    setAfter(request, { id: correction.id })

    return { code: 0, message: '补卡申请已驳回', data: updated }
  })

  // 批量审批补卡申请
  fastify.post('/corrections/batch-approve', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Body: { ids: number[]; opinion?: string }
  }>) => {
    const { ids, opinion } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个补卡申请'),
      opinion: opinionSchema.optional(),
    }), request.body)
    const opinionValue: string | null = (opinion as string | undefined) ?? null

    const corrections = await prisma.attendanceCorrectionRequest.findMany({
      where: { id: { in: ids }, status: 'pending' },
    })

    let successCount = 0
    const results: Array<{ id: number; checkinId?: number; error?: string }> = []

    for (const correction of corrections) {
      try {
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

        await prisma.attendanceCorrectionRequest.update({
          where: { id: correction.id },
          data: {
            status: 'approved',
            approverId: request.user.id,
            approvedAt: new Date(),
            opinion: opinionValue,
            checkinId: checkin.id,
          },
        })

        await recalculateAttendanceRange({
          employeeId: correction.employeeId,
          startDate: correction.date,
          endDate: correction.date,
          operatorId: request.user.id,
        })

        successCount++
        results.push({ id: correction.id, checkinId: checkin.id })
      } catch (e) {
        results.push({ id: correction.id, error: String(e) })
      }
    }

    setAudit(request, {
      module: 'attendance',
      action: 'attendance.correction.batchApprove',
      requestData: { ids, opinion, successCount, failedCount: ids.length - successCount },
    })

    return {
      code: 0,
      message: `成功审批 ${successCount} 个补卡申请`,
      data: { successCount, failedCount: ids.length - successCount, results },
    }
  })

  // 批量驳回补卡申请
  fastify.post('/corrections/batch-reject', { preHandler: [requireAnyPermission(['attendance:calculate', 'attendance:view'])] }, async (request: FastifyRequest<{
    Body: { ids: number[]; opinion?: string }
  }>) => {
    const { ids, opinion } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个补卡申请'),
      opinion: opinionSchema.optional(),
    }), request.body)
    const opinionValue: string | null = (opinion as string | undefined) ?? null

    const corrections = await prisma.attendanceCorrectionRequest.findMany({
      where: { id: { in: ids }, status: 'pending' },
    })

    let successCount = 0

    for (const correction of corrections) {
      await prisma.attendanceCorrectionRequest.update({
        where: { id: correction.id },
        data: {
          status: 'rejected',
          approverId: request.user.id,
          approvedAt: new Date(),
          opinion: opinionValue,
        },
      })
      successCount++
    }

    setAudit(request, {
      module: 'attendance',
      action: 'attendance.correction.batchReject',
      requestData: { ids, opinion, successCount },
    })

    return {
      code: 0,
      message: `成功驳回 ${successCount} 个补卡申请`,
      data: { successCount, failedCount: ids.length - successCount },
    }
  })
}