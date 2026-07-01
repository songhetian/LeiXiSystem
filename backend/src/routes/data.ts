import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requireAnyPermission, requirePermission } from '../middleware/permission'
import { setAudit, captureBefore, setAfter } from '../plugins/audit'
import { dateStringSchema, idParamsSchema, validateData, safePick, safeOmit, safePartial } from '../utils/validation'
import { assertSpreadsheetFile, sanitizeSpreadsheetCell } from '../utils/security'
import { normalizePagination } from '../utils/pagination'
import { parseImportFile, importEmployees, generateErrorReportCsv } from '../services/employeeImport'

const dataTypeSchema = z.enum(['employee', 'department', 'attendance', 'shift', 'salary'])
const fileFormatSchema = z.enum(['xlsx', 'xls', 'csv']).default('xlsx')

const importQuerySchema = z.object({
  type: dataTypeSchema,
})

const importTaskQuerySchema = z.object({
  page: z.unknown().optional(),
  pageSize: z.unknown().optional(),
  type: dataTypeSchema.optional(),
  status: z.string().trim().max(20).optional(),
  keyword: z.string().trim().max(100).optional(),
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

    const importTask = await prisma.importTask.create({
      data: {
        type,
        fileName: file.filename,
        fileSize: buffer.length,
        status: 'processing',
        createdById: request.user.id,
      },
    })

    setAudit(request, {
      action: 'data_import_start',
      module: 'data',
      requestData: {
        taskId: importTask.id,
        type,
        filename: file.filename,
        mimetype: file.mimetype,
        size: buffer.length,
      },
    })

    try {
      let rows: any[]
      if (type === 'employee') {
        rows = await parseImportFile(buffer, file.filename)
      } else {
        throw new Error(`暂不支持 ${type} 类型的导入`)
      }

      await prisma.importTask.update({
        where: { id: importTask.id },
        data: { totalCount: rows.length },
      })

      let result
      if (type === 'employee') {
        result = await importEmployees(rows, request.user.userId)
      } else {
        result = { totalCount: rows.length, successCount: 0, failCount: rows.length, errors: rows.map((_, i) => ({ rowIndex: i + 2, errors: ['暂不支持该类型导入'] })) }
      }

      const errorLog = result.errors.length > 0 ? JSON.stringify(result.errors) : null

      const completedTask = await prisma.importTask.update({
        where: { id: importTask.id },
        data: {
          successCount: result.successCount,
          failCount: result.failCount,
          status: 'completed',
          errorLog,
          completedAt: new Date(),
        },
      })

      setAfter(request, {
        taskId: completedTask.id,
        totalCount: completedTask.totalCount,
        successCount: completedTask.successCount,
        failCount: completedTask.failCount,
        status: completedTask.status,
      })

      return {
        code: 0,
        message: '导入完成',
        data: {
          taskId: completedTask.id,
          type: completedTask.type,
          fileName: completedTask.fileName,
          totalCount: completedTask.totalCount,
          successCount: completedTask.successCount,
          failCount: completedTask.failCount,
          status: completedTask.status,
        },
      }
    } catch (error: any) {
      await prisma.importTask.update({
        where: { id: importTask.id },
        data: {
          status: 'failed',
          errorLog: JSON.stringify([{ error: error.message || '导入失败' }]),
          completedAt: new Date(),
        },
      })

      setAfter(request, {
        taskId: importTask.id,
        status: 'failed',
        error: error.message,
      })

      return reply.status(500).send({
        code: 500,
        message: error.message || '导入失败',
        data: { taskId: importTask.id },
      })
    }
  })

  fastify.get('/import/tasks', { preHandler: [requirePermission('data:import')] }, async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = validateData(importTaskQuerySchema, request.query)
    const { page, pageSize, skip, take } = normalizePagination(query)
    const { type, status, keyword } = query

    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status
    if (keyword) {
      where.OR = [
        { fileName: { contains: keyword } },
        { createdBy: { username: { contains: keyword } } },
      ]
    }

    const [total, list] = await Promise.all([
      prisma.importTask.count({ where }),
      prisma.importTask.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              realName: true,
            },
          },
        },
      }),
    ])

    setAudit(request, {
      action: 'data_import_tasks_list',
      module: 'data',
      requestData: query,
    })

    return {
      code: 0,
      data: {
        list: list.map((task) => ({
          id: task.id,
          type: task.type,
          fileName: task.fileName,
          fileSize: task.fileSize,
          totalCount: task.totalCount,
          successCount: task.successCount,
          failCount: task.failCount,
          status: task.status,
          createdBy: task.createdBy
            ? {
                id: task.createdBy.id,
                username: task.createdBy.username,
                realName: task.createdBy.realName,
              }
            : null,
          createdAt: task.createdAt,
          completedAt: task.completedAt,
        })),
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/import/tasks/:id', { preHandler: [requirePermission('data:import')] }, async (request: FastifyRequest<{ Params: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const task = await prisma.importTask.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            realName: true,
          },
        },
      },
    })

    if (!task) {
      return reply.status(404).send({ code: 404, message: '导入任务不存在' })
    }

    let errorDetails = []
    if (task.errorLog) {
      try {
        errorDetails = JSON.parse(task.errorLog)
      } catch {
        errorDetails = [{ error: task.errorLog }]
      }
    }

    setAudit(request, {
      action: 'data_import_task_detail',
      module: 'data',
      requestData: { id },
    })

    return {
      code: 0,
      data: {
        id: task.id,
        type: task.type,
        fileName: task.fileName,
        fileSize: task.fileSize,
        totalCount: task.totalCount,
        successCount: task.successCount,
        failCount: task.failCount,
        status: task.status,
        errorDetails,
        createdBy: task.createdBy
          ? {
              id: task.createdBy.id,
              username: task.createdBy.username,
              realName: task.createdBy.realName,
            }
          : null,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      },
    }
  })

  fastify.get('/import/tasks/:id/errors', { preHandler: [requirePermission('data:import')] }, async (request: FastifyRequest<{ Params: unknown }>, reply) => {
    const { id } = validateData(idParamsSchema, request.params)

    const task = await prisma.importTask.findUnique({
      where: { id },
    })

    if (!task) {
      return reply.status(404).send({ code: 404, message: '导入任务不存在' })
    }

    let errors: any[] = []
    if (task.errorLog) {
      try {
        errors = JSON.parse(task.errorLog)
      } catch {
        errors = [{ rowIndex: '-', errors: [task.errorLog] }]
      }
    }

    const csvContent = generateErrorReportCsv(errors)
    const filename = `import_errors_${task.id}.csv`

    setAudit(request, {
      action: 'data_import_error_download',
      module: 'data',
      requestData: { id },
    })

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csvContent)
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
