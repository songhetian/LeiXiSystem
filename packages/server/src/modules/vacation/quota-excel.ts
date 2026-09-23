import ExcelJS from 'exceljs';

/** 请假额度 Excel 导入：列 = [员工姓名, 请假类型, 年度额度] */
export interface QuotaImportRow {
  userName: string;
  leaveTypeName: string;
  allowance: number;
}

/** 解析额度导入 xlsx，返回结构化行（跨过表头行）；文件损坏则抛错由路由兜底为 400 */
export async function parseQuotaWorkbook(input: Buffer): Promise<QuotaImportRow[]> {
  const wb = new ExcelJS.Workbook();
  const buffer = input as unknown as Parameters<typeof wb.xlsx.load>[0];
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: QuotaImportRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 表头
    const c = (i: number) => String(row.getCell(i).value ?? '').trim();
    const userName = c(1);
    const leaveTypeName = c(2);
    const allowance = Number(c(3));
    if (!userName || !leaveTypeName || !Number.isFinite(allowance) || allowance < 0) return;
    rows.push({ userName, leaveTypeName, allowance });
  });
  return rows;
}

/**
 * 按「姓名 + 类型名」映射成待落地的额度行；把导入年填入 year。
 * scope 外的员工、未知类型、非法额度均跳过并计数。
 */
export function mapQuotaRows(
  rows: QuotaImportRow[],
  users: { id: number; realName: string }[],
  typeIds: readonly (readonly [string, number])[],
  year: number,
): { rows: { userId: number; year: number; leaveTypeId: number; allowance: number }[]; skipped: number } {
  const userByName = new Map(users.map((u) => [u.realName, u.id]));
  const typeByName = new Map(typeIds);
  const out: { userId: number; year: number; leaveTypeId: number; allowance: number }[] = [];
  let skipped = 0;
  for (const r of rows) {
    const userId = userByName.get(r.userName);
    const leaveTypeId = typeByName.get(r.leaveTypeName);
    if (userId == null || leaveTypeId == null) {
      skipped++;
      continue;
    }
    out.push({ userId, year, leaveTypeId, allowance: r.allowance });
  }
  return { rows: out, skipped };
}