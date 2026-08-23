import * as XLSX from 'xlsx';

/** Excel/CSV 注入：以这些字符开头的字符串可能被电子表格当作公式执行 */
const DANGEROUS_CELL_PREFIX = /^[=+\-@\t\r]/;

/**
 * 对单元格值进行公式注入防护。
 * 数值原样返回；文本以 = + - @ (Tab/CR) 开头时前置单引号，使其被当作纯文本读取。
 */
export function sanitizeCell(v: string | number): string | number {
  if (typeof v === 'number') return v;
  if (DANGEROUS_CELL_PREFIX.test(v)) {
    return `'${v}`;
  }
  return v;
}

export interface ExportColumn<T = any> {
  /** 表头（中文） */
  title: string;
  /** 行中对应字段，或由 value 提供取值逻辑 */
  dataIndex?: keyof T | string;
  /** 自定义取值（用于嵌套字段 / 格式化 / 状态码转中文） */
  value?: (row: T) => string | number | null | undefined;
}

function cellValue<T>(col: ExportColumn<T>, row: T): string | number {
  let v: any = col.value ? col.value(row) : col.dataIndex ? (row as any)[col.dataIndex] : undefined;
  if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return '';
  return sanitizeCell(String(v));
}

/**
 * 将行数据导出为 Excel(.xlsx) 文件。
 * 返回 true 表示已导出；rows 为空时返回 false。
 */
export function exportToExcel<T = any>(
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[],
): boolean {
  if (!rows || rows.length === 0) return false;

  // 将行转成「中文表头 -> 值」的对象数组，保证导出列顺序与表头一致
  const aoa: (string | number)[][] = [columns.map((c) => c.title)];
  rows.forEach((row) => {
    aoa.push(columns.map((c) => cellValue(c, row)));
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columns.map((c) => ({ wch: 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
  return true;
}