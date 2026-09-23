/** 报表导出：把「对象行 + 列定义」渲染成 CSV 文本或 xlsx Buffer（列定义与行对象由各模块传入）。 */

/** 导出列定义：header 为中文表头，key 从行对象取值，format 控制取值/渲染。 */
export interface ReportColumn {
  header: string;
  key: string;
  format?: 'text' | 'number' | 'money' | 'bool';
}

/** 把某行对象的单个单元格渲染成文本（CSV 单元格 / xlsx 显示值） */
export function cellValue(row: Record<string, unknown>, col: ReportColumn): string {
  const v = row[col.key];
  if (v == null || v === '') return '';
  switch (col.format) {
    case 'number':
      return Number(v).toFixed(1);
    case 'money':
      return Number(v).toFixed(2);
    case 'bool':
      return v ? '是' : '否';
    default:
      return String(v);
  }
}

/** CSV 单元格转义：含逗号/引号/换行时用双引号包裹并将内部引号翻倍 */
function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * 生成 CSV 文本：首行表头 + 数据行（UTF-8 无 BOM，浏览器/Excel 可直接读取）。
 * 纯函数可单测。
 */
export function toCsv(columns: ReportColumn[], rows: Record<string, unknown>[]): string {
  const header = columns.map((c) => c.header).join(',');
  const lines = rows.map((r) => columns.map((c) => escapeCsv(cellValue(r, c))).join(','));
  return [header, ...lines].join('\r\n');
}

/**
 * 生成 xlsx Buffer：表头加粗 + 数据行，居中 + 细边框（与既有排班导出一致的观感）。
 * 仅生成 Buffer，无副作用；具体写入由路由层通过 reply.send 交给 Fastify。
 */
export async function buildWorkbookBuffer(
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
  sheetName = '报表',
): Promise<Buffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: 16 }));
  const body = rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of columns) out[c.key] = cellValue(r, c);
    return out;
  });
  for (const row of body) ws.addRow(row);
  ws.getRow(1).font = { bold: true };
  ws.eachRow((row) => {
    row.height = 20;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } };
    });
  });
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}