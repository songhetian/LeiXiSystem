import ExcelJS from 'exceljs';
import type { ScheduleView, WorkShiftView } from '@leixi/shared';

const COLUMNS = [
  { header: '员工姓名', key: 'userName', width: 16 },
  { header: '日期', key: 'scheduleDate', width: 14 },
  { header: '班次', key: 'shiftName', width: 12 },
  { header: '开始', key: 'startTime', width: 10 },
  { header: '结束', key: 'endTime', width: 10 },
  { header: '是否休息', key: 'isRestDay', width: 10 },
] as const;

/** 把排班视图导出为 xlsx 的 Buffer（title 为工作表名） */
export async function buildScheduleWorkbook(schedules: ScheduleView[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('排班表');
  ws.columns = [...COLUMNS] as ExcelJS.Column[];
  for (const s of schedules) {
    ws.addRow({
      userName: s.userName,
      scheduleDate: s.scheduleDate,
      shiftName: s.isRestDay ? '休息' : s.shiftName ?? '未排班',
      startTime: s.startTime ?? '',
      endTime: s.endTime ?? '',
      isRestDay: s.isRestDay ? '是' : '否',
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.eachRow((row) => {
    row.height = 20;
    row.eachCell((cell) => {
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } };
    });
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface ImportRow {
  userName: string;
  scheduleDate: string; // YYYY-MM-DD
  shiftName: string | null; // '休息' → isRestDay 置休
  isRestDay: boolean;
}

/** 解析初一导入的排班 xlsx，返回结构化的行（含表头校验） */
export async function parseScheduleWorkbook(buffer: Buffer): Promise<ImportRow[]> {
  const wb = new ExcelJS.Workbook();
  // node v22 的 Buffer 为泛型 Buffer<ArrayBufferLike>，而 exceljs 的 load 期望旧式 Buffer；做窄化断言。
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: ImportRow[] = [];
  const header = ws.getRow(1);
  // 宽松匹配：不校验表头文字，按列位置取「姓名/日期/班次」
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // 表头
    const c = (i: number) => String(row.getCell(i).value ?? '').trim();
    const userName = c(1);
    const scheduleDate = c(2);
    if (!userName || !scheduleDate) return;
    const shiftName = c(3);
    const isRest = shiftName === '休息' || c(6) === '是';
    rows.push({
      userName,
      scheduleDate,
      shiftName: isRest ? null : shiftName || null,
      isRestDay: isRest,
    });
  });
  return rows;
}

/** 把导入行按「班次名查找」映射成待落地的排班行（找不到的班次丢弃并计数） */
export function mapImportRows(
  rows: ImportRow[],
  users: { id: number; realName: string; departmentId: number | null }[],
  shifts: Pick<WorkShiftView, 'id' | 'name'>[],
): { rows: { userId: number; shiftId: number | null; scheduleDate: string; isRestDay: boolean; departmentId: number }[]; skipped: number } {
  const userByName = new Map(users.map((u) => [u.realName, u]));
  const shiftByName = new Map(shifts.map((s) => [s.name, s.id]));
  const out: { userId: number; shiftId: number | null; scheduleDate: string; isRestDay: boolean; departmentId: number }[] = [];
  let skipped = 0;
  for (const r of rows) {
    const u = userByName.get(r.userName);
    if (!u) {
      skipped++;
      continue;
    }
    let shiftId: number | null = null;
    if (r.isRestDay) {
      shiftId = null;
    } else if (r.shiftName) {
      const id = shiftByName.get(r.shiftName);
      if (id == null) {
        skipped++;
        continue;
      }
      shiftId = id;
    }
    out.push({ userId: u.id, shiftId, scheduleDate: r.scheduleDate, isRestDay: r.isRestDay, departmentId: u.departmentId ?? 0 });
  }
  return { rows: out, skipped };
}