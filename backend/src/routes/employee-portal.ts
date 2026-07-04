import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, validateData, statusSchema } from '../utils/validation'
import dayjs from 'dayjs'

export default async function employeePortalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // ══════════════════════════════════════════════
  // 员工自助门户首页
  // ══════════════════════════════════════════════

  // GET /api/employee/dashboard
  fastify.get('/dashboard', async (request) => {
    const user = (request as any).user
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })
    if (!employee) return { code: 404, message: '未找到员工记录' }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - todayStart.getDay() * 86400000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      todaySchedule,
      todayCheckin,
      monthAttendance,
      activeTickets,
      vacationBalances,
      overtimeTotal,
      pendingConfirmations,
    ] = await Promise.all([
      // 今日排班
      prisma.schedule.findFirst({
        where: { userId: user.id, scheduleDate: todayStart },
        include: { shift: { select: { name: true, startTime: true, endTime: true } } },
      }),

      // 今日签到
      prisma.attendanceCheckin.findFirst({
        where: { employeeId: employee.id, checkTime: { gte: todayStart } },
        orderBy: { checkTime: 'desc' },
      }),

      // 本月出勤统计
      prisma.attendanceCheckin.groupBy({
        by: ['employeeId'],
        where: { employeeId: employee.id, checkTime: { gte: monthStart } },
      }).then(r => r.length),

      // 活跃工单
      prisma.helpdeskTicket.findMany({
        where: { assignedTo: user.id, status: { in: ['open', 'processing'] } },
        select: { id: true, ticketNo: true, title: true, priority: true, slaStatus: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // 假期余额
      prisma.vacationBalance.findMany({
        where: { employeeId: employee.id },
        select: { id: true, total: true, used: true, balance: true, vacationType: { select: { id: true, name: true } } },
      }),

      // 本周加班
      prisma.overtimeRequest.aggregate({
        where: { employeeId: employee.id, status: 'approved', date: { gte: weekStart } },
        _sum: { hours: true },
      }),

      // 待确认排班
      prisma.scheduleConfirmation.count({
        where: { userId: user.id, status: 'pending' },
      }),
    ])

    return {
      code: 0,
      data: {
        employee: { id: employee.id, employeeNo: employee.employeeNo, status: employee.status },
        todaySchedule: todaySchedule ? {
          shiftName: todaySchedule.shift?.name,
          startTime: todaySchedule.shift?.startTime,
          endTime: todaySchedule.shift?.endTime,
        } : null,
        todayCheckin: todayCheckin ? {
          checkTime: todayCheckin.checkTime,
          logType: todayCheckin.logType,
        } : null,
        attendance: {
          monthDays: monthAttendance,
          overtimeHours: Number(overtimeTotal._sum.hours || 0),
        },
        activeTickets: {
          count: activeTickets.length,
          list: activeTickets,
        },
        vacationBalances: vacationBalances.map(b => ({
          typeId: b.vacationType.id,
          typeName: b.vacationType.name,
          total: Number(b.total),
          used: Number(b.used),
          remaining: Number(b.balance),
        })),
        pendingConfirmations,
      },
    }
  })

  // ══════════════════════════════════════════════
  // 我的排班
  // ══════════════════════════════════════════════

  // GET /api/employee/my-schedule
  fastify.get('/my-schedule', async (request: FastifyRequest<{
    Querystring: { startDate?: string; endDate?: string }
  }>) => {
    const user = (request as any).user
    const query = request.query as any
    const startDate = query.startDate ? new Date(query.startDate) : new Date()
    startDate.setHours(0, 0, 0, 0)
    const endDate = query.endDate
      ? new Date(query.endDate)
      : new Date(startDate.getTime() + 7 * 86400000)

    const schedules = await prisma.schedule.findMany({
      where: {
        userId: user.id,
        scheduleDate: { gte: startDate, lte: endDate },
      },
      include: { shift: { select: { name: true, startTime: true, endTime: true, color: true } } },
      orderBy: { scheduleDate: 'asc' },
    })

    return { code: 0, data: schedules }
  })

  // ══════════════════════════════════════════════
  // 我的考勤
  // ══════════════════════════════════════════════

  // GET /api/employee/my-attendance
  fastify.get('/my-attendance', async (request: FastifyRequest<{
    Querystring: { month?: string; year?: number }
  }>) => {
    const user = (request as any).user
    const employee = await prisma.employee.findUnique({ where: { userId: user.id } })
    if (!employee) return { code: 404, message: '未找到员工记录' }

    const now = new Date()
    const year = parseInt(request.query.year as any) || now.getFullYear()
    const month = parseInt(request.query.month as any) || now.getMonth() + 1
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 0, 23, 59, 59)

    const checkins = await prisma.attendanceCheckin.findMany({
      where: {
        employeeId: employee.id,
        checkTime: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { checkTime: 'desc' },
    })

    return { code: 0, data: { year, month, checkins } }
  })

  // ══════════════════════════════════════════════
  // 我的薪资（需二级密码）
  // ══════════════════════════════════════════════

  // POST /api/employee/verify-password
  fastify.post('/verify-password', async (request) => {
    const user = (request as any).user
    const { password } = request.body as any
    if (!password) return { code: 400, message: '请输入二级密码' }

    const pwd = await prisma.payslipPassword.findUnique({ where: { userId: user.id } })
    if (!pwd) return { code: 404, message: '请先设置二级密码' }

    const valid = await bcrypt.compare(password, pwd.passwordHash)
    return valid ? { code: 0, message: '验证成功' } : { code: 401, message: '密码错误' }
  })

  // POST /api/employee/set-password
  fastify.post('/set-password', async (request) => {
    const user = (request as any).user
    const { password } = request.body as any
    if (!password || password.length !== 6 || !/^\d+$/.test(password)) {
      return { code: 400, message: '二级密码必须为6位数字' }
    }

    const hash = await bcrypt.hash(password, 10)
    await prisma.payslipPassword.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash: hash },
      update: { passwordHash: hash },
    })

    return { code: 0, message: '二级密码设置成功' }
  })

  // GET /api/employee/my-salary - 当月预估薪资
  fastify.get('/my-salary', async (request) => {
    const user = (request as any).user
    const employee = await prisma.employee.findUnique({ where: { userId: user.id } })
    if (!employee) return { code: 404, message: '未找到员工记录' }

    const salaryProfile = await prisma.employeeSalaryProfile.findFirst({
      where: { employeeId: employee.id, status: 'active' },
      orderBy: { effectiveFrom: 'desc' },
    })

    // 当月加班费
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const overtimeAgg = await prisma.overtimeRequest.aggregate({
      where: {
        employeeId: employee.id,
        status: 'approved',
        settlementStatus: { in: ['pending', 'settled'] },
        date: { gte: monthStart },
      },
      _sum: { overtimePay: true },
    })

    return {
      code: 0,
      data: {
        baseSalary: salaryProfile ? Number(salaryProfile.baseSalary) : null,
        monthOvertimePay: Number(overtimeAgg._sum.overtimePay || 0),
        estimatedTotal: salaryProfile
          ? Number(salaryProfile.baseSalary) + Number(overtimeAgg._sum.overtimePay || 0)
          : null,
      },
    }
  })

  // GET /api/employee/payslips
  fastify.get('/payslips', async (request: FastifyRequest<{
    Querystring: { year?: number }
  }>) => {
    const user = (request as any).user
    const employee = await prisma.employee.findUnique({ where: { userId: user.id } })
    if (!employee) return { code: 404, message: '未找到员工记录' }

    const year = parseInt(request.query.year as any) || new Date().getFullYear()

    const payslips = await prisma.payslip.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    })

    return { code: 0, data: payslips }
  })

  // ══════════════════════════════════════════════
  // 生命周期流程
  // ══════════════════════════════════════════════

  // GET /api/employee/lifecycle/tasks - 生命周期流程列表
  fastify.get('/lifecycle', async (request: FastifyRequest<{
    Querystring: { type?: string }
  }>) => {
    const user = (request as any).user
    const type = (request.query as any).type

    const employee = await prisma.employee.findUnique({ where: { userId: user.id } })
    if (!employee) return { code: 404, message: '未找到员工记录' }

    const where: any = { employeeId: employee.id }
    if (type) where.type = type

    const lifecycles = await prisma.employeeLifecycle.findMany({
      where,
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { startDate: 'desc' },
    })

    return { code: 0, data: lifecycles }
  })

  // GET /api/employee/lifecycle/task-templates
  fastify.get('/lifecycle/task-templates', async (request: FastifyRequest<{
    Querystring: { type?: string }
  }>) => {
    const type = (request.query as any).type
    const where: any = { status: 'active' }
    if (type) where.type = type

    const templates = await prisma.lifecycleTaskTemplate.findMany({
      where,
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    })

    return { code: 0, data: templates }
  })

  // POST /api/employee/lifecycle/task-templates
  fastify.post('/lifecycle/task-templates', { preHandler: [requirePermission('lifecycle:manage')] }, async (request) => {
    const body = request.body as any
    const template = await prisma.lifecycleTaskTemplate.create({
      data: {
        name: body.name,
        type: body.type,
        tasks: {
          create: (body.tasks || []).map((t: any) => ({
            taskName: t.taskName,
            assignedRole: t.assignedRole,
            sortOrder: t.sortOrder,
            dependsOnSort: t.dependsOnSort,
            autoTrigger: t.autoTrigger !== false,
            deadlineDays: t.deadlineDays || 1,
            description: t.description,
          })),
        },
      },
      include: { tasks: true },
    })
    return { code: 0, data: template }
  })

  // POST /api/employee/lifecycle/start - 启动入职/离职流程
  fastify.post('/lifecycle/start', { preHandler: [requirePermission('lifecycle:manage')] }, async (request) => {
    const body = request.body as any
    const { employeeId, templateId, type, startDate } = body

    const template = await prisma.lifecycleTaskTemplate.findUnique({
      where: { id: templateId },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!template) return { code: 404, message: '模板不存在' }

    const lifecycle = await prisma.employeeLifecycle.create({
      data: {
        employeeId,
        type: type || template.type,
        templateId,
        startDate: startDate ? new Date(startDate) : new Date(),
        tasks: {
          create: template.tasks.map(t => ({
            taskName: t.taskName,
            assignedRole: t.assignedRole,
            sortOrder: t.sortOrder,
            dependsOn: null, // Will be linked after creation
            status: t.sortOrder === 1 ? 'in_progress' : 'pending', // First task starts immediately
            deadline: new Date(Date.now() + t.deadlineDays * 86400000),
          })),
        },
      },
      include: { tasks: true },
    })

    return { code: 0, data: lifecycle }
  })

  // PUT /api/employee/lifecycle/tasks/:taskId/complete
  fastify.put('/lifecycle/tasks/:taskId/complete', async (request: FastifyRequest<{ Params: { taskId: string } }>) => {
    const taskId = parseInt(request.params.taskId)
    const user = (request as any).user
    const body = request.body as any || {}

    const task = await prisma.lifecycleTask.findUnique({
      where: { id: taskId },
      include: { lifecycle: { include: { tasks: true } } },
    })
    if (!task) return { code: 404, message: '任务不存在' }

    await prisma.lifecycleTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedBy: user.id,
        completedAt: new Date(),
        note: body.note,
      },
    })

    // Auto-trigger next task
    const nextTasks = task.lifecycle.tasks
      .filter(t => t.status === 'pending' && t.sortOrder > task.sortOrder)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    if (nextTasks.length > 0) {
      await prisma.lifecycleTask.update({
        where: { id: nextTasks[0].id },
        data: { status: 'in_progress' },
      })
    } else {
      // All tasks completed
      await prisma.employeeLifecycle.update({
        where: { id: task.lifecycle.id },
        data: { status: 'completed', completedAt: new Date() },
      })
    }

    return { code: 0, message: '任务完成' }
  })

  // GET /api/employee/lifecycle/my-tasks
  fastify.get('/lifecycle/my-tasks', async (request) => {
    const user = (request as any).user
    const tasks = await prisma.lifecycleTask.findMany({
      where: {
        assignedTo: user.id,
        status: 'in_progress',
      },
      include: {
        lifecycle: {
          select: { id: true, type: true, startDate: true },
        },
      },
      orderBy: { deadline: 'asc' },
    })
    return { code: 0, data: tasks }
  })
}
