import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { authMiddleware } from '../../middleware/auth'
import { requirePermission } from '../../middleware/permission'
import { dateStringSchema, positiveIntSchema, validateData } from '../../utils/validation'
import { generateScheduleRecommendations, applyRecommendations, RecommendResult } from '../../services/schedule-engine'

const recommendQuerySchema = z.object({
  departmentId: z.coerce.number().int().positive().optional(),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  ruleId: positiveIntSchema.optional(),
  excludeEmployeeIds: z.string().optional().transform((val) => {
    if (!val) return []
    return val.split(',').map(Number).filter(Boolean)
  }),
})

const applyRecommendSchema = z.object({
  recommendations: z.array(z.object({
    employeeId: positiveIntSchema,
    scheduleDate: dateStringSchema,
    shiftId: positiveIntSchema,
    confidence: z.number().min(0).max(1).optional(),
    conflicts: z.array(z.string()).optional(),
  })).min(1).max(1000),
})

export default async function scheduleRecommendRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // 生成智能推荐
  fastify.post('/recommend', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const params = validateData(recommendQuerySchema, request.body)

    // 验证日期范围
    const start = new Date(params.startDate)
    const end = new Date(params.endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
    if (days > 366) {
      return { code: 400, message: '日期范围不能超过366天' }
    }
    if (start > end) {
      return { code: 400, message: '开始日期不能晚于结束日期' }
    }

    const result: RecommendResult = await generateScheduleRecommendations({
      departmentId: params.departmentId,
      startDate: params.startDate,
      endDate: params.endDate,
      ruleId: params.ruleId,
      excludeEmployeeIds: params.excludeEmployeeIds,
    })

    return { code: 0, data: result }
  })

  // 应用推荐方案
  fastify.post('/recommend/apply', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(applyRecommendSchema, request.body)

    // 获取员工和班次信息
    const employeeIds = body.recommendations.map(r => r.employeeId)
    const shiftIds = body.recommendations.map(r => r.shiftId)
    
    const [employees, shifts] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, userId: true },
      }),
      prisma.shift.findMany({
        where: { id: { in: shiftIds } },
        select: { id: true, name: true, color: true },
      }),
    ])

    const empMap = new Map(employees.map(e => [e.id, e.userId]))
    const shiftMap = new Map(shifts.map(s => [s.id, s]))

    // 转换为 ScheduleRecommendation 格式
    const recommendations = body.recommendations.map(r => {
      const shift = shiftMap.get(r.shiftId)
      return {
        employeeId: r.employeeId,
        employeeNo: '',
        realName: '',
        scheduleDate: r.scheduleDate,
        shiftId: r.shiftId,
        shiftName: shift?.name || '',
        shiftColor: shift?.color || undefined,
        confidence: r.confidence || 0,
        conflicts: r.conflicts || [],
      }
    })

    const { successCount, failedCount } = await applyRecommendations(
      recommendations,
      request.user.id
    )

    return {
      code: 0,
      message: `应用成功：${successCount} 条，失败：${failedCount} 条`,
      data: { successCount, failedCount },
    }
  })

  // 批量应用推荐方案（根据生成的推荐直接应用）
  fastify.post('/recommend/batch-apply', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const params = validateData(recommendQuerySchema, request.body)

    // 先生成推荐
    const result = await generateScheduleRecommendations({
      departmentId: params.departmentId,
      startDate: params.startDate,
      endDate: params.endDate,
      ruleId: params.ruleId,
      excludeEmployeeIds: params.excludeEmployeeIds,
    })

    // 直接应用所有推荐
    const { successCount, failedCount } = await applyRecommendations(
      result.recommendations,
      request.user.id
    )

    return {
      code: 0,
      message: `批量应用完成：成功 ${successCount} 条，失败 ${failedCount} 条`,
      data: {
        successCount,
        failedCount,
        warnings: result.warnings,
        statistics: result.statistics,
      },
    }
  })

  // 检查排班冲突
  fastify.post('/check-conflicts', { preHandler: [requirePermission('schedule:view')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const params = validateData(z.object({
      departmentId: z.coerce.number().int().positive().optional(),
      startDate: dateStringSchema,
      endDate: dateStringSchema,
    }), request.body)

    // 生成推荐并只返回冲突警告
    const result = await generateScheduleRecommendations({
      departmentId: params.departmentId,
      startDate: params.startDate,
      endDate: params.endDate,
    })

    const hardConflicts = result.warnings.filter((w) => w.type === 'hard')
    const softConflicts = result.warnings.filter((w) => w.type === 'soft')

    return {
      code: 0,
      data: {
        hardConflicts,
        softConflicts,
        totalHardConflicts: hardConflicts.length,
        totalSoftConflicts: softConflicts.length,
      },
    }
  })
}
