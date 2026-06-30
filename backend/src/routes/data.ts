import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { dateStringSchema, idParamsSchema, validateData } from '../utils/validation'
import { assertSpreadsheetFile, sanitizeSpreadsheetCell } from '../utils/security'

const dataTypeSchema = z.enum(['employee', 'department', 'attendance', 'shift', 'salary'])
const fileFormatSchema = z.enum(['xlsx', 'xls', 'csv']).default('xlsx')

const importQuerySchema = z.object({
  type: dataTypeSchema,
})

const exportBodySchema = z.object({
  type: dataTypeSchema,
  format: fileFormatSchema,
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  departmentIds: z.array(z.coerce.number().int().positive()).max(200).optional().default([]),
}).refine((value) => (!value.startDate && !value.endDate) || (value.startDate && value.endDate), {
  message: '开始日期和结束日期必须同时提供',
})

const templateParamsSchema = z.object({
  type: dataTypeSchema,
})

const templateColumns: Record<z.infer<typeof dataTypeSchema>, string[]> = {
  employee: ['员工编号', '姓名', '用户名', '手机号', '邮箱', '部门', '岗位', '入职日期'],
  department: ['部门名称', '上级部门', '负责人', '排序', '状态'],
  attendance: ['员工编号', '日期', '上班时间', '下班时间', '来源'],
  shift: ['班次编码', '班次名称', '开始时间', '结束时间', '工时'],
  salary: ['员工编号', '薪资结构', '基本工资', '生效日期'],
}

export default async function dataRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.post('/import', { preHandler: [requirePermission('data:import')] }, async (request: FastifyRequest<{ Querystring: unknown }>, reply) => {
    const { type } = validateData(importQuerySchema, request.query)
    const file = await request.file()
    if (!file) {
      return reply.status(400).send({ code: 400, message: '请上传导入文件' })
    }

    const buffer = await file.toBuffer()
    assertSpreadsheetFile({
      filename: file.filename,
      mimetype: file.mimetype,
      size: buffer.length,
    })

    setAudit(request, {
      action: 'data_import_upload',
      module: 'data',
      requestData: {
        type,
        filename: file.filename,
        mimetype: file.mimetype,
        size: buffer.length,
      },
    })

    return {
      code: 0,
      message: '文件已通过安全校验，等待导入任务处理',
      data: {
        type,
        fileName: file.filename,
        size: buffer.length,
        status: 'validated',
      },
    }
  })

  fastify.post('/export', { preHandler: [requirePermission('data:export')] }, async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = validateData(exportBodySchema, request.body)
    const safePayload = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, sanitizeSpreadsheetCell(value)]),
    )

    setAudit(request, {
      action: 'data_export_create',
      module: 'data',
      requestData: safePayload,
    })

    return {
      code: 0,
      message: '导出任务已创建',
      data: {
        id: Date.now(),
        status: 'pending',
        ...safePayload,
      },
    }
  })

  fastify.get('/templates/:type', { preHandler: [requireAnyPermission(['data:import', 'data:export'])] }, async (request: FastifyRequest<{ Params: unknown }>, reply) => {
    const { type } = validateData(templateParamsSchema, request.params)
    const content = `${templateColumns[type].map(sanitizeSpreadsheetCell).join(',')}\n`
    const filename = `${type}_template.csv`

    setAudit(request, {
      action: 'data_template_download',
      module: 'data',
      requestData: { type },
    })

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(`\uFEFF${content}`)
  })

  fastify.get('/exports/:id/download', { preHandler: [requirePermission('data:export')] }, async (request: FastifyRequest<{ Params: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    setAudit(request, {
      action: 'data_export_download',
      module: 'data',
      requestData: { id },
    })

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="export_${id}.csv"`)
      .send('\uFEFF状态,说明\n已创建,请接入后台任务生成真实导出文件\n')
  })
}
