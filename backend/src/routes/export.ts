import { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import prisma from '../prisma'
import { authMiddleware } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { normalizePagination } from '../utils/pagination'
import {
  generateExcel,
  generateCsv,
  generateExportFileName,
  getExportFilePath,
  ExcelSheet,
  ExcelColumn,
} from '../utils/excel-export'
import { buildAttendanceDataScopeWhere } from '../services/dataScope'
import fs from 'fs'

const reportTypeEnum = z.enum(['schedule', 'attendance', 'leave-overtime', 'finance', 'employee', 'department', 'shift'])
const formatEnum = z.enum(['xlsx', 'csv'])
const statusEnum = z.enum(['pending', 'processing', 'completed', 'failed'])

const createExportSchema = z.object({
  reportType: reportTypeEnum,
  format: formatEnum.default('xlsx'),
  fields: z.array(z.string()).optional(),
  params: z.record(z.string(), z.any()).optional(),
})

const taskQuerySchema = z.object({
  status: statusEnum.optional(),
})

const templateQuerySchema = z.object({
  reportType: reportTypeEnum.optional(),
})

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  reportType: reportTypeEnum,
  fields: z.array(z.string()),
  isDefault: z.boolean().default(false),
})

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fields: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
})

const REPORT_PERMISSIONS: Record<string, string> = {
  schedule: 'schedule:view',
  attendance: 'attendance:view',
  'leave-overtime': 'attendance:view',
  finance: 'finance:view',
  employee: 'personnel:view',
  department: 'organization:view',
  shift: 'shift:view',
}

const DEFAULT_FIELDS: Record<string, ExcelColumn[]> = {
  schedule: [
    { key: 'employeeNo', header: '工号', width: 12 },
    { key: 'employeeName', header: '姓名', width: 12 },
    { key: 'departmentName', header: '部门', width: 15 },
    { key: 'scheduleDate', header: '日期', width: 12 },
    { key: 'shiftName', header: '班次', width: 15 },
    { key: 'startTime', header: '上班时间', width: 12 },
    { key: 'endTime', header: '下班时间', width: 12 },
    { key: 'workHours', header: '工时', width: 10 },
    { key: 'status', header: '状态', width: 10 },
  ],
  attendance: [
    { key: 'employeeNo', header: '工号', width: 12 },
    { key: 'employeeName', header: '姓名', width: 12 },
    { key: 'departmentName', header: '部门', width: 15 },
    { key: 'workDays', header: '工作日数', width: 10 },
    { key: 'normalDays', header: '正常出勤', width: 10 },
    { key: 'lateDays', header: '迟到天数', width: 10 },
    { key: 'earlyDays', header: '早退天数', width: 10 },
    { key: 'absentDays', header: '缺勤天数', width: 10 },
    { key: 'leaveDays', header: '请假天数', width: 10 },
    { key: 'overtimeHours', header: '加班小时', width: 12 },
    { key: 'attendanceRate', header: '出勤率(%)', width: 12 },
  ],
  'leave-overtime': [
    { key: 'employeeNo', header: '工号', width: 12 },
    { key: 'employeeName', header: '姓名', width: 12 },
    { key: 'departmentName', header: '部门', width: 15 },
    { key: 'leaveDays', header: '请假天数', width: 12 },
    { key: 'overtimeHours', header: '加班小时', width: 12 },
  ],
  finance: [
    { key: 'departmentName', header: '部门', width: 20 },
    { key: 'employeeCount', header: '人数', width: 10 },
    { key: 'totalSalary', header: '工资总额', width: 15 },
    { key: 'totalReimbursement', header: '报销总额', width: 15 },
    { key: 'totalExpense', header: '总支出', width: 15 },
  ],
  employee: [
    { key: 'employeeNo', header: '工号', width: 12 },
    { key: 'name', header: '姓名', width: 12 },
    { key: 'gender', header: '性别', width: 8 },
    { key: 'departmentName', header: '部门', width: 15 },
    { key: 'positionName', header: '职位', width: 15 },
    { key: 'phone', header: '手机号', width: 15 },
    { key: 'email', header: '邮箱', width: 22 },
    { key: 'status', header: '状态', width: 10 },
    { key: 'hireDate', header: '入职日期', width: 14 },
    { key: 'employmentType', header: '用工类型', width: 12 },
  ],
  department: [
    { key: 'name', header: '部门名称', width: 20 },
    { key: 'code', header: '部门编码', width: 15 },
    { key: 'parentName', header: '上级部门', width: 20 },
    { key: 'managerName', header: '负责人', width: 12 },
    { key: 'employeeCount', header: '人数', width: 10 },
    { key: 'status', header: '状态', width: 10 },
  ],
  shift: [
    { key: 'name', header: '班次名称', width: 15 },
    { key: 'code', header: '班次编码', width: 12 },
    { key: 'startTime', header: '上班时间', width: 12 },
    { key: 'endTime', header: '下班时间', width: 12 },
    { key: 'workHours', header: '工时', width: 10 },
    { key: 'lateGraceMinutes', header: '迟到宽限(分)', width: 14 },
    { key: 'earlyGraceMinutes', header: '早退宽限(分)', width: 14 },
    { key: 'status', header: '状态', width: 10 },
  ],
}

function parseDepartmentIds(departmentIds?: string): number[] {
  if (!departmentIds) return []
  try {
    const parsed = JSON.parse(departmentIds)
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter(n => !isNaN(n))
    }
  } catch {
  }
  return []
}

async function getScheduleReportData(params: any, user: any): Promise<ExcelSheet[]> {
  const now = new Date()
  const currentYear = params.year || now.getFullYear()
  const currentMonth = params.month || now.getMonth() + 1
  const departmentIds = parseDepartmentIds(params.departmentIds)

  let startDate: Date
  let endDate: Date

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate)
    endDate = new Date(params.endDate)
  } else {
    startDate = new Date(currentYear, currentMonth - 1, 1)
    endDate = new Date(currentYear, currentMonth, 0)
  }

  const scheduleWhere: any = {
    scheduleDate: { gte: startDate, lte: endDate },
  }
  if (params.employeeId) {
    scheduleWhere.employeeId = params.employeeId
  }
  if (departmentIds.length > 0) {
    scheduleWhere.employee = { user: { departmentId: { in: departmentIds } } }
  }
  if (params.keyword) {
    scheduleWhere.employee = {
      ...scheduleWhere.employee,
      user: {
        ...scheduleWhere.employee?.user,
        realName: { contains: params.keyword },
      },
    }
  }

  const schedules = await prisma.schedule.findMany({
    where: scheduleWhere,
    include: {
      shift: true,
      employee: {
        select: {
          id: true,
          employeeNo: true,
          userId: true,
          user: { select: { id: true, realName: true, departmentId: true, department: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: [{ employeeId: 'asc' }, { scheduleDate: 'asc' }],
  })

  const data = schedules.map(s => ({
    employeeNo: s.employee?.employeeNo || '',
    employeeName: s.employee?.user?.realName || '',
    departmentName: s.employee?.user?.department?.name || '',
    scheduleDate: s.scheduleDate.toISOString().split('T')[0],
    shiftName: s.shift?.name || '',
    startTime: s.shift?.startTime || '',
    endTime: s.shift?.endTime || '',
    workHours: s.shift?.workHours?.toString() || '',
    status: s.status || '',
  }))

  return [{ name: '排班报表', columns: DEFAULT_FIELDS.schedule, data }]
}

async function getAttendanceReportData(params: any, user: any): Promise<ExcelSheet[]> {
  const now = new Date()
  const currentYear = params.year || now.getFullYear()
  const currentMonth = params.month || now.getMonth() + 1
  const departmentIds = parseDepartmentIds(params.departmentIds)

  let startDate: Date
  let endDate: Date

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate)
    endDate = new Date(params.endDate)
  } else {
    startDate = new Date(currentYear, currentMonth - 1, 1)
    endDate = new Date(currentYear, currentMonth, 0)
  }

  const where: any = await buildAttendanceDataScopeWhere(user)
  where.date = { gte: startDate, lte: endDate }

  if (params.employeeId) {
    where.employeeId = params.employeeId
  }
  if (departmentIds.length > 0) {
    where.employee = { user: { departmentId: { in: departmentIds } } }
  }
  if (params.keyword) {
    where.employee = {
      ...where.employee,
      user: {
        ...where.employee?.user,
        realName: { contains: params.keyword },
      },
    }
  }
  if (params.status) {
    where.status = params.status
  }

  const dailyRecords = await prisma.attendanceDaily.findMany({
    where,
    include: {
      employee: {
        select: {
          employeeNo: true,
          user: {
            select: {
              realName: true,
              departmentId: true,
              department: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const employeeStats = dailyRecords.reduce((acc: any, r) => {
    const empId = r.employeeId
    if (!acc[empId]) {
      acc[empId] = {
        employeeNo: r.employee?.employeeNo || '',
        employeeName: r.employee?.user?.realName || '',
        departmentName: r.employee?.user?.department?.name || '',
        workDays: 0,
        normalDays: 0,
        lateDays: 0,
        earlyDays: 0,
        absentDays: 0,
        leaveDays: 0,
        overtimeHours: 0,
        totalHours: 0,
      }
    }
    acc[empId].workDays++
    if (r.status === 'normal') acc[empId].normalDays++
    if (r.lateMinutes > 0) acc[empId].lateDays++
    if (r.earlyMinutes > 0) acc[empId].earlyDays++
    if (r.status === 'absent') acc[empId].absentDays++
    if (r.status === 'leave') acc[empId].leaveDays++
    if (r.overtimeMinutes) acc[empId].overtimeHours += r.overtimeMinutes / 60
    if (r.workMinutes) acc[empId].totalHours += r.workMinutes / 60
    return acc
  }, {})

  const data = Object.values(employeeStats).map((emp: any) => ({
    ...emp,
    overtimeHours: Math.round(emp.overtimeHours * 100) / 100,
    totalHours: Math.round(emp.totalHours * 100) / 100,
    attendanceRate: emp.workDays > 0 ? Math.round((emp.normalDays / emp.workDays) * 100) : 0,
  }))

  return [{ name: '考勤报表', columns: DEFAULT_FIELDS.attendance, data }]
}

async function getLeaveOvertimeReportData(params: any, user: any): Promise<ExcelSheet[]> {
  const now = new Date()
  const currentYear = params.year || now.getFullYear()
  const currentMonth = params.month || now.getMonth() + 1
  const departmentIds = parseDepartmentIds(params.departmentIds)

  let startDate: Date
  let endDate: Date

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate)
    endDate = new Date(params.endDate)
  } else {
    startDate = new Date(currentYear, currentMonth - 1, 1)
    endDate = new Date(currentYear, currentMonth, 0)
  }

  const leaveWhere: any = {
    startDate: { gte: startDate },
    endDate: { lte: endDate },
    status: 'approved',
  }
  if (params.employeeId) leaveWhere.employeeId = params.employeeId
  if (departmentIds.length > 0) leaveWhere.employee = { user: { departmentId: { in: departmentIds } } }
  if (params.keyword) leaveWhere.employee = {
    ...leaveWhere.employee,
    user: { ...leaveWhere.employee?.user, realName: { contains: params.keyword } },
  }

  const leaves = await prisma.leaveRequest.findMany({
    where: leaveWhere,
    include: {
      employee: { select: { employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
    },
  })

  const overtimeWhere: any = {
    date: { gte: startDate, lte: endDate },
    status: 'approved',
  }
  if (params.employeeId) overtimeWhere.employeeId = params.employeeId
  if (departmentIds.length > 0) overtimeWhere.employee = { user: { departmentId: { in: departmentIds } } }
  if (params.keyword) overtimeWhere.employee = {
    ...overtimeWhere.employee,
    user: { ...overtimeWhere.employee?.user, realName: { contains: params.keyword } },
  }

  const overtimes = await prisma.overtimeRequest.findMany({
    where: overtimeWhere,
    include: {
      employee: { select: { employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
    },
  })

  const employeeMap: Record<number, any> = {}

  leaves.forEach(l => {
    const empId = l.employeeId
    if (!employeeMap[empId]) {
      employeeMap[empId] = {
        employeeNo: l.employee?.employeeNo || '',
        employeeName: l.employee?.user?.realName || '',
        departmentName: l.employee?.user?.department?.name || '',
        leaveDays: 0,
        overtimeHours: 0,
      }
    }
    employeeMap[empId].leaveDays += Number(l.days || 0)
  })

  overtimes.forEach(o => {
    const empId = o.employeeId
    if (!employeeMap[empId]) {
      employeeMap[empId] = {
        employeeNo: o.employee?.employeeNo || '',
        employeeName: o.employee?.user?.realName || '',
        departmentName: o.employee?.user?.department?.name || '',
        leaveDays: 0,
        overtimeHours: 0,
      }
    }
    employeeMap[empId].overtimeHours += Number(o.hours || 0)
  })

  const data = Object.values(employeeMap).map((emp: any) => ({
    ...emp,
    overtimeHours: Math.round(emp.overtimeHours * 100) / 100,
    leaveDays: Math.round(emp.leaveDays * 100) / 100,
  }))

  return [{ name: '加班请假报表', columns: DEFAULT_FIELDS['leave-overtime'], data }]
}

async function getFinanceReportData(params: any, user: any): Promise<ExcelSheet[]> {
  const now = new Date()
  const currentYear = params.year || now.getFullYear()
  const currentMonth = params.month || now.getMonth() + 1
  const departmentIds = parseDepartmentIds(params.departmentIds)

  let startDate: Date
  let endDate: Date

  if (params.startDate && params.endDate) {
    startDate = new Date(params.startDate)
    endDate = new Date(params.endDate)
  } else {
    startDate = new Date(currentYear, currentMonth - 1, 1)
    endDate = new Date(currentYear, currentMonth, 0)
  }

  const payrollPeriod = await prisma.payrollPeriod.findFirst({
    where: { startDate: { gte: startDate }, endDate: { lte: endDate } },
  })

  let payslips: any[] = []
  if (payrollPeriod) {
    const payrollRuns = await prisma.payrollRun.findMany({
      where: { payrollPeriodId: payrollPeriod.id, status: 'paid' },
      select: { id: true },
    })
    const runIds = payrollRuns.map(r => r.id)
    if (runIds.length > 0) {
      const payslipWhere: any = { payrollRunId: { in: runIds } }
      if (departmentIds.length > 0) {
        payslipWhere.employee = { user: { departmentId: { in: departmentIds } } }
      }
      if (params.keyword) {
        payslipWhere.employee = {
          ...payslipWhere.employee,
          user: { ...payslipWhere.employee?.user, realName: { contains: params.keyword } },
        }
      }
      payslips = await prisma.payslip.findMany({
        where: payslipWhere,
        include: {
          employee: { select: { id: true, employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
        },
      })
    }
  }

  const reimburseWhere: any = {
    createdAt: { gte: startDate, lte: endDate },
    status: 'paid',
  }
  if (departmentIds.length > 0) {
    reimburseWhere.employee = { user: { departmentId: { in: departmentIds } } }
  }
  if (params.keyword) {
    reimburseWhere.employee = {
      ...reimburseWhere.employee,
      user: { ...reimburseWhere.employee?.user, realName: { contains: params.keyword } },
    }
  }
  const reimbursements = await prisma.reimbursement.findMany({
    where: reimburseWhere,
    include: {
      employee: { select: { employeeNo: true, user: { select: { realName: true, departmentId: true, department: { select: { name: true } } } } } },
    },
  })

  const deptMap: Record<string, any> = {}

  payslips.forEach(p => {
    const deptName = p.employee?.user?.department?.name || '未知'
    if (!deptMap[deptName]) {
      deptMap[deptName] = { departmentName: deptName, salary: 0, reimbursement: 0, employeeCount: new Set() }
    }
    deptMap[deptName].salary += Number(p.netPay || 0)
    deptMap[deptName].employeeCount.add(p.employeeId)
  })

  reimbursements.forEach(r => {
    const deptName = r.employee?.user?.department?.name || '未知'
    if (!deptMap[deptName]) {
      deptMap[deptName] = { departmentName: deptName, salary: 0, reimbursement: 0, employeeCount: new Set() }
    }
    deptMap[deptName].reimbursement += Number(r.amount || 0)
  })

  const data = Object.values(deptMap).map((dept: any) => ({
    departmentName: dept.departmentName,
    employeeCount: dept.employeeCount.size,
    totalSalary: Math.round(dept.salary * 100) / 100,
    totalReimbursement: Math.round(dept.reimbursement * 100) / 100,
    totalExpense: Math.round((dept.salary + dept.reimbursement) * 100) / 100,
  }))

  return [{ name: '财务报表', columns: DEFAULT_FIELDS.finance, data }]
}

async function getEmployeeReportData(params: any, user: any): Promise<ExcelSheet[]> {
  const where: any = {}

  if (params.departmentId) {
    where.user = { departmentId: params.departmentId }
  }
  if (params.status) {
    where.status = params.status
  }
  if (params.employmentType) {
    where.employmentType = params.employmentType
  }
  if (params.keyword) {
    where.OR = [
      { employeeNo: { contains: params.keyword } },
      { user: { realName: { contains: params.keyword } } },
    ]
  }

  const employees = await prisma.employee.findMany({
    where,
    include: {
      user: {
        select: {
          realName: true,
          gender: true,
          phone: true,
          email: true,
          department: { select: { name: true } },
        },
      },
      position: { select: { name: true } },
    },
    orderBy: [{ employeeNo: 'asc' }],
  })

  const genderMap: Record<string, string> = { male: '男', female: '女', other: '其他' }
  const statusMap: Record<string, string> = { active: '在职', probation: '试用期', leave: '休假', resigned: '离职' }

  const data = employees.map(e => ({
    employeeNo: e.employeeNo || '',
    name: e.user?.realName || '',
    gender: genderMap[e.user?.gender || ''] || e.user?.gender || '',
    departmentName: e.user?.department?.name || '',
    positionName: e.position?.name || '',
    phone: e.user?.phone || '',
    email: e.user?.email || '',
    status: statusMap[e.status] || e.status || '',
    hireDate: e.hireDate ? e.hireDate.toISOString().split('T')[0] : '',
    employmentType: e.employmentType || '',
  }))

  return [{ name: '员工列表', columns: DEFAULT_FIELDS.employee, data }]
}

async function getDepartmentReportData(params: any, user: any): Promise<ExcelSheet[]> {
  const departments = await prisma.department.findMany({
    where: params.status ? { status: params.status } : undefined,
    include: {
      parent: { select: { name: true } },
      manager: { select: { realName: true } },
      _count: { select: { users: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  const statusMap: Record<string, string> = { active: '启用', inactive: '停用' }

  const data = departments.map(d => ({
    name: d.name || '',
    code: d.code || '',
    parentName: d.parent?.name || '',
    managerName: d.manager?.realName || '',
    employeeCount: d._count?.users || 0,
    status: statusMap[d.status] || d.status || '',
  }))

  return [{ name: '部门列表', columns: DEFAULT_FIELDS.department, data }]
}

async function getShiftReportData(params: any, user: any): Promise<ExcelSheet[]> {
  const where: any = {}
  if (params.status) {
    where.status = params.status
  }
  if (params.departmentId) {
    where.OR = [
      { departmentId: params.departmentId },
      { departmentId: null },
    ]
  }

  const shifts = await prisma.shift.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
  })

  const statusMap: Record<string, string> = { active: '启用', inactive: '停用' }

  const data = shifts.map(s => ({
    name: s.name || '',
    code: s.code || '',
    startTime: s.startTime || '',
    endTime: s.endTime || '',
    workHours: s.workHours?.toString() || '',
    lateGraceMinutes: s.lateGraceMinutes?.toString() || '',
    earlyGraceMinutes: s.earlyGraceMinutes?.toString() || '',
    status: statusMap[s.status] || s.status || '',
  }))

  return [{ name: '班次列表', columns: DEFAULT_FIELDS.shift, data }]
}

async function getReportData(reportType: string, params: any, user: any): Promise<ExcelSheet[]> {
  switch (reportType) {
    case 'schedule':
      return getScheduleReportData(params, user)
    case 'attendance':
      return getAttendanceReportData(params, user)
    case 'leave-overtime':
      return getLeaveOvertimeReportData(params, user)
    case 'finance':
      return getFinanceReportData(params, user)
    case 'employee':
      return getEmployeeReportData(params, user)
    case 'department':
      return getDepartmentReportData(params, user)
    case 'shift':
      return getShiftReportData(params, user)
    default:
      throw new Error(`不支持的报表类型: ${reportType}`)
  }
}

function filterFields(sheets: ExcelSheet[], fields: string[] | undefined): ExcelSheet[] {
  if (!fields || fields.length === 0) return sheets

  return sheets.map(sheet => ({
    ...sheet,
    columns: sheet.columns.filter(col => fields.includes(col.key)),
    data: sheet.data.map(row => {
      const filtered: Record<string, any> = {}
      fields.forEach(key => {
        filtered[key] = row[key]
      })
      return filtered
    }),
  }))
}

async function processExportTask(taskId: number) {
  try {
    const task = await prisma.exportTask.findUnique({
      where: { id: taskId },
      include: { user: true },
    })

    if (!task) {
      return
    }

    await prisma.exportTask.update({
      where: { id: taskId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    })

    const params = task.params ? JSON.parse(task.params) : {}
    const fields = task.fields ? JSON.parse(task.fields) : undefined

    const sheets = await getReportData(task.reportType, params, task.user)
    const filteredSheets = filterFields(sheets, fields)

    const fileName = generateExportFileName(task.reportType, task.format)
    let result

    if (task.format === 'csv') {
      result = generateCsv(filteredSheets, fileName)
    } else {
      result = await generateExcel(filteredSheets, fileName)
    }

    await prisma.exportTask.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        fileName,
        filePath: result.filePath,
        fileSize: result.fileSize,
        totalRows: result.totalRows,
        completedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('[Export] 导出任务失败:', error)
    try {
      await prisma.exportTask.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          errorMsg: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      })
    } catch (updateError) {
      console.error('[Export] 更新任务状态失败:', updateError)
    }
  }
}

export default async function exportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authMiddleware)

  fastify.post('/', async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = createExportSchema.parse(request.body)
    const permission = REPORT_PERMISSIONS[body.reportType]
    if (!request.user?.permissions?.includes('*') && !request.user?.permissions?.includes(permission) && !request.user?.roles?.includes('超级管理员')) {
      return { code: 403, message: '没有权限执行此操作' }
    }

    const task = await prisma.exportTask.create({
      data: {
        userId: request.user.id,
        reportType: body.reportType,
        format: body.format,
        status: 'pending',
        params: body.params ? JSON.stringify(body.params) : null,
        fields: body.fields ? JSON.stringify(body.fields) : null,
      },
    })

    setImmediate(() => {
      processExportTask(task.id)
    })

    return {
      code: 0,
      data: { taskId: task.id, status: task.status },
    }
  })

  fastify.get('/tasks', async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = taskQuerySchema.parse(request.query)
    const { page, pageSize, skip, take } = normalizePagination(request.query)

    const where: any = {
      userId: request.user.id,
    }
    if (query.status) {
      where.status = query.status
    }

    const [total, tasks] = await Promise.all([
      prisma.exportTask.count({ where }),
      prisma.exportTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ])

    return {
      code: 0,
      data: {
        list: tasks,
        total,
        page,
        pageSize,
      },
    }
  })

  fastify.get('/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const taskId = parseInt(request.params.id, 10)
    if (isNaN(taskId)) {
      return { code: 400, message: '任务ID不合法' }
    }

    const task = await prisma.exportTask.findUnique({
      where: { id: taskId },
    })

    if (!task || task.userId !== request.user.id) {
      return { code: 404, message: '任务不存在' }
    }

    return {
      code: 0,
      data: task,
    }
  })

  fastify.get('/tasks/:id/download', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    const taskId = parseInt(request.params.id, 10)
    if (isNaN(taskId)) {
      return reply.status(400).send({ code: 400, message: '任务ID不合法' })
    }

    const task = await prisma.exportTask.findUnique({
      where: { id: taskId },
    })

    if (!task || task.userId !== request.user.id) {
      return reply.status(404).send({ code: 404, message: '任务不存在' })
    }

    if (task.status !== 'completed' || !task.filePath) {
      return reply.status(400).send({ code: 400, message: '文件未生成或导出失败' })
    }

    const filePath = getExportFilePath(task.fileName || '')
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ code: 404, message: '文件不存在' })
    }

    const fileName = `${task.reportType}_${task.id}.${task.format === 'csv' ? 'csv' : 'xlsx'}`
    const mimeType = task.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    reply.header('Content-Type', mimeType)

    const fileStream = fs.createReadStream(filePath)
    return reply.send(fileStream)
  })

  fastify.delete('/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const taskId = parseInt(request.params.id, 10)
    if (isNaN(taskId)) {
      return { code: 400, message: '任务ID不合法' }
    }

    const task = await prisma.exportTask.findUnique({
      where: { id: taskId },
    })

    if (!task || task.userId !== request.user.id) {
      return { code: 404, message: '任务不存在' }
    }

    if (task.filePath && fs.existsSync(task.filePath)) {
      try {
        fs.unlinkSync(task.filePath)
      } catch (err) {
        console.error('[Export] 删除文件失败:', err)
      }
    }

    await prisma.exportTask.delete({
      where: { id: taskId },
    })

    return {
      code: 0,
      message: '删除成功',
    }
  })

  fastify.get('/templates', async (request: FastifyRequest<{ Querystring: unknown }>) => {
    const query = templateQuerySchema.parse(request.query)

    const where: any = {
      userId: request.user.id,
    }
    if (query.reportType) {
      where.reportType = query.reportType
    }

    const templates = await prisma.exportTemplate.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    const data = templates.map(t => ({
      ...t,
      fields: t.fields ? JSON.parse(t.fields) : [],
    }))

    return {
      code: 0,
      data,
    }
  })

  fastify.post('/templates', async (request: FastifyRequest<{ Body: unknown }>) => {
    const body = createTemplateSchema.parse(request.body)
    const permission = REPORT_PERMISSIONS[body.reportType]
    if (!request.user?.permissions?.includes('*') && !request.user?.permissions?.includes(permission) && !request.user?.roles?.includes('超级管理员')) {
      return { code: 403, message: '没有权限执行此操作' }
    }

    if (body.isDefault) {
      await prisma.exportTemplate.updateMany({
        where: {
          userId: request.user.id,
          reportType: body.reportType,
          isDefault: true,
        },
        data: { isDefault: false },
      })
    }

    const template = await prisma.exportTemplate.create({
      data: {
        userId: request.user.id,
        name: body.name,
        reportType: body.reportType,
        fields: JSON.stringify(body.fields),
        isDefault: body.isDefault,
      },
    })

    return {
      code: 0,
      data: {
        ...template,
        fields: body.fields,
      },
    }
  })

  fastify.put('/templates/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>) => {
    const templateId = parseInt(request.params.id, 10)
    if (isNaN(templateId)) {
      return { code: 400, message: '模板ID不合法' }
    }

    const body = updateTemplateSchema.parse(request.body)

    const template = await prisma.exportTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template || template.userId !== request.user.id) {
      return { code: 404, message: '模板不存在' }
    }

    if (body.isDefault) {
      await prisma.exportTemplate.updateMany({
        where: {
          userId: request.user.id,
          reportType: template.reportType,
          isDefault: true,
          id: { not: templateId },
        },
        data: { isDefault: false },
      })
    }

    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.fields !== undefined) updateData.fields = JSON.stringify(body.fields)
    if (body.isDefault !== undefined) updateData.isDefault = body.isDefault

    const updatedTemplate = await prisma.exportTemplate.update({
      where: { id: templateId },
      data: updateData,
    })

    return {
      code: 0,
      data: {
        ...updatedTemplate,
        fields: updatedTemplate.fields ? JSON.parse(updatedTemplate.fields) : [],
      },
    }
  })

  fastify.delete('/templates/:id', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const templateId = parseInt(request.params.id, 10)
    if (isNaN(templateId)) {
      return { code: 400, message: '模板ID不合法' }
    }

    const template = await prisma.exportTemplate.findUnique({
      where: { id: templateId },
    })

    if (!template || template.userId !== request.user.id) {
      return { code: 404, message: '模板不存在' }
    }

    await prisma.exportTemplate.delete({
      where: { id: templateId },
    })

    return {
      code: 0,
      message: '删除成功',
    }
  })
}
