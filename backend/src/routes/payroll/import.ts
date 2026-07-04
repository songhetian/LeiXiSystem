import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../../prisma'
import { setAudit } from '../../plugins/audit'
import { buildEmployeeDataScopeWhere } from '../../services/dataScope'
import { requirePermission } from '../../middleware/permission'
import { validateData, positiveIntSchema, safeExtend } from '../../utils/validation'
import { assertSpreadsheetFile, sanitizeSpreadsheetCell } from '../../utils/security'
import { validateSalaryFormula, testFormula } from '../../services/payrollFormulaValidator'

const importSalarySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  importType: z.enum(['adjustments', 'assignments']),
})

const batchCalculateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  scopeType: z.enum(['all', 'department', 'employee']).default('all'),
  scopeValue: z.array(z.coerce.number()).optional(),
})

interface ImportResult {
  success: boolean
  total: number
  imported: number
  failed: number
  errors: Array<{ row: number; message: string }>
  warnings: Array<{ row: number; message: string }>
}

function parseSpreadsheetRow(row: string[]): Record<string, string> {
  const headers = ['员工编号', '项目名称', '金额', '类型', '备注', '生效日期']
  const result: Record<string, string> = {}
  headers.forEach((header, index) => {
    result[header] = row[index]?.trim() || ''
  })
  return result
}

async function importSalaryAdjustments(
  rows: string[][],
  year: number,
  month: number,
  operatorId: number
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    total: rows.length,
    imported: 0,
    failed: 0,
    errors: [],
    warnings: [],
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 从第2行开始（跳过表头）

    try {
      const data = parseSpreadsheetRow(row)

      if (!data['员工编号']) {
        result.errors.push({ row: rowNum, message: '员工编号不能为空' })
        result.failed++
        continue
      }

      if (!data['金额']) {
        result.errors.push({ row: rowNum, message: '金额不能为空' })
        result.failed++
        continue
      }

      const amount = parseFloat(data['金额'])
      if (isNaN(amount)) {
        result.errors.push({ row: rowNum, message: `金额格式无效: ${data['金额']}` })
        result.failed++
        continue
      }

      // 查找员工
      const employee = await prisma.employee.findFirst({
        where: {
          employeeNo: data['员工编号'],
          status: 'active',
        },
        include: {
          user: {
            include: {
              department: true,
            },
          },
        },
      })

      if (!employee) {
        result.errors.push({ row: rowNum, message: `找不到员工: ${data['员工编号']}` })
        result.failed++
        continue
      }

      // 查找薪资组件
      let component = null
      if (data['项目名称']) {
        component = await prisma.salaryComponent.findFirst({
          where: {
            name: { contains: data['项目名称'] },
            status: 'active',
          },
        })
      }

      // 创建薪资调整记录
      await prisma.payrollAdjustment.create({
        data: {
          employeeId: employee.id,
          year,
          month,
          componentId: component?.id,
          componentName: data['项目名称'] || '其他',
          type: data['类型'] === '扣款' ? 'deduction' : 'bonus',
          amount,
          reason: data['备注'] || '批量导入',
          effectiveFrom: data['生效日期'] ? new Date(data['生效日期']) : new Date(year, month - 1, 1),
          status: 'approved',
          approvedBy: operatorId,
          approvedAt: new Date(),
        },
      })

      result.imported++
    } catch (err) {
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : '未知错误',
      })
      result.failed++
    }
  }

  result.success = result.failed === 0
  return result
}

export default async function payrollImportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', async (request) => {
    await request.jwtVerify()
  })

  // 下载薪资导入模板
  fastify.get('/import/template', {
    preHandler: [requirePermission('payroll:manage')],
  }, async (request: FastifyRequest, reply) => {
    setAudit(request, {
      action: 'payroll_template_download',
      module: 'payroll',
    })

    const headers = ['员工编号', '项目名称', '金额', '类型(奖金/扣款)', '备注', '生效日期']
    const sampleData = [
      ['EMP001', '全勤奖', '500', '奖金', '12月全勤奖励', '2024-12-01'],
      ['EMP001', '迟到扣款', '-100', '扣款', '12月迟到扣款', '2024-12-01'],
      ['EMP002', '项目奖金', '2000', '奖金', '项目完成奖励', '2024-12-01'],
    ]

    const content = [
      headers.map(sanitizeSpreadsheetCell).join(','),
      ...sampleData.map(row => row.map(sanitizeSpreadsheetCell).join(',')),
    ].join('\n')

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="salary_adjustment_template.csv"')
      .send(`\uFEFF${content}`)
  })

  // 导入薪资调整数据
  fastify.post('/import/adjustments', {
    preHandler: [requirePermission('payroll:manage')],
  }, async (request: FastifyRequest, reply) => {
    const query = validateData(safeExtend(importSalarySchema, {
      importType: z.enum(['adjustments']),
    }), request.query)

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
      action: 'payroll_adjustment_import',
      module: 'payroll',
      requestData: {
        year: query.year,
        month: query.month,
        filename: file.filename,
      },
    })

    // 解析 CSV/Excel 文件
    const content = buffer.toString('utf-8')
    const lines = content.split('\n').filter(line => line.trim())
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
    const rows = lines.slice(1).map(line => {
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())
      return values
    })

    const importResult = await importSalaryAdjustments(
      rows,
      query.year,
      query.month,
      request.user.id
    )

    return {
      code: importResult.success ? 0 : 1,
      message: importResult.success ? '导入成功' : '导入完成，部分失败',
      data: importResult,
    }
  })

  // 导出薪资数据
  fastify.get('/export', {
    preHandler: [requirePermission('payroll:manage')],
  }, async (request: FastifyRequest<{
    Querystring: {
      year: number
      month: number
      departmentId?: number
      format?: 'csv' | 'xlsx'
    }
  }>, reply) => {
    const { year, month, departmentId, format = 'csv' } = request.query

    setAudit(request, {
      action: 'payroll_export',
      module: 'payroll',
      requestData: { year, month, departmentId },
    })

    const employeeScope = await buildEmployeeDataScopeWhere(request.user)

    // 查询薪资数据
    const payslips = await prisma.payslip.findMany({
      where: {
        payrollRun: {
          payrollPeriod: { year, month },
        },
        employee: {
          ...employeeScope,
          ...(departmentId ? { user: { departmentId } } : {}),
        },
      },
      include: {
        employee: {
          include: {
            user: {
              include: { department: true },
            },
          },
        },
        payrollRun: {
          include: { payrollPeriod: true },
        },
      },
      orderBy: { id: 'desc' },
    })

    // 生成 CSV
    const headers = [
      '员工编号', '姓名', '部门', '年份', '月份',
      '应发工资', '实发工资', '总扣款', '状态',
    ]

    const rows = payslips.map(p => [
      p.employee.employeeNo,
      sanitizeSpreadsheetCell(p.employee.user?.realName || ''),
      sanitizeSpreadsheetCell(p.employee.user?.department?.name || ''),
      year, month,
      p.grossPay?.toString() || '0',
      p.netPay?.toString() || '0',
      p.totalDeduction?.toString() || '0',
      p.status,
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(sanitizeSpreadsheetCell).join(',')),
    ].join('\n')

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="salary_${year}_${month}.csv"`)
      .send(`\uFEFF${csvContent}`)
  })

  // 批量计算薪资
  fastify.post('/calculate', {
    preHandler: [requirePermission('payroll:manage')],
  }, async (request: FastifyRequest<{ Body: unknown }>, reply) => {
    const { year, month, scopeType, scopeValue } = validateData(batchCalculateSchema, request.body)

    setAudit(request, {
      action: 'payroll_batch_calculate',
      module: 'payroll',
      requestData: { year, month, scopeType, scopeValue },
    })

    // 查找或创建薪资批次
    let payrollRun = await prisma.payrollRun.findFirst({
      where: {
        payrollPeriod: { year, month },
      },
    })

    if (!payrollRun) {
      const period = await prisma.payrollPeriod.findFirst({
        where: { year, month },
      })

      if (!period) {
        return reply.status(400).send({
          code: 400,
          message: `找不到 ${year} 年 ${month} 月的薪资期间`,
        })
      }

      payrollRun = await prisma.payrollRun.create({
        data: {
          periodId: period.id,
          status: 'draft',
          createdBy: request.user.id,
        },
      })
    }

    // 更新范围
    await prisma.payrollRun.update({
      where: { id: payrollRun.id },
      data: {
        scopeType,
        scopeValue: scopeValue || null,
      },
    })

    // 触发计算（实际计算由后台任务执行）
    return {
      code: 0,
      message: '薪资计算任务已创建',
      data: {
        payrollRunId: payrollRun.id,
        status: payrollRun.status,
      },
    }
  })

  // 公式校验
  fastify.post('/validate-formula', {
    preHandler: [requirePermission('payroll:manage')],
  }, async (request: FastifyRequest<{
    Body: {
      formula: string
      testValues?: Record<string, number>
    }
  }>, reply) => {
    const { formula, testValues } = request.body as any

    const validation = validateSalaryFormula(formula)

    if (!validation) {
      return {
        code: 1,
        message: '公式校验失败',
        data: { valid: false },
      }
    }

    // 如果提供了测试值，执行测试
    if (testValues) {
      const testResult = testFormula(formula, testValues)
      return {
        code: testResult.success ? 0 : 1,
        message: testResult.success ? '公式测试成功' : '公式测试失败',
        data: {
          valid: true,
          testResult: testResult.result,
          error: testResult.error,
        },
      }
    }

    return {
      code: 0,
      message: '公式校验通过',
      data: { valid: true },
    }
  })
}
