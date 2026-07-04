import prisma from '../prisma'
import bcrypt from 'bcryptjs'
import ExcelJS from 'exceljs'

export interface ImportRowError {
  rowIndex: number
  employeeNo?: string
  errors: string[]
}

export interface ImportResult {
  totalCount: number
  successCount: number
  failCount: number
  errors: ImportRowError[]
}

interface EmployeeRowData {
  employeeNo: string
  name: string
  username: string
  phone?: string
  email?: string
  department?: string
  position?: string
  hireDate: string
}

const DEFAULT_PASSWORD = '123456'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[0-9+\-\s]*$/
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function validateEmployeeRow(row: EmployeeRowData, rowIndex: number): string[] {
  const errors: string[] = []

  if (!row.employeeNo) {
    errors.push('员工编号不能为空')
  } else if (row.employeeNo.length > 20) {
    errors.push('员工编号不能超过20个字符')
  }

  if (!row.name) {
    errors.push('姓名不能为空')
  } else if (row.name.length > 50) {
    errors.push('姓名不能超过50个字符')
  }

  if (!row.username) {
    errors.push('用户名不能为空')
  } else if (row.username.length > 50) {
    errors.push('用户名不能超过50个字符')
  } else if (!USERNAME_REGEX.test(row.username)) {
    errors.push('用户名只能包含字母、数字、下划线和横线')
  }

  if (row.phone && !PHONE_REGEX.test(row.phone)) {
    errors.push('手机号格式不合法')
  }

  if (row.email && !EMAIL_REGEX.test(row.email)) {
    errors.push('邮箱格式不合法')
  }

  if (!row.hireDate) {
    errors.push('入职日期不能为空')
  } else {
    const date = new Date(row.hireDate)
    if (Number.isNaN(date.getTime())) {
      errors.push('入职日期格式不合法')
    }
  }

  return errors
}

async function parseExcelFile(buffer: Buffer): Promise<EmployeeRowData[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Excel文件中没有工作表')
  }

  const rows: EmployeeRowData[] = []
  const headers: Record<string, number> = {}

  worksheet.getRow(1).eachCell((cell, colNumber) => {
    const header = normalizeValue(cell.value)
    if (header) {
      headers[header] = colNumber
    }
  })

  const headerMap: Record<keyof EmployeeRowData, string> = {
    employeeNo: '员工编号',
    name: '姓名',
    username: '用户名',
    phone: '手机号',
    email: '邮箱',
    department: '部门',
    position: '岗位',
    hireDate: '入职日期',
  }

  for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum)
    const rowData: Partial<EmployeeRowData> = {}

    let hasData = false
    for (const [key, headerName] of Object.entries(headerMap)) {
      const colIndex = headers[headerName]
      if (colIndex) {
        const cellValue = row.getCell(colIndex).value
        const normalized = normalizeValue(cellValue)
        if (normalized) {
          hasData = true
        }
        ;(rowData as any)[key] = normalized
      }
    }

    if (hasData) {
      rows.push(rowData as EmployeeRowData)
    }
  }

  return rows
}

async function parseCsvFile(buffer: Buffer): Promise<EmployeeRowData[]> {
  const content = buffer.toString('utf-8').replace(/^\uFEFF/, '')
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return []
  }

  const headers = parseCsvLine(lines[0])
  const headerMap: Record<string, number> = {}
  headers.forEach((header, index) => {
    headerMap[normalizeValue(header)] = index
  })

  const columnMap: Record<keyof EmployeeRowData, string> = {
    employeeNo: '员工编号',
    name: '姓名',
    username: '用户名',
    phone: '手机号',
    email: '邮箱',
    department: '部门',
    position: '岗位',
    hireDate: '入职日期',
  }

  const rows: EmployeeRowData[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const rowData: Partial<EmployeeRowData> = {}

    let hasData = false
    for (const [key, headerName] of Object.entries(columnMap)) {
      const colIndex = headerMap[headerName]
      if (colIndex !== undefined) {
        const value = normalizeValue(values[colIndex])
        if (value) {
          hasData = true
        }
        ;(rowData as any)[key] = value
      }
    }

    if (hasData) {
      rows.push(rowData as EmployeeRowData)
    }
  }

  return rows
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }

  result.push(current)
  return result
}

export async function parseImportFile(
  buffer: Buffer,
  filename: string
): Promise<EmployeeRowData[]> {
  const ext = filename.split('.').pop()?.toLowerCase()

  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelFile(buffer)
  } else if (ext === 'csv') {
    return parseCsvFile(buffer)
  } else {
    throw new Error(`不支持的文件格式: ${ext}`)
  }
}

export async function importEmployees(
  rows: EmployeeRowData[],
  _createdById: number
): Promise<ImportResult> {
  const result: ImportResult = {
    totalCount: rows.length,
    successCount: 0,
    failCount: 0,
    errors: [],
  }

  const employeeNoSet = new Set<string>()
  const usernameSet = new Set<string>()
  const emailSet = new Set<string>()
  const phoneSet = new Set<string>()

  const departmentCache = new Map<string, number | null>()
  const positionCache = new Map<string, number | null>()

  async function getDepartmentId(name: string): Promise<number | null> {
    if (departmentCache.has(name)) {
      return departmentCache.get(name) || null
    }
    const dept = await prisma.department.findFirst({
      where: { name },
      select: { id: true },
    })
    departmentCache.set(name, dept?.id || null)
    return dept?.id || null
  }

  async function getPositionId(name: string): Promise<number | null> {
    if (positionCache.has(name)) {
      return positionCache.get(name) || null
    }
    const pos = await prisma.position.findFirst({
      where: { name },
      select: { id: true },
    })
    positionCache.set(name, pos?.id || null)
    return pos?.id || null
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowIndex = i + 2
    const rowErrors: string[] = []

    const validationErrors = validateEmployeeRow(row, rowIndex)
    rowErrors.push(...validationErrors)

    if (row.employeeNo) {
      if (employeeNoSet.has(row.employeeNo)) {
        rowErrors.push('员工编号在导入文件中重复')
      } else {
        employeeNoSet.add(row.employeeNo)
        const existing = await prisma.employee.findUnique({
          where: { employeeNo: row.employeeNo },
          select: { id: true },
        })
        if (existing) {
          rowErrors.push('员工编号已存在')
        }
      }
    }

    if (row.username) {
      if (usernameSet.has(row.username)) {
        rowErrors.push('用户名在导入文件中重复')
      } else {
        usernameSet.add(row.username)
        const existing = await prisma.user.findUnique({
          where: { username: row.username },
          select: { id: true },
        })
        if (existing) {
          rowErrors.push('用户名已存在')
        }
      }
    }

    if (row.email) {
      if (emailSet.has(row.email)) {
        rowErrors.push('邮箱在导入文件中重复')
      } else {
        emailSet.add(row.email)
        const existing = await prisma.user.findUnique({
          where: { email: row.email },
          select: { id: true },
        })
        if (existing) {
          rowErrors.push('邮箱已存在')
        }
      }
    }

    if (row.phone) {
      if (phoneSet.has(row.phone)) {
        rowErrors.push('手机号在导入文件中重复')
      } else {
        phoneSet.add(row.phone)
        const existing = await prisma.user.findUnique({
          where: { phone: row.phone },
          select: { id: true },
        })
        if (existing) {
          rowErrors.push('手机号已存在')
        }
      }
    }

    let departmentId: number | undefined
    let positionId: number | undefined

    if (row.department) {
      const deptId = await getDepartmentId(row.department)
      if (deptId) {
        departmentId = deptId
      } else {
        rowErrors.push(`部门 "${row.department}" 不存在`)
      }
    }

    if (row.position) {
      const posId = await getPositionId(row.position)
      if (posId) {
        positionId = posId
      } else {
        rowErrors.push(`岗位 "${row.position}" 不存在`)
      }
    }

    if (rowErrors.length > 0) {
      result.failCount++
      result.errors.push({
        rowIndex,
        employeeNo: row.employeeNo,
        errors: rowErrors,
      })
      continue
    }

    try {
      await prisma.user.create({
        data: {
          username: row.username,
          passwordHash,
          realName: row.name,
          email: row.email || null,
          phone: row.phone || null,
          departmentId,
          positionId,
          status: 'active',
          employee: {
            create: {
              employeeNo: row.employeeNo,
              hireDate: new Date(row.hireDate),
              status: 'active',
            },
          },
        },
      })
      result.successCount++
    } catch (error: any) {
      result.failCount++
      result.errors.push({
        rowIndex,
        employeeNo: row.employeeNo,
        errors: [`创建失败: ${error.message || '未知错误'}`],
      })
    }
  }

  return result
}

export function generateErrorReportCsv(errors: ImportRowError[]): string {
  const header = '行号,员工编号,错误信息'
  const lines = errors.map((err) => {
    const errorMsg = err.errors.join('; ')
    return `${err.rowIndex},${err.employeeNo || ''},"${errorMsg.replace(/"/g, '""')}"`
  })
  return `\uFEFF${header}\n${lines.join('\n')}\n`
}
