import { FastifyInstance } from 'fastify'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/stats', async () => {
    const [totalUsers, activeUsers, totalDepartments, totalPositions] = await Promise.all([
      prisma.user.count({ where: { status: { not: 'deleted' } } }),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.department.count({ where: { status: 'active' } }),
      prisma.position.count({ where: { status: 'active' } }),
    ])

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayAttendance, pendingLeaves, pendingReimb, pendingOvertime] = await Promise.all([
      prisma.attendanceRecord.count({ where: { date: today } }),
      prisma.leaveRequest.count({ where: { status: 'pending' } }),
      prisma.reimbursement.count({ where: { status: 'pending' } }),
      prisma.overtimeRequest.count({ where: { status: 'pending' } }),
    ])
    const pendingApprovals = pendingLeaves + pendingReimb + pendingOvertime

    return {
      code: 0,
      data: {
        totalUsers,
        activeUsers,
        totalDepartments,
        totalPositions,
        todayAttendance,
        pendingApprovals,
      },
    }
  })

  fastify.get('/attendance-overview', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const records = await prisma.attendanceRecord.findMany({
      where: { date: today },
      include: { employee: { include: { user: { include: { department: true } } } } },
    })

    const total = records.length
    const normal = records.filter((r) => r.status === 'normal').length
    const late = records.filter((r) => r.status === 'late').length
    const early = records.filter((r) => r.status === 'early').length
    const absent = records.filter((r) => r.status === 'absent').length

    return {
      code: 0,
      data: {
        date: today,
        total,
        normal,
        late,
        early,
        absent,
        attendanceRate: total > 0 ? ((normal / total) * 100).toFixed(1) : '0',
        recentList: records.slice(0, 8).map((r) => ({
          id: r.id,
          name: r.employee.user.realName,
          department: r.employee.user.department?.name,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status,
        })),
      },
    }
  })

  fastify.get('/todos', async () => {
    const leaves = await prisma.leaveRequest.findMany({
      where: { status: 'pending' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { employee: { include: { user: true } } },
    })

    const reimbursements = await prisma.reimbursement.findMany({
      where: { status: 'pending' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { employee: { include: { user: true } } },
    })

    const todos = [
      ...leaves.map((l) => ({
        id: l.id,
        type: 'leave',
        typeName: '请假申请',
        title: `${l.leaveType} - ${l.days}天`,
        applicant: l.employee.user.realName,
        createdAt: l.createdAt,
      })),
      ...reimbursements.map((r) => ({
        id: r.id,
        type: 'reimbursement',
        typeName: '报销申请',
        title: `${r.title} - ¥${r.amount}`,
        applicant: r.employee.user.realName,
        createdAt: r.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return { code: 0, data: todos.slice(0, 10) }
  })
}
