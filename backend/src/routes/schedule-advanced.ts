import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import dayjs from 'dayjs'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { idParamsSchema, validateData } from '../utils/validation'

const patternBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  cycleDays: z.coerce.number().int().min(1).max(90),
  shiftSequence: z.any(), // JSON array
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.string().optional().default('active'),
})

const groupBodySchema = z.object({
  groupName: z.string().trim().min(1).max(100),
  startOffsetDays: z.coerce.number().int().min(0).optional().default(0),
  memberIds: z.array(z.coerce.number().int().positive()).min(1),
})

export default async function rotationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // GET /api/schedule/rotations
  fastify.get('/rotations', async (request) => {
    const patterns = await prisma.rotationPattern.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
    })
    return { code: 0, data: patterns }
  })

  // POST /api/schedule/rotations
  fastify.post('/rotations', { preHandler: [requirePermission('schedule:manage')] }, async (request) => {
    const body = validateData(patternBodySchema, request.body)
    const data = await prisma.rotationPattern.create({
      data: { ...body, startDate: new Date(body.startDate) },
    })
    return { code: 0, data }
  })

  // PUT /api/schedule/rotations/:id
  fastify.put('/rotations/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    const body = request.body as any
    const updateData: any = {}
    if (body.name) updateData.name = body.name
    if (body.cycleDays) updateData.cycleDays = body.cycleDays
    if (body.shiftSequence) updateData.shiftSequence = body.shiftSequence
    if (body.startDate) updateData.startDate = new Date(body.startDate)
    if (body.status) updateData.status = body.status

    const data = await prisma.rotationPattern.update({ where: { id }, data: updateData })
    return { code: 0, data }
  })

  // DELETE /api/schedule/rotations/:id
  fastify.delete('/rotations/:id', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id)
    await prisma.rotationPattern.delete({ where: { id } })
    return { code: 0, message: '删除成功' }
  })

  // GET /api/schedule/rotations/:id/groups
  fastify.get('/rotations/:id/groups', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const patternId = parseInt(request.params.id)
    const groups = await prisma.rotationGroup.findMany({
      where: { patternId },
    })
    return { code: 0, data: groups }
  })

  // POST /api/schedule/rotations/:id/groups
  fastify.post('/rotations/:id/groups', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const patternId = parseInt(request.params.id)
    const body = validateData(groupBodySchema, request.body)

    const group = await prisma.rotationGroup.create({
      data: {
        patternId,
        groupName: body.groupName,
        startOffsetDays: body.startOffsetDays,
        members: {
          create: body.memberIds.map(employeeId => ({ employeeId })),
        },
      },
    })

    return { code: 0, data: group }
  })

  // DELETE /api/schedule/rotations/groups/:groupId
  fastify.delete('/rotations/groups/:groupId', { preHandler: [requirePermission('schedule:manage')] }, async (request: FastifyRequest<{ Params: { groupId: string } }>) => {
    const groupId = parseInt(request.params.groupId)
    await prisma.rotationGroup.delete({ where: { id: groupId } })
    return { code: 0, message: '删除成功' }
  })

  // POST /api/schedule/rotations/:id/generate - 基于轮转生成排班
  fastify.post('/rotations/:id/generate', { preHandler: [requirePermission('schedule:assign')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const patternId = parseInt(request.params.id)
    const pattern = await prisma.rotationPattern.findUnique({
      where: { id: patternId },
    })
    if (!pattern) return { code: 404, message: '轮转模式不存在' }

    const shiftSequence = pattern.shiftSequence as any[]
    if (!shiftSequence || shiftSequence.length === 0) return { code: 400, message: '轮转序列为空' }

    const cycleDays = pattern.cycleDays
    const startDate = pattern.startDate
    const daysToGenerate = 30 // 默认生成30天

    let generated = 0
    const schedules: any[] = []

    // Fetch groups for this pattern
    const groups = await prisma.rotationGroup.findMany({
      where: { patternId },
    })

    for (const group of groups) {
      // Fetch members
      const members = await prisma.rotationGroupMember.findMany({
        where: { groupId: group.id },
      })

      for (let day = 0; day < daysToGenerate; day++) {
        const currentDate = new Date(startDate.getTime() + (day + group.startOffsetDays) * 86400000)
        const cyclePosition = Math.floor(day / cycleDays) % shiftSequence.length
        const shiftEntry = shiftSequence[cyclePosition]

        if (shiftEntry) {
          const shiftId = shiftEntry.shiftId
          for (const member of members) {
            // Get or create user
            const employee = await prisma.employee.findUnique({
              where: { id: member.employeeId },
              select: { userId: true },
            })
            if (employee) {
              schedules.push({
                userId: employee.userId,
                scheduleDate: currentDate,
                shiftId,
                source: 'rotation',
              })
            }
          }
        }
      }
    }

    // Batch create schedules
    if (schedules.length > 0) {
      await prisma.schedule.createMany({ data: schedules, skipDuplicates: true })
      generated = schedules.length
    }

    return { code: 0, message: `成功生成 ${generated} 条排班记录`, data: { generated } }
  })

  // ══════════════════════════════════════════════
  // Schedule Version Comparison (G6)
  // ══════════════════════════════════════════════

  // GET /api/schedule/versions
  fastify.get('/versions', async (request: FastifyRequest<{
    Querystring: { scheduleDate?: string; departmentId?: number }
  }>) => {
    const query = request.query as any
    const where: any = {}
    if (query.scheduleDate) where.scheduleDate = new Date(query.scheduleDate)
    if (query.departmentId) where.departmentId = parseInt(query.departmentId)

    const versions = await prisma.scheduleVersion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return { code: 0, data: versions }
  })

  // POST /api/schedule/snapshot
  fastify.post('/snapshot', { preHandler: [requirePermission('schedule:manage')] }, async (request) => {
    const body = request.body as any
    const user = (request as any).user

    const where: any = {}
    if (body.departmentId) where.user = { departmentId: body.departmentId }
    if (body.scheduleDate) where.scheduleDate = new Date(body.scheduleDate)

    const schedules = await prisma.schedule.findMany({
      where,
      include: { shift: { select: { id: true, name: true } }, user: { select: { id: true, realName: true } } },
    })

    const snapshotData = schedules.map(s => ({
      employeeId: s.userId,
      employeeName: s.user.realName,
      date: dayjs(s.scheduleDate).format('YYYY-MM-DD'),
      shiftId: s.shiftId,
      shiftName: s.shift?.name,
    }))

    const version = await prisma.scheduleVersion.create({
      data: {
        name: body.name || `排班快照 ${dayjs().format('YYYY-MM-DD HH:mm')}`,
        versionType: body.versionType || 'manual',
        departmentId: body.departmentId,
        scheduleDate: body.scheduleDate ? new Date(body.scheduleDate) : new Date(),
        snapshotData,
        employeeCount: schedules.length,
        generatedBy: 'manual',
      },
    })

    return { code: 0, data: version, message: `快照已创建，含 ${schedules.length} 条排班记录` }
  })

  // GET /api/schedule/compare
  fastify.get('/compare', async (request: FastifyRequest<{
    Querystring: { versionA: number; versionB: number }
  }>) => {
    const query = request.query as any
    const versionA = await prisma.scheduleVersion.findUnique({ where: { id: parseInt(query.versionA) } })
    const versionB = await prisma.scheduleVersion.findUnique({ where: { id: parseInt(query.versionB) } })

    if (!versionA || !versionB) return { code: 404, message: '版本不存在' }

    const dataA = (versionA.snapshotData as any[]) || []
    const dataB = (versionB.snapshotData as any[]) || []

    // Build maps keyed by "employeeId_date"
    const mapA = new Map<string, any>()
    const mapB = new Map<string, any>()

    for (const item of dataA) mapA.set(`${item.employeeId}_${item.date}`, item)
    for (const item of dataB) mapB.set(`${item.employeeId}_${item.date}`, item)

    const allKeys = new Set([...mapA.keys(), ...mapB.keys()])
    const differences: any[] = []
    let changed = 0, added = 0, removed = 0

    for (const key of allKeys) {
      const a = mapA.get(key)
      const b = mapB.get(key)
      if (a && b) {
        if (a.shiftId !== b.shiftId) {
          differences.push({ key, type: 'changed', a, b })
          changed++
        }
      } else if (a && !b) {
        differences.push({ key, type: 'removed', a })
        removed++
      } else if (!a && b) {
        differences.push({ key, type: 'added', b })
        added++
      }
    }

    return {
      code: 0,
      data: {
        versionA: { id: versionA.id, name: versionA.name, count: dataA.length },
        versionB: { id: versionB.id, name: versionB.name, count: dataB.length },
        summary: { total: allKeys.size, changed, added, removed, unchanged: allKeys.size - changed - added - removed },
        differences,
      },
    }
  })

  // POST /api/schedule/deviation-report
  fastify.post('/deviation-report', { preHandler: [requirePermission('schedule:manage')] }, async (request) => {
    const body = request.body as any
    const { versionId, startDate, endDate } = body

    const version = await prisma.scheduleVersion.findUnique({ where: { id: versionId } })
    if (!version) return { code: 404, message: '版本不存在' }

    const sd = startDate ? new Date(startDate) : new Date()
    const ed = endDate ? new Date(endDate) : new Date(sd.getTime() + 30 * 86400000)

    // Get all scheduled employees
    const snapshotData = (version.snapshotData as any[]) || []
    const employeeIds = [...new Set(snapshotData.map((s: any) => s.employeeId))]

    // Get actual attendance for those employees
    const checkins = await prisma.attendanceCheckin.findMany({
      where: {
        employeeId: { in: [...new Set(employeeIds.map((id: any) => {
          const emp = snapshotData.find((s: any) => s.employeeId === id)
          return emp ? undefined : id
        }).filter(Boolean))] },
      },
    })

    // Match checkins to schedule
    let totalPlanned = snapshotData.length
    let onTime = 0, late = 0, earlyLeave = 0, absent = 0

    const checkinIds = new Set(checkins.map(c => c.employeeId))

    for (const item of snapshotData) {
      const empCheckins = checkins.filter(c => c.employeeId === item.employeeId)
      if (empCheckins.length === 0) {
        absent++
      } else {
        const firstCheckin = empCheckins.sort((a: any, b: any) => a.checkTime.getTime() - b.checkTime.getTime())[0]
        // Simple check: just verify they checked in
        onTime++
      }
    }

    const deviationRate = totalPlanned > 0 ? Math.round((absent / totalPlanned) * 10000) / 100 : 0

    const report = await prisma.scheduleDeviationReport.create({
      data: {
        scheduleVersionId: versionId,
        periodStart: sd,
        periodEnd: ed,
        totalPlanned,
        totalActual: totalPlanned - absent,
        onTimeCount: onTime,
        lateCount: late,
        earlyLeaveCount: earlyLeave,
        absentCount: absent,
        deviationRate,
        detail: { checkinIds: Array.from(checkinIds) },
        reportDate: new Date(),
      },
    })

    return {
      code: 0,
      data: { ...report, summary: `偏差率 ${deviationRate}%` },
    }
  })
}

