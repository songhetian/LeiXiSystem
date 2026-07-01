import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { setAudit } from '../plugins/audit'
import { requirePermission } from '../middleware/permission'
import { idParamsSchema, validateData } from '../utils/validation'

const reportTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['attendance', 'payroll', 'vacation', 'employee', 'custom']),
  description: z.string().max(500).optional(),
  config: z.object({
    dimensions: z.array(z.string()),
    metrics: z.array(z.object({
      field: z.string(),
      aggregation: z.enum(['sum', 'count', 'avg', 'min', 'max']).default('sum'),
      label: z.string().optional(),
    })),
    filters: z.array(z.object({
      field: z.string(),
      operator: z.enum(['eq', 'ne', 'gt', 'lt', 'ge', 'le', 'in', 'like']),
      value: z.any(),
    })).optional(),
    sort: z.array(z.object({
      field: z.string(),
      order: z.enum(['asc', 'desc']).default('desc'),
    })).optional(),
    limit: z.number().int().positive().max(10000).optional(),
    chartType: z.enum(['table', 'bar', 'line', 'pie', 'area']).optional(),
  }),
  isDefault: z.boolean().default(false),
  status: z.enum(['active', 'inactive']).default('active'),
})

export default async function reportTemplateRoutes(fastify: FastifyInstance) {
  // 获取报表模板列表
  fastify.get('/report-templates', { preHandler: [requirePermission('report:view')] }, async (request: FastifyRequest<{
    Querystring: { type?: string; page?: number; pageSize?: number }
  }>) => {
    const { type, page = 1, pageSize = 20 } = request.query as any
    const where: any = {}
    if (type) where.type = type

    const [total, list] = await Promise.all([
      prisma.reportTemplate.count({ where }),
      prisma.reportTemplate.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          createdByUser: { select: { realName: true } },
        },
      }),
    ])

    return {
      code: 0,
      data: { list, total, page, pageSize },
    }
  })

  // 获取单个报表模板
  fastify.get('/report-templates/:id', { preHandler: [requirePermission('report:view')] }, async (request: FastifyRequest<{ Params: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const template = await prisma.reportTemplate.findUnique({
      where: { id },
      include: {
        createdByUser: { select: { realName: true } },
      },
    })

    if (!template) {
      return reply.status(404).send({ code: 404, message: '报表模板不存在' })
    }

    return { code: 0, data: template }
  })

  // 创建报表模板
  fastify.post('/report-templates', { preHandler: [requirePermission('report:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(reportTemplateSchema, request.body)

    // 如果设为默认，先取消其他默认
    if (body.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { type: body.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.reportTemplate.create({
      data: {
        ...body,
        config: body.config as any,
        createdById: request.user.id,
      },
    })

    setAudit(request, {
      module: 'report',
      action: 'report_template.create',
      requestData: { id: template.id, name: template.name },
    })

    return { code: 0, message: '报表模板创建成功', data: template }
  })

  // 更新报表模板
  fastify.put('/report-templates/:id', { preHandler: [requirePermission('report:manage')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const body = validateData(reportTemplateSchema.partial(), request.body)

    const existing = await prisma.reportTemplate.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '报表模板不存在' })
    }

    // 如果设为默认，先取消其他默认
    if (body.isDefault && !existing.isDefault) {
      await prisma.reportTemplate.updateMany({
        where: { type: existing.type, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.reportTemplate.update({
      where: { id },
      data: {
        ...body,
        config: body.config as any,
      },
    })

    setAudit(request, {
      module: 'report',
      action: 'report_template.update',
      requestData: { id: template.id, name: template.name },
    })

    return { code: 0, message: '报表模板更新成功', data: template }
  })

  // 删除报表模板
  fastify.delete('/report-templates/:id', { preHandler: [requirePermission('report:manage')] }, async (request: FastifyRequest<{ Params: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const existing = await prisma.reportTemplate.findUnique({ where: { id } })
    if (!existing) {
      return reply.status(404).send({ code: 404, message: '报表模板不存在' })
    }

    await prisma.reportTemplate.delete({ where: { id } })

    setAudit(request, {
      module: 'report',
      action: 'report_template.delete',
      requestData: { id, name: existing.name },
    })

    return { code: 0, message: '报表模板删除成功' }
  })

  // 执行报表查询
  fastify.post('/report-templates/:id/execute', { preHandler: [requirePermission('report:view')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { overrides = {} } = request.body as any

    const template = await prisma.reportTemplate.findUnique({ where: { id } })
    if (!template) {
      return reply.status(404).send({ code: 404, message: '报表模板不存在' })
    }

    const config = { ...template.config as any, ...overrides }

    // 根据报表类型构建查询
    let data: any[] = []
    switch (template.type) {
      case 'attendance':
        data = await queryAttendanceReport(config)
        break
      case 'payroll':
        data = await queryPayrollReport(config)
        break
      case 'vacation':
        data = await queryVacationReport(config)
        break
      case 'employee':
        data = await queryEmployeeReport(config)
        break
      default:
        data = []
    }

    setAudit(request, {
      module: 'report',
      action: 'report_template.execute',
      requestData: { id, name: template.name },
    })

    return { code: 0, data: { rows: data, config } }
  })

  // 导出报表
  fastify.post('/report-templates/:id/export', { preHandler: [requirePermission('report:view')] }, async (request: FastifyRequest<{ Params: unknown; Body: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)
    const { format = 'csv' } = request.body as any

    const template = await prisma.reportTemplate.findUnique({ where: { id } })
    if (!template) {
      return reply.status(404).send({ code: 404, message: '报表模板不存在' })
    }

    const config = template.config as any

    let data: any[] = []
    switch (template.type) {
      case 'attendance':
        data = await queryAttendanceReport(config)
        break
      case 'payroll':
        data = await queryPayrollReport(config)
        break
      case 'vacation':
        data = await queryVacationReport(config)
        break
      case 'employee':
        data = await queryEmployeeReport(config)
        break
      default:
        data = []
    }

    // 生成 CSV
    if (format === 'csv') {
      const headers = config.dimensions.concat(config.metrics.map((m: any) => m.label || m.field))
      const rows = data.map((item: any) => headers.map((h: string) => item[h] ?? ''))
      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${template.name}_${new Date().toISOString().split('T')[0]}.csv"`)
        .send(`\uFEFF${csv}`)
    }

    return { code: 0, data: { rows: data } }
  })
}

// 考勤报表查询
async function queryAttendanceReport(config: any) {
  const { dimensions = [], metrics = [], filters = [], sort = [] } = config

  const where: any = {}
  for (const filter of filters || []) {
    switch (filter.operator) {
      case 'eq': where[filter.field] = filter.value; break
      case 'gt': where[filter.field] = { gt: filter.value }; break
      case 'lt': where[filter.field] = { lt: filter.value }; break
      case 'ge': where[filter.field] = { gte: filter.value }; break
      case 'le': where[filter.field] = { lte: filter.value }; break
      case 'in': where[filter.field] = { in: filter.value }; break
    }
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      employee: {
        include: {
          user: { include: { department: true } },
        },
      },
    },
    take: config.limit || 1000,
  })

  // 按维度分组聚合
  const groupBy = dimensions.reduce((acc: any, dim) => {
    acc[dim] = true
    return acc
  }, {})

  const grouped = new Map<string, any>()
  for (const record of records) {
    const key = dimensions.map((d: string) => {
      switch (d) {
        case 'date': return record.date.toISOString().split('T')[0]
        case 'employeeName': return record.employee?.user?.realName || ''
        case 'department': return record.employee?.user?.department?.name || ''
        default: return ''
      }
    }).join('|')

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...Object.fromEntries(dimensions.map((d: string, i: number) => [d, key.split('|')[i]])),
        _count: 0,
        _workHours: 0,
      })
    }
    const group = grouped.get(key)
    group._count++
    group._workHours += Number(record.workHours) || 0
  }

  const result = Array.from(grouped.values())
  for (const r of result) {
    for (const m of metrics) {
      switch (m.aggregation) {
        case 'count': r[m.label || m.field] = r._count; break
        case 'sum': r[m.label || m.field] = m.field === 'workHours' ? r._workHours : r._count; break
      }
    }
    delete r._count
    delete r._workHours
  }

  // 排序
  for (const s of sort || []) {
    result.sort((a: any, b: any) => {
      const va = a[s.field]
      const vb = b[s.field]
      return s.order === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1)
    })
  }

  return result
}

// 薪资报表查询
async function queryPayrollReport(config: any) {
  const { dimensions = [], metrics = [], filters = [] } = config

  const where: any = {}
  for (const filter of filters || []) {
    switch (filter.operator) {
      case 'eq': where[filter.field] = filter.value; break
    }
  }

  const payslips = await prisma.payslip.findMany({
    where,
    include: {
      employee: {
        include: {
          user: { include: { department: true } },
        },
      },
      payrollRun: { include: { payrollPeriod: true } },
    },
    take: config.limit || 1000,
  })

  return payslips.map((p) => ({
    period: `${p.payrollRun?.payrollPeriod?.year || ''}-${String(p.payrollRun?.payrollPeriod?.month || '').padStart(2, '0')}`,
    employeeName: p.employee?.user?.realName || '',
    department: p.employee?.user?.department?.name || '',
    grossPay: Number(p.grossPay),
    totalDeduction: Number(p.totalDeduction),
    netPay: Number(p.netPay),
    status: p.status,
  }))
}

// 假期报表查询
async function queryVacationReport(config: any) {
  const { dimensions = [], metrics = [] } = config

  const balances = await prisma.vacationBalance.findMany({
    include: {
      employee: {
        include: {
          user: { include: { department: true } },
        },
      },
      vacationType: true,
    },
    take: config.limit || 1000,
  })

  return balances.map((b) => ({
    employeeName: b.employee?.user?.realName || '',
    department: b.employee?.user?.department?.name || '',
    vacationType: b.vacationType?.name || '',
    total: b.total,
    used: b.used,
    balance: b.balance,
    unit: b.unit,
  }))
}

// 员工报表查询
async function queryEmployeeReport(config: any) {
  const { dimensions = [], metrics = [] } = config

  const employees = await prisma.employee.findMany({
    where: { status: { not: 'deleted' } },
    include: {
      user: { include: { department: true, position: true } },
    },
    take: config.limit || 1000,
  })

  return employees.map((e) => ({
    employeeNo: e.employeeNo,
    employeeName: e.user?.realName || '',
    department: e.user?.department?.name || '',
    position: e.user?.position?.name || '',
    status: e.status,
    hireDate: e.hireDate?.toISOString().split('T')[0] || '',
  }))
}
