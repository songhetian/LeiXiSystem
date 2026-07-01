import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { validateData, idParamsSchema } from '../utils/validation'

export default async function operationsDashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // GET /api/dashboard/operations - 运营仪表盘全量指标
  fastify.get('/operations', async (request) => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86400000)

    const [queueCount, slaStats, ticketStats, satisfactionAvg, attendanceStats, scheduleStats] =
      await Promise.all([
        // 排队工单数
        prisma.ticketQueue.count({ where: { status: 'waiting' } }),

        // SLA合规率(本周)
        prisma.helpdeskTicket.count({
          where: {
            slaStatus: 'breached',
            updatedAt: { gte: weekStart },
          },
        }).then(breached => {
          return prisma.helpdeskTicket.count({
            where: { slaId: { not: null }, updatedAt: { gte: weekStart } },
          }).then(total => ({ breached, total }))
        }),

        // 工单统计(今日)
        Promise.all([
          prisma.helpdeskTicket.count({ where: { createdAt: { gte: todayStart } } }),
          prisma.helpdeskTicket.count({ where: { status: 'resolved', resolvedAt: { gte: todayStart } } }),
          prisma.helpdeskTicket.count({ where: { status: 'closed', closedAt: { gte: todayStart } } }),
        ]),

        // 满意度均分(本周)
        prisma.helpdeskTicket.aggregate({
          where: { satisfactionRating: { not: null }, satisfactionSubmittedAt: { gte: weekStart } },
          _avg: { satisfactionRating: true },
        }),

        // 考勤统计(今日)
        Promise.all([
          prisma.employee.count({ where: { status: 'active' } }),
          prisma.attendanceCheckin.groupBy({
            by: ['employeeId'],
            where: { checkTime: { gte: todayStart } },
          }).then(r => r.length),
          prisma.leaveRequest.count({
            where: { status: 'approved', startDate: { gte: todayStart } },
          }),
          prisma.overtimeRequest.aggregate({
            where: { status: 'approved', date: { gte: weekStart } },
            _sum: { hours: true, overtimePay: true },
          }),
        ]),

        // 排班偏差(本周)
        Promise.all([
          prisma.schedule.count({ where: { scheduleDate: { gte: weekStart } } }),
          prisma.attendanceCheckin.groupBy({
            by: ['employeeId'],
            where: { checkTime: { gte: weekStart } },
          }).then(r => r.length),
        ]),
      ])

    const [createdToday, resolvedToday, closedToday] = ticketStats
    const [totalEmployees, checkedInToday, onLeaveToday, overtimeStats] = attendanceStats
    const [scheduledCount, actualAttendanceCount] = scheduleStats

    const avgRating = satisfactionAvg._avg.satisfactionRating
      ? Math.round(Number(satisfactionAvg._avg.satisfactionRating) * 100) / 100
      : null

    const deviationRate = scheduledCount > 0
      ? Math.round((1 - actualAttendanceCount / scheduledCount) * 10000) / 100
      : 0

    // 告警阈值
    const alertConfigs = await prisma.dashboardAlertConfig.findMany({ where: { enabled: true } })

    // 指标数据
    const metrics = {
      customerService: {
        queueLength: queueCount,
        slaComplianceRate: slaStats.total > 0
          ? Math.round((1 - slaStats.breached / slaStats.total) * 10000) / 100
          : 100,
        slaTotal: slaStats.total,
        slaBreached: slaStats.breached,
        ticketsCreated: createdToday,
        ticketsResolved: resolvedToday,
        ticketsClosed: closedToday,
        resolutionRate: createdToday > 0
          ? Math.round((resolvedToday / createdToday) * 10000) / 100
          : 100,
        avgSatisfaction: avgRating,
      },
      schedule: {
        totalEmployees,
        presentToday: checkedInToday,
        attendanceRate: totalEmployees > 0
          ? Math.round((checkedInToday / totalEmployees) * 10000) / 100
          : 0,
        onLeave: onLeaveToday,
        deviationRate,
      },
      workforce: {
        overtimeHours: Number(overtimeStats._sum.hours || 0),
        overtimePay: Number(overtimeStats._sum.overtimePay || 0),
      },
    }

    // 检查告警
    const alerts: any[] = []
    const thresholds: Record<string, { warn: number; critical: number }> = {}

    for (const cfg of alertConfigs) {
      thresholds[cfg.metricKey] = {
        warn: Number(cfg.warnThreshold || 0),
        critical: Number(cfg.criticalThreshold || 0),
      }
      let currentValue = 0
      switch (cfg.metricKey) {
        case 'queue_length': currentValue = queueCount; break
        case 'sla_breach_rate': currentValue = slaStats.total > 0 ? (slaStats.breached / slaStats.total) * 100 : 0; break
        case 'absence_count': currentValue = onLeaveToday; break
        case 'deviation_rate': currentValue = deviationRate; break
        case 'satisfaction_avg': currentValue = avgRating || 0; break
        default: continue
      }

      const op = cfg.comparisonOperator || '>='
      const criticalVal = Number(cfg.criticalThreshold || 0)
      const warnVal = Number(cfg.warnThreshold || 0)

      if (evalAlert(currentValue, op, criticalVal)) {
        alerts.push({ metricKey: cfg.metricKey, metricName: cfg.metricName, currentValue, threshold: criticalVal, level: 'critical' })
      } else if (evalAlert(currentValue, op, warnVal)) {
        alerts.push({ metricKey: cfg.metricKey, metricName: cfg.metricName, currentValue, threshold: warnVal, level: 'warning' })
      }
    }

    return { code: 0, data: { metrics, alerts, thresholds, updatedAt: now.toISOString() } }
  })

  // GET /api/dashboard/operations/alert-thresholds
  fastify.get('/operations/alert-thresholds', async (request) => {
    const configs = await prisma.dashboardAlertConfig.findMany({ orderBy: { metricKey: 'asc' } })
    return { code: 0, data: configs }
  })

  // PUT /api/dashboard/operations/alert-thresholds/:id
  fastify.put('/operations/alert-thresholds/:id', { preHandler: [requirePermission('settings:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    const body = request.body as any
    const updateData: any = {}
    if (body.warnThreshold !== undefined) updateData.warnThreshold = body.warnThreshold
    if (body.criticalThreshold !== undefined) updateData.criticalThreshold = body.criticalThreshold
    if (body.enabled !== undefined) updateData.enabled = body.enabled
    updateData.updatedBy = (request as any).user.id

    const data = await prisma.dashboardAlertConfig.update({ where: { id }, data: updateData })
    return { code: 0, data }
  })
}

function evalAlert(current: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>=': return current >= threshold
    case '<=': return current <= threshold
    case '>': return current > threshold
    case '<': return current < threshold
    default: return current >= threshold
  }
}
