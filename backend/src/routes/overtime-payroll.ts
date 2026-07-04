import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import { idParamsSchema, validateData, statusSchema } from '../utils/validation'
import dayjs from 'dayjs'

// --- Schemas ---
const salaryProfileBodySchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  baseSalary: z.coerce.number().positive('月薪必须大于0'),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: statusSchema,
})

const calculateOvertimeBodySchema = z.object({
  overtimeId: z.coerce.number().int().positive(),
  hourSource: z.enum(['applied', 'actual', 'min', 'max']).optional().default('min'),
})

const settlementBatchBodySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  settlementType: z.enum(['monthly', 'special']).optional().default('monthly'),
})

export default async function overtimePayrollRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  // ══════════════════════════════════════════════
  // 薪资档案管理
  // ══════════════════════════════════════════════

  // GET /api/overtime-payroll/salary-profiles
  fastify.get('/salary-profiles', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number; employeeId?: number; status?: string }
  }>) => {
    const query = request.query as any
    const { page, pageSize, skip, take } = normalizePagination(query)
    const where: any = {}
    if (query.employeeId) where.employeeId = parseInt(query.employeeId)
    if (query.status) where.status = query.status

    const [total, list] = await Promise.all([
      prisma.employeeSalaryProfile.count({ where }),
      prisma.employeeSalaryProfile.findMany({
        where, skip, take,
        orderBy: { employeeId: 'asc' },
      }),
    ])

    return { code: 0, data: { total, page, pageSize, list } }
  })

  // POST /api/overtime-payroll/salary-profiles
  fastify.post('/salary-profiles', { preHandler: [requirePermission('payroll:manage')] }, async (request) => {
    const body = validateData(salaryProfileBodySchema, request.body)
    const data = await prisma.employeeSalaryProfile.create({
      data: {
        ...body,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
      },
    })
    return { code: 0, data }
  })

  // PUT /api/overtime-payroll/salary-profiles/:id
  fastify.put('/salary-profiles/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = request.body as any
    const updateData: any = {}
    if (body.baseSalary !== undefined) updateData.baseSalary = body.baseSalary
    if (body.effectiveFrom) updateData.effectiveFrom = new Date(body.effectiveFrom)
    if (body.effectiveTo !== undefined) updateData.effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null
    if (body.status) updateData.status = body.status

    const data = await prisma.employeeSalaryProfile.update({
      where: { id: id },
      data: updateData,
    })
    return { code: 0, data }
  })

  // ══════════════════════════════════════════════
  // 加班计算
  // ══════════════════════════════════════════════

  // Calculate hourly rate: monthly_salary / 174
  const STANDARD_MONTHLY_HOURS = 174

  // POST /api/overtime-payroll/calculate
  fastify.post('/calculate', { preHandler: [requirePermission('attendance:manage')] }, async (request) => {
    const body = validateData(calculateOvertimeBodySchema, request.body)

    const overtime = await prisma.overtimeRequest.findUnique({
      where: { id: body.overtimeId },
      include: { employee: true },
    })
    if (!overtime) return { code: 404, message: '加班记录不存在' }
    if (overtime.status !== 'approved') {
      return { code: 400, message: '只有已审批的加班才能计算' }
    }

    // 获取薪资档案
    const salaryProfile = await prisma.employeeSalaryProfile.findFirst({
      where: { employeeId: overtime.employeeId, status: 'active' },
      orderBy: { effectiveFrom: 'desc' },
    })
    if (!salaryProfile) return { code: 400, message: '该员工无有效的薪资档案' }

    const hourlyRate = Number(salaryProfile.baseSalary) / STANDARD_MONTHLY_HOURS

    // 确定加班倍率
    const date = overtime.date
    const overtimeType = overtime.overtimeType || 'workday'

    // 从节假日列表查询
    let overtimeRate = 1.5 // 默认工作日加班
    const holidayList = await prisma.holidayList.findFirst({
      where: { isDefault: true, status: 'active' },
    })
    if (holidayList) {
      const holidayDate = await prisma.holidayDate.findFirst({
        where: { holidayListId: holidayList.id, date },
      })
      if (holidayDate && !holidayDate.isWorkingDay) {
        overtimeRate = 3.0 // 法定节假日
      } else if (date.getDay() === 0 || date.getDay() === 6) {
        // 检查是否为调休工作日
        const isWorkingAdjust = holidayDate?.isWorkingDay
        overtimeRate = isWorkingAdjust ? 1.5 : 2.0
      }
    } else {
      // 无节假日列表时，按周末判断
      const dow = date.getDay()
      if (dow === 0 || dow === 6) overtimeRate = 2.0
    }

    // 计算时长
    const appliedHours = Number(overtime.hours)
    // 尝试匹配打卡记录
    let actualHours = appliedHours
    try {
      const todayStart = new Date(overtime.date)
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date(overtime.date)
      todayEnd.setHours(23, 59, 59)

      const checkins = await prisma.attendanceCheckin.findMany({
        where: {
          employeeId: overtime.employeeId,
          checkTime: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { checkTime: 'asc' },
      })

      if (checkins.length >= 2) {
        const firstCheckIn = checkins[0].checkTime
        const lastCheckOut = checkins[checkins.length - 1].checkTime
        if (lastCheckOut) {
          actualHours = (lastCheckOut.getTime() - firstCheckIn.getTime()) / 3600000 - 1 // 扣除1小时休息
          actualHours = Math.max(0, Math.round(actualHours * 10) / 10)
        }
      }
    } catch (e) {
      // 打卡匹配失败，使用申请时长
    }

    // 选择最终时长
    let settledHours: number
    switch (body.hourSource) {
      case 'applied': settledHours = appliedHours; break
      case 'actual': settledHours = actualHours; break
      case 'min': settledHours = Math.min(appliedHours, actualHours); break
      case 'max': settledHours = Math.max(appliedHours, actualHours); break
      default: settledHours = Math.min(appliedHours, actualHours)
    }

    const overtimePay = hourlyRate * settledHours * overtimeRate

    // 更新加班记录
    const updated = await prisma.overtimeRequest.update({
      where: { id: body.overtimeId },
      data: {
        overtimeRate,
        appliedHours,
        actualHours,
        settledHours,
        hourSource: body.hourSource,
        overtimePay,
        settlementStatus: 'pending',
      },
    })

    return {
      code: 0,
      data: {
        employeeId: overtime.employeeId,
        monthlySalary: Number(salaryProfile.baseSalary),
        hourlyRate: Math.round(hourlyRate * 100) / 100,
        overtimeRate,
        appliedHours,
        actualHours,
        settledHours,
        hourSource: body.hourSource,
        overtimePay: Math.round(overtimePay * 100) / 100,
        formula: `${hourlyRate.toFixed(2)} × ${settledHours}h × ${overtimeRate} = ¥${(overtimePay).toFixed(2)}`,
      },
    }
  })

  // GET /api/overtime-payroll/pending-settlements
  fastify.get('/pending-settlements', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number }
  }>) => {
    const { page, pageSize, skip, take } = normalizePagination(request.query as any)

    const [total, list] = await Promise.all([
      prisma.overtimeRequest.count({
        where: { status: 'approved', settlementStatus: 'pending' },
      }),
      prisma.overtimeRequest.findMany({
        where: { status: 'approved', settlementStatus: 'pending' },
        skip, take,
        orderBy: { date: 'desc' },
      }),
    ])

    const totalPending = list.reduce((sum, r) => sum + Number(r.overtimePay || 0), 0)

    return {
      code: 0,
      data: {
        total, page, pageSize, list,
        totalPendingPay: Math.round(totalPending * 100) / 100,
      },
    }
  })

  // POST /api/overtime-payroll/settle/:id
  fastify.post('/settle/:id', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const userId = (request as any).user.id

    const updated = await prisma.overtimeRequest.update({
      where: { id: id },
      data: {
        settlementStatus: 'settled',
        settledAt: new Date(),
        settledBy: userId,
      },
    })

    return { code: 0, data: updated, message: '结算成功' }
  })

  // ══════════════════════════════════════════════
  // 薪酬结算批次
  // ══════════════════════════════════════════════

  // GET /api/overtime-payroll/settlement-batches
  fastify.get('/settlement-batches', async (request: FastifyRequest<{
    Querystring: { page?: number; pageSize?: number }
  }>) => {
    const { page, pageSize, skip, take } = normalizePagination(request.query as any)

    const [total, list] = await Promise.all([
      prisma.payrollSettlementBatch.count(),
      prisma.payrollSettlementBatch.findMany({
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return { code: 0, data: { total, page, pageSize, list } }
  })

  // POST /api/overtime-payroll/settlement-batches
  fastify.post('/settlement-batches', { preHandler: [requirePermission('payroll:manage')] }, async (request) => {
    const body = validateData(settlementBatchBodySchema, request.body)
    const userId = (request as any).user.id

    // 查询该时段内的所有待结算加班
    const pendingItems = await prisma.overtimeRequest.findMany({
      where: {
        status: 'approved',
        settlementStatus: 'pending',
        date: {
          gte: new Date(body.periodStart),
          lte: new Date(body.periodEnd),
        },
      },
    })

    if (pendingItems.length === 0) {
      return { code: 400, message: '该时段内没有待结算的加班记录' }
    }

    const batchNo = `BATCH-${dayjs().format('YYYYMM')}-${dayjs().format('HHmmss')}`
    const totalPay = pendingItems.reduce((sum, r) => sum + Number(r.overtimePay || 0), 0)
    const employeeIds = [...new Set(pendingItems.map(r => r.employeeId))]

    const batch = await prisma.payrollSettlementBatch.create({
      data: {
        batchNo,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        settlementType: body.settlementType,
        totalOvertimePay: totalPay,
        affectedEmployees: employeeIds.length,
        createdBy: userId,
        items: {
          create: pendingItems.map(r => ({
            employeeId: r.employeeId,
            sourceType: 'overtime',
            sourceId: r.id,
            amount: Number(r.overtimePay || 0),
            description: `${dayjs(r.date).format('MM-DD')} 加班 ${r.settledHours || r.hours}h ×${r.overtimeRate || 1.5}`,
          })),
        },
      },
      include: { items: true },
    })

    // 标记所有项为已结算
    await prisma.overtimeRequest.updateMany({
      where: { id: { in: pendingItems.map(r => r.id) } },
      data: {
        settlementStatus: 'settled',
        settledAt: new Date(),
        settledBy: userId,
      },
    })

    return { code: 0, data: batch, message: `成功创建结算批次 ${batchNo}，含 ${pendingItems.length} 笔加班记录` }
  })

  // POST /api/overtime-payroll/settlement-batches/:id/process
  fastify.post('/settlement-batches/:id/process', { preHandler: [requirePermission('payroll:manage')] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const userId = (request as any).user.id

    const batch = await prisma.payrollSettlementBatch.findUnique({
      where: { id: id },
      include: { items: true },
    })
    if (!batch) return { code: 404, message: '结算批次不存在' }
    if (batch.status !== 'pending') return { code: 400, message: '该批次已处理' }

    // 为每个item创建PayrollAdjustment
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    for (const item of batch.items) {
      await prisma.payrollAdjustment.create({
        data: {
          employeeId: item.employeeId,
          componentId: 1, // 默认薪资项目ID，可能需要配置
          year,
          month,
          type: 'addition',
          amount: item.amount,
          reason: item.description || '加班费结算',
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          settlementBatch: batch.batchNo,
          createdBy: userId,
        },
      })
    }

    await prisma.payrollSettlementBatch.update({
      where: { id: id },
      data: {
        status: 'completed',
        processedAt: new Date(),
        processedBy: userId,
      },
    })

    return { code: 0, message: `结算批次 ${batch.batchNo} 处理完成，已生成 ${batch.items.length} 条薪资调整` }
  })
}
