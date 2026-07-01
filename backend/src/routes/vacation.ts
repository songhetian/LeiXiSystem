import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { idParamsSchema, positiveIntSchema, statusSchema, validateData, partialUpdateSchema, requireAtLeastOneField } from '../utils/validation'
import { carryoverVacation, getCarryoverRecords, expireCarryoverRecords } from '../services/vacationCarryover'

const vacationTypeBodySchema = z.object({
  name: z.string().trim().min(1).max(50),
  code: z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, '假期编码只能包含字母、数字、下划线和横线'),
  totalDays: z.coerce.number().min(0).max(366).optional().default(0),
  unit: z.enum(['day', 'hour']).optional().default('day'),
  isCarryOver: z.coerce.boolean().optional().default(false),
  carryOverDays: z.coerce.number().min(0).max(366).optional().default(0),
  isPaid: z.coerce.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  status: statusSchema,
  description: z.string().trim().max(500).optional().nullable(),
})

const vacationTypeUpdateSchema = partialUpdateSchema(vacationTypeBodySchema)

const balanceQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export default async function vacationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.get('/types', async () => {
    const types = await prisma.vacationType.findMany({
      where: { status: 'active' },
      orderBy: { sortOrder: 'asc' },
    })

    return {
      code: 0,
      data: types.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        totalDays: t.totalDays,
        unit: t.unit,
        isCarryOver: t.isCarryOver,
        carryOverDays: t.carryOverDays,
        isPaid: t.isPaid,
        sortOrder: t.sortOrder,
        status: t.status,
        description: t.description,
      })),
    }
  })

  fastify.post('/types', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(vacationTypeBodySchema, request.body)

    const type = await prisma.vacationType.create({
      data: {
        name: body.name,
        code: body.code,
        totalDays: body.totalDays,
        unit: body.unit,
        isCarryOver: body.isCarryOver,
        carryOverDays: body.carryOverDays,
        isPaid: body.isPaid,
        sortOrder: body.sortOrder,
        description: body.description,
      },
    })

    return { code: 0, message: '创建成功', data: type }
  })

  fastify.put('/types/:id', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
    Body: unknown
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)
    const data = validateData(vacationTypeUpdateSchema, request.body)
    requireAtLeastOneField(data)

    await prisma.vacationType.update({
      where: { id },
      data: {
        name: data.name,
        totalDays: data.totalDays,
        unit: data.unit,
        isCarryOver: data.isCarryOver,
        carryOverDays: data.carryOverDays,
        isPaid: data.isPaid,
        sortOrder: data.sortOrder,
        status: data.status,
        description: data.description,
      },
    })

    return { code: 0, message: '更新成功' }
  })

  fastify.delete('/types/:id', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Params: { id: string }
  }>) => {
    const { id } = validateData(idParamsSchema, request.params)

    await prisma.vacationType.update({
      where: { id },
      data: { status: 'inactive' },
    })

    return { code: 0, message: '删除成功' }
  })

  // 批量删除假期类型
  fastify.post('/types/batch-delete', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const { ids } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个假期类型'),
    }), request.body)

    const { count } = await prisma.vacationType.updateMany({
      where: { id: { in: ids } },
      data: { status: 'inactive' },
    })

    return {
      code: 0,
      message: `成功删除 ${count} 个假期类型`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  // 批量更新假期类型状态
  fastify.post('/types/batch-status', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const { ids, status } = validateData(z.object({
      ids: z.array(positiveIntSchema).min(1, '至少选择一个假期类型'),
      status: statusSchema,
    }), request.body)

    const { count } = await prisma.vacationType.updateMany({
      where: { id: { in: ids } },
      data: { status },
    })

    return {
      code: 0,
      message: `成功更新 ${count} 个假期类型状态`,
      data: { successCount: count, failedCount: ids.length - count },
    }
  })

  fastify.get('/balance', async (request: FastifyRequest<{
    Querystring: { employeeId?: number; year?: number }
  }>) => {
    const { employeeId, year = new Date().getFullYear() } = validateData(balanceQuerySchema, request.query)

    const empId = employeeId || (await prisma.employee.findUnique({
      where: { userId: request.user.id },
    }))?.id

    if (!empId) {
      return { code: 0, data: [] }
    }

    const balances = await prisma.vacationBalance.findMany({
      where: { employeeId: empId, year },
      include: { vacationType: true },
    })

    return {
      code: 0,
      data: balances.map((b) => ({
        id: b.id,
        vacationTypeId: b.vacationTypeId,
        typeName: b.vacationType.name,
        typeCode: b.vacationType.code,
        year: b.year,
        total: b.total,
        used: b.used,
        balance: b.balance,
        unit: b.vacationType.unit,
      })),
    }
  })

  // 调整假期余额
  fastify.post('/balance/adjust', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Body: { employeeId: number; vacationTypeId: number; year: number; adjustment: number; reason: string }
  }>) => {
    const schema = z.object({
      employeeId: positiveIntSchema,
      vacationTypeId: positiveIntSchema,
      year: z.coerce.number().int().min(2000).max(2100),
      adjustment: z.number(),
      reason: z.string().trim().min(1).max(500),
    })
    const body = validateData(schema, request.body)

    const balance = await prisma.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year: {
          employeeId: body.employeeId,
          vacationTypeId: body.vacationTypeId,
          year: body.year,
        },
      },
    })

    if (!balance) {
      return { code: 404, message: '假期余额记录不存在' }
    }

    const newTotal = Number(balance.total) + body.adjustment
    const newBalance = Number(balance.balance) + body.adjustment

    if (newTotal < 0 || newBalance < 0) {
      return { code: 400, message: '调整后余额不能为负' }
    }

    const updated = await prisma.vacationBalance.update({
      where: { id: balance.id },
      data: {
        total: newTotal,
        balance: newBalance,
      },
    })

    return {
      code: 0,
      message: '假期余额调整成功',
      data: {
        id: updated.id,
        total: updated.total,
        used: updated.used,
        balance: updated.balance,
        adjustment: body.adjustment,
        reason: body.reason,
      },
    }
  })

  // 下载假期类型导入模板
  fastify.get('/import/template', {
    preHandler: [requirePermission('vacation:manage')],
  }, async (request: FastifyRequest, reply) => {
    const headers = ['假期名称', '假期编码', '天数', '单位(day/hour)', '是否可结转', '结转天数', '是否带薪', '排序', '状态(active/inactive)', '描述']
    const sampleData = [
      ['年假', 'annual_leave', '5', 'day', '是', '3', '是', '1', 'active', '员工年假'],
      ['病假', 'sick_leave', '10', 'day', '否', '0', '否', '2', 'active', '员工病假'],
      ['事假', 'personal_leave', '3', 'day', '否', '0', '否', '3', 'active', '员工事假'],
    ]

    const sanitizeCell = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`
    const content = [
      headers.map(sanitizeCell).join(','),
      ...sampleData.map(row => row.map(sanitizeCell).join(',')),
    ].join('\n')

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="vacation_type_template.csv"')
      .send(`\uFEFF${content}`)
  })

  // 导入假期类型
  fastify.post('/import/types', {
    preHandler: [requirePermission('vacation:manage')],
  }, async (request: FastifyRequest, reply) => {
    const file = await request.file()
    if (!file) {
      return reply.status(400).send({ code: 400, message: '请上传导入文件' })
    }

    const buffer = await file.toBuffer()
    const content = buffer.toString('utf-8')
    const lines = content.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      return reply.status(400).send({ code: 400, message: '文件内容为空或格式不正确' })
    }

    const result = {
      total: lines.length - 1,
      imported: 0,
      failed: 0,
      errors: [] as Array<{ row: number; message: string }>,
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))

        const [name, code, totalDays, unit, isCarryOver, carryOverDays, isPaid, sortOrder, status, description] = values

        if (!name || !code) {
          result.errors.push({ row: i + 1, message: '假期名称和编码不能为空' })
          result.failed++
          continue
        }

        await prisma.vacationType.upsert({
          where: { code },
          create: {
            name,
            code,
            totalDays: parseFloat(totalDays) || 0,
            unit: unit === 'hour' ? 'hour' : 'day',
            isCarryOver: isCarryOver === '是' || isCarryOver === '是' || isCarryOver === 'true',
            carryOverDays: parseFloat(carryOverDays) || 0,
            isPaid: isPaid === '是' || isPaid === 'true',
            sortOrder: parseInt(sortOrder) || 0,
            status: status === 'inactive' ? 'inactive' : 'active',
            description: description || null,
          },
          update: {
            name,
            totalDays: parseFloat(totalDays) || 0,
            unit: unit === 'hour' ? 'hour' : 'day',
            isCarryOver: isCarryOver === '是' || isCarryOver === 'true',
            carryOverDays: parseFloat(carryOverDays) || 0,
            isPaid: isPaid === '是' || isPaid === 'true',
            sortOrder: parseInt(sortOrder) || 0,
            status: status === 'inactive' ? 'inactive' : 'active',
            description: description || null,
          },
        })

        result.imported++
      } catch (err) {
        result.errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : '未知错误',
        })
        result.failed++
      }
    }

    return {
      code: result.failed > 0 ? 1 : 0,
      message: `导入完成：成功 ${result.imported}，失败 ${result.failed}`,
      data: result,
    }
  })

  // 导出假期类型
  fastify.get('/export/types', {
    preHandler: [requirePermission('vacation:manage')],
  }, async (request: FastifyRequest, reply) => {
    const types = await prisma.vacationType.findMany({
      orderBy: { sortOrder: 'asc' },
    })

    const headers = ['假期名称', '假期编码', '天数', '单位', '是否可结转', '结转天数', '是否带薪', '排序', '状态', '描述']
    const sanitizeCell = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`
    const boolToText = (v: boolean) => v ? '是' : '否'

    const rows = types.map(t => [
      t.name,
      t.code,
      t.totalDays.toString(),
      t.unit,
      boolToText(t.isCarryOver),
      t.carryOverDays.toString(),
      boolToText(t.isPaid),
      t.sortOrder.toString(),
      t.status,
      t.description || '',
    ])

    const content = [
      headers.map(sanitizeCell).join(','),
      ...rows.map(row => row.map(sanitizeCell).join(',')),
    ].join('\n')

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="vacation_types_export.csv"')
      .send(`\uFEFF${content}`)
  })

  const carryoverRunSchema = z.object({
    fromYear: z.coerce.number().int().min(2000).max(2100),
    toYear: z.coerce.number().int().min(2000).max(2100),
    employeeIds: z.array(positiveIntSchema).optional(),
    vacationTypeIds: z.array(positiveIntSchema).optional(),
    expireMonths: z.coerce.number().int().min(1).max(12).optional().default(12),
  })

  fastify.post('/carryover/run', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(carryoverRunSchema, request.body)

    if (body.fromYear >= body.toYear) {
      return { code: 400, message: '结转目标年份必须大于来源年份' }
    }

    const result = await carryoverVacation(body.fromYear, body.toYear, {
      employeeIds: body.employeeIds,
      vacationTypeIds: body.vacationTypeIds,
      operatorId: request.user.id,
      expireMonths: body.expireMonths,
    })

    return {
      code: 0,
      message: `结转完成：共处理 ${result.totalEmployees} 名员工，生成 ${result.totalRecords} 条记录，结转 ${result.totalCarriedDays.toFixed(1)} 天，过期 ${result.totalExpiredDays.toFixed(1)} 天`,
      data: result,
    }
  })

  const carryoverRecordsQuerySchema = z.object({
    employeeId: z.coerce.number().int().positive().optional(),
    vacationTypeId: z.coerce.number().int().positive().optional(),
    fromYear: z.coerce.number().int().min(2000).max(2100).optional(),
    toYear: z.coerce.number().int().min(2000).max(2100).optional(),
    status: z.string().trim().max(30).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  })

  fastify.get('/carryover/records', { preHandler: [requirePermission('vacation:view')] }, async (request: FastifyRequest<{
    Querystring: {
      employeeId?: number
      vacationTypeId?: number
      fromYear?: number
      toYear?: number
      status?: string
      page?: number
      pageSize?: number
    }
  }>) => {
    const query = validateData(carryoverRecordsQuerySchema, request.query)

    const result = await getCarryoverRecords({
      employeeId: query.employeeId,
      vacationTypeId: query.vacationTypeId,
      fromYear: query.fromYear,
      toYear: query.toYear,
      status: query.status,
      page: query.page,
      pageSize: query.pageSize,
    })

    return {
      code: 0,
      data: result,
    }
  })

  const carryoverExpireSchema = z.object({
    date: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), '日期格式不合法').optional(),
  })

  fastify.post('/carryover/expire', { preHandler: [requirePermission('vacation:manage')] }, async (request: FastifyRequest<{
    Body: unknown
  }>) => {
    const body = validateData(carryoverExpireSchema, request.body)

    const date = body.date ? new Date(body.date) : new Date()

    const result = await expireCarryoverRecords(date)

    return {
      code: 0,
      message: `过期处理完成：共处理 ${result.expiredCount} 条结转记录，过期 ${result.totalExpiredDays.toFixed(1)} 天`,
      data: result,
    }
  })
}
