import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'

export interface ExcelColumn {
  key: string
  header: string
  width?: number
}

export interface ExcelSheet {
  name: string
  columns: ExcelColumn[]
  data: Record<string, any>[]
}

const EXPORT_DIR = path.join(process.cwd(), 'uploads', 'exports')

function ensureExportDir() {
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true })
  }
}

export function createWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LeiXi HR System'
  workbook.created = new Date()
  workbook.modified = new Date()
  return workbook
}

export function addSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: ExcelColumn[],
  data: Record<string, any>[]
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name)

  sheet.columns = columns.map(col => ({
    key: col.key,
    header: col.header,
    width: col.width || 15,
  }))

  const headerRow = sheet.getRow(1)
  headerRow.font = {
    bold: true,
    size: 12,
  }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F2FF' },
  }
  headerRow.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  }
  headerRow.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  }

  data.forEach(row => {
    const rowData: Record<string, any> = {}
    columns.forEach(col => {
      rowData[col.key] = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : ''
    })
    sheet.addRow(rowData)
  })

  for (let i = 2; i <= data.length + 1; i++) {
    const row = sheet.getRow(i)
    row.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
    row.alignment = {
      vertical: 'middle',
    }
  }

  return sheet
}

export async function generateExcel(
  sheets: ExcelSheet[],
  filename: string
): Promise<{ filePath: string; fileSize: number; totalRows: number }> {
  ensureExportDir()

  const workbook = createWorkbook()
  let totalRows = 0

  sheets.forEach(sheet => {
    addSheet(workbook, sheet.name, sheet.columns, sheet.data)
    totalRows += sheet.data.length
  })

  const filePath = path.join(EXPORT_DIR, filename)
  await workbook.xlsx.writeFile(filePath)

  const stats = fs.statSync(filePath)

  return {
    filePath,
    fileSize: stats.size,
    totalRows,
  }
}

export function generateCsv(
  sheets: ExcelSheet[],
  filename: string
): { filePath: string; fileSize: number; totalRows: number } {
  ensureExportDir()

  let totalRows = 0
  let csvContent = ''

  sheets.forEach((sheet, sheetIndex) => {
    if (sheetIndex > 0) {
      csvContent += '\n\n'
    }
    csvContent += `${sheet.name}\n`

    const headers = sheet.columns.map(col => col.header).join(',')
    csvContent += headers + '\n'

    sheet.data.forEach(row => {
      const values = sheet.columns.map(col => {
        const value = row[col.key] !== undefined && row[col.key] !== null ? String(row[col.key]) : ''
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      })
      csvContent += values.join(',') + '\n'
      totalRows++
    })
  })

  const filePath = path.join(EXPORT_DIR, filename)
  fs.writeFileSync(filePath, '\ufeff' + csvContent, 'utf-8')

  const stats = fs.statSync(filePath)

  return {
    filePath,
    fileSize: stats.size,
    totalRows,
  }
}

export function generateExportFileName(reportType: string, format: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const ext = format === 'csv' ? 'csv' : 'xlsx'
  return `${reportType}_${timestamp}_${random}.${ext}`
}

export function getExportFilePath(filename: string): string {
  return path.join(EXPORT_DIR, filename)
}
