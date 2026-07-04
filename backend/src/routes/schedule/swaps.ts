import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission } from '../../middleware/permission'
import { setAudit, setAfter } from '../../plugins/audit'
import { enqueueNotification } from '../../plugins/notification'
import { dateStringSchema, idParamsSchema, positiveIntSchema, validateData } from '../../utils/validation'

const swapCreateSchema = z.object({
  targetId: positiveIntSchema,
  requesterScheduleId: positiveIntSchema,
  targetScheduleId: positiveIntSchema,
  reason: z.string().trim().max(500).optional().nullable(),
})

const swapApproveSchema = z.object({
  approveRemark: z.string().trim().max(500).optional().nullable(),
})

const swapQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
  type: z.enum(['my', 'target']).optional().default('my'),
})

function buildSwapNo() {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `SW-${date}-${now.getTime().toString().slice(-6)}`
}

export default async function scheduleSwapRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取换班申请列表
  fastify.get('/swaps', async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(swapQuerySchema, request.query)
    const { page = 1, pageSize = 20 } = query
    const skip = (Number(page) - 1) * Number(pageSize)
    const take = Number(pageSize)

    const where: any = {}

    if (query.type === 'my') {
      where.requesterId = request.user.id
    } else if (query.type === 'target') {
      where.targetId = request.user.id
    } else {
      where.OR = [
        { requesterId: request.user.id },
        { targetId: request.user.id },
      ]
    }

    if (query.status) {
      where.status = query.status
    }

    const [total, list] = await Promise.all([
      prisma.shiftSwapRequest.count({ where }),
      prisma.shiftSwapRequest.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { id: true, realName: true, department: { select: { name: true } } } },
          target: { select: { id: true, realName: true, department: { select: { name: true } } } },
          requesterSchedule: {
            include: {
              shift: { select: { name: true, color: true } },
            },
          },
          targetSchedule: {
            include: {
              shift: { select: { name: true, color: true } },
            },
          },
          approver: { select: { realName: true } },
        },
      }),
    ])

    return { code: 0, data: { list, total, page, pageSize } }
  })

  // 获取单个换班申请详情
  fastify.get('/swaps/:id', async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const swap = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: {
        requester: { select: { id: true, realName: true, department: { select: { name: true } } } },
        target: { select: { id: true, realName: true, department: { select: { name: true } } } },
        requesterSchedule: {
          include: {
            shift: { select: { name: true, color: true, startTime: true, endTime: true } },
          },
        },
        targetSchedule: {
          include: {
            shift: { select: { name: true, color: true, startTime: true, endTime: true } },
          },
        },
        approver: { select: { realName: true } },
      },
    })

    if (!swap) return { code: 404, message: '换班申请不存在' }

    // 权限检查：只有申请人、被申请人或审批人可以查看
    if (swap.requesterId !== request.user.id && swap.targetId !== request.user.id) {
      return { code: 403, message: '无权查看此申请' }
    }

    return { code: 0, data: swap }
  })

  // 创建换班申请
  fastify.post('/swaps', async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(swapCreateSchema, request.body)

    // 检查申请人的排班是否存在且属于当前用户
    const requesterSchedule = await prisma.schedule.findUnique({
      where: { id: body.requesterScheduleId },
    })
    if (!requesterSchedule || requesterSchedule.userId !== request.user.id) {
      return { code: 400, message: '无效的申请人排班' }
    }

    // 检查被申请人的排班是否存在且属于目标用户
    const targetSchedule = await prisma.schedule.findUnique({
      where: { id: body.targetScheduleId },
    })
    if (!targetSchedule || targetSchedule.userId !== body.targetId) {
      return { code: 400, message: '无效的被申请人排班' }
    }

    // 检查是否已有待处理的换班申请
    const existingSwap = await prisma.shiftSwapRequest.findFirst({
      where: {
        status: 'pending',
        OR: [
          { requesterScheduleId: body.requesterScheduleId },
          { targetScheduleId: body.targetScheduleId },
        ],
      },
    })
    if (existingSwap) {
      return { code: 400, message: '该排班已有待处理的换班申请' }
    }

    const swap = await prisma.shiftSwapRequest.create({
      data: {
        ...body,
        requestNo: buildSwapNo(),
        requesterId: request.user.id,
      },
    })
    setAfter(request, { id: swap.id })

    // 通知被申请人
    enqueueNotification(request, {
      userId: body.targetId,
      title: '换班申请',
      content: `${request.user.realName} 发起换班申请，请在待办中处理`,
      type: 'task',
      relatedId: swap.id,
      relatedType: 'shift_swap',
    })

    return { code: 0, message: '换班申请已提交', data: swap }
  })

  // 审批换班申请（通过）
  fastify.put('/swaps/:id/approve', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(swapApproveSchema, request.body)

    const swap = await prisma.shiftSwapRequest.findUnique({
      where: { id },
      include: {
        requesterSchedule: true,
        targetSchedule: true,
      },
    })

    if (!swap) return { code: 404, message: '换班申请不存在' }
    if (swap.status !== 'pending') return { code: 400, message: '该申请已处理' }

    setAudit(request, {
      action: 'schedule.swap.approve',
      module: 'schedule',
      beforeData: swap,
      requestData: { id, ...body },
    })

    // 执行换班：交换两个排班的 userId 和 shiftId
    await prisma.$transaction([
      prisma.schedule.update({
        where: { id: swap.requesterScheduleId },
        data: {
          userId: swap.targetId,
          shiftId: swap.targetSchedule.shiftId,
          source: 'swap',
        },
      }),
      prisma.schedule.update({
        where: { id: swap.targetScheduleId },
        data: {
          userId: swap.requesterId,
          shiftId: swap.requesterSchedule.shiftId,
          source: 'swap',
        },
      }),
      prisma.shiftSwapRequest.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy: request.user.id,
          approvedAt: new Date(),
          approveRemark: body.approveRemark,
        },
      }),
    ])

    // 通知双方
    enqueueNotification(request, {
      userId: swap.requesterId,
      title: '换班申请已通过',
      content: `您与 ${swap.targetId} 的换班申请已通过`,
      type: 'system',
      relatedId: swap.id,
      relatedType: 'shift_swap',
    })
    enqueueNotification(request, {
      userId: swap.targetId,
      title: '换班申请已通过',
      content: `您与 ${swap.requesterId} 的换班申请已通过`,
      type: 'system',
      relatedId: swap.id,
      relatedType: 'shift_swap',
    })

    return { code: 0, message: '换班申请已通过' }
  })

  // 拒绝换班申请
  fastify.put('/swaps/:id/reject', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(swapApproveSchema, request.body)

    const swap = await prisma.shiftSwapRequest.findUnique({ where: { id } })
    if (!swap) return { code: 404, message: '换班申请不存在' }
    if (swap.status !== 'pending') return { code: 400, message: '该申请已处理' }

    setAudit(request, {
      action: 'schedule.swap.reject',
      module: 'schedule',
      beforeData: swap,
      requestData: { id, ...body },
    })

    await prisma.shiftSwapRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        approvedBy: request.user.id,
        approvedAt: new Date(),
        approveRemark: body.approveRemark,
      },
    })

    // 通知申请人
    enqueueNotification(request, {
      userId: swap.requesterId,
      title: '换班申请被拒绝',
      content: body.approveRemark || '您的换班申请已被拒绝',
      type: 'system',
      relatedId: swap.id,
      relatedType: 'shift_swap',
    })

    return { code: 0, message: '换班申请已拒绝' }
  })

  // 取消换班申请（申请人主动取消）
  fastify.put('/swaps/:id/cancel', async (request: FastifyRequest<{ Params: unknown }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    const swap = await prisma.shiftSwapRequest.findUnique({ where: { id } })
    if (!swap) return { code: 404, message: '换班申请不存在' }
    if (swap.requesterId !== request.user.id) return { code: 403, message: '只有申请人可以取消' }
    if (swap.status !== 'pending') return { code: 400, message: '该申请已处理' }

    await prisma.shiftSwapRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    })

    return { code: 0, message: '换班申请已取消' }
  })
}
