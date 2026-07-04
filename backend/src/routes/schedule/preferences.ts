import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requireAnyPermission } from '../../middleware/permission'
import { positiveIntSchema, validateData } from '../../utils/validation'

const preferenceUpdateSchema = z.object({
  preferredShiftId: positiveIntSchema.optional().nullable(),
  preferredDays: z.string().max(100).optional().nullable(),
  avoidDays: z.string().max(100).optional().nullable(),
  avoidDates: z.string().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

export default async function schedulePreferenceRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 获取当前用户的排班偏好
  fastify.get('/preferences/me', async (request) => {
    const employeeId = request.user.employeeId
    if (!employeeId) return { code: 400, message: '当前用户未关联员工' }
    
    const preference = await prisma.employeeSchedulePreference.findUnique({
      where: { employeeId },
      include: {
        preferredShift: { select: { id: true, name: true, color: true } },
      },
    })
    return { code: 0, data: preference }
  })

  // 更新当前用户的排班偏好
  fastify.put('/preferences/me', async (request: FastifyRequest<{ Body: unknown }>) => {
    const employeeId = request.user.employeeId
    if (!employeeId) return { code: 400, message: '当前用户未关联员工' }
    
    const body = validateData(preferenceUpdateSchema, request.body)

    const preference = await prisma.employeeSchedulePreference.upsert({
      where: { employeeId },
      create: {
        employeeId,
        ...body,
      },
      update: body,
    })

    return { code: 0, message: '保存成功', data: preference }
  })

  // 获取指定员工的排班偏好（管理员）
  fastify.get('/preferences/:employeeId', { preHandler: [requireAnyPermission(['schedule:view', 'schedule:assign', 'schedule:manage'])] }, async (request: FastifyRequest<{ Params: unknown }>) => {
    const { employeeId } = validateData(z.object({ employeeId: positiveIntSchema }), request.params)

    const preference = await prisma.employeeSchedulePreference.findUnique({
      where: { employeeId },
      include: {
        preferredShift: { select: { id: true, name: true, color: true } },
        employee: {
          select: {
            id: true,
            employeeNo: true,
            user: { select: { realName: true } },
          },
        },
      },
    })

    return { code: 0, data: preference }
  })

  // 批量设置员工偏好
  fastify.post('/preferences/batch', { preHandler: [requireAnyPermission(['schedule:manage'])] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const { employeeIds, ...prefs } = validateData(z.object({
      employeeIds: z.array(positiveIntSchema).min(1).max(100),
      preferredShiftId: positiveIntSchema.optional().nullable(),
      preferredDays: z.string().max(100).optional().nullable(),
      avoidDays: z.string().max(100).optional().nullable(),
      avoidDates: z.string().max(500).optional().nullable(),
      notes: z.string().trim().max(500).optional().nullable(),
    }), request.body)

    const results = []
    for (const employeeId of employeeIds) {
      const preference = await prisma.employeeSchedulePreference.upsert({
        where: { employeeId },
        create: { employeeId, ...prefs },
        update: prefs,
      })
      results.push(preference)
    }

    return { code: 0, message: `成功更新 ${results.length} 条偏好设置`, data: results }
  })
}
