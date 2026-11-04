import { formatDate } from '@/lib/format';
import type { Schedule, ScheduleCreateDto } from '@/services/attendance';

export type StampValue = number | 'clear';

export interface BatchPlan {
  itemsToCreate: ScheduleCreateDto[];
  toUpdate: { id: number; employeeId: number; shiftId: number; workDate: string }[];
  toDelete: number[];
  /** 因当日已请假而被跳过的员工数（不写入排班） */
  skippedOnLeave: number;
}

/**
 * 批量排班计划：
 * 把「对某一天的全部员工应用某个班次印章」拆成新建/更新/删除三类，
 * 并跳过当日已请假的员工（请假日单元格渲染请假，写入也看不见，会造成重复操作）。
 */
export function planBatchApply(
  employees: { id: number }[],
  dateStr: string,
  stamp: StampValue,
  scheduleMap: Map<string, Schedule>,
  leaveKeys: Set<string>,
): BatchPlan {
  const plan: BatchPlan = {
    itemsToCreate: [],
    toUpdate: [],
    toDelete: [],
    skippedOnLeave: 0,
  };

  employees.forEach((emp) => {
    const key = `${emp.id}_${dateStr}`;
    if (leaveKeys.has(key)) {
      plan.skippedOnLeave += 1;
      return;
    }
    const existing = scheduleMap.get(key);
    if (stamp === 'clear') {
      if (existing) plan.toDelete.push(existing.id);
      return;
    }
    if (!existing) {
      plan.itemsToCreate.push({ employeeId: emp.id, shiftId: stamp, workDate: dateStr });
      return;
    }
    if (existing.shiftId !== stamp) {
      plan.toUpdate.push({ id: existing.id, employeeId: emp.id, shiftId: stamp, workDate: dateStr });
    }
  });

  return plan;
}

/**
 * 批量操作确认文案：返回 null 表示无需确认（纯新增）。
 * 清除是破坏性操作、覆盖会改掉别人已排的班，都必须让用户先看到影响范围。
 */
export function batchConfirmMessage(plan: BatchPlan, dateStr: string, stamp: StampValue): string | null {
  if (stamp === 'clear') {
    if (plan.toDelete.length === 0) return null;
    return `将清除 ${dateStr} 当前筛选范围内 ${plan.toDelete.length} 条排班，此操作不可撤销。`;
  }
  if (plan.toUpdate.length > 0) {
    return `当日已有 ${plan.toUpdate.length} 人排班将被覆盖，另新增 ${plan.itemsToCreate.length} 人。是否继续？`;
  }
  return null;
}

/** 导出/统计跟随当前列表：只保留屏幕上可见员工的排班 */
export function filterSchedulesForEmployees(schedules: Schedule[], employeeIds: Set<number>): Schedule[] {
  return schedules.filter((s) => employeeIds.has(s.employeeId));
}

/**
 * 导入前统计：后端批量排班是 upsert，同员工同日的已有排班会被静默覆盖。
 * 覆盖属于破坏性操作，必须先把数量告诉用户并征求确认。
 */
export function summarizeImport(
  items: ScheduleCreateDto[],
  scheduleMap: Map<string, Schedule>,
): { toCreate: number; toOverwrite: number } {
  const seen = new Set<string>();
  let toCreate = 0;
  let toOverwrite = 0;
  items.forEach((item) => {
    const key = `${item.employeeId}_${item.workDate}`;
    // 文件内重复行最终由后一行生效，统计时只算一次
    if (seen.has(key)) return;
    seen.add(key);
    if (scheduleMap.has(key)) toOverwrite += 1;
    else toCreate += 1;
  });
  return { toCreate, toOverwrite };
}

/**
 * 批量写入项：新建与覆盖合并成同一批。
 * 后端 batch 接口是「事务内逐条 upsert」，覆盖已有排班不需要单独调 update，
 * 合并后 100 人只有 1 次往返，且整批要么全成功要么全失败，不会留下半套排班。
 */
export function mergeUpsertItems(plan: BatchPlan): ScheduleCreateDto[] {
  return [
    ...plan.itemsToCreate,
    ...plan.toUpdate.map((u) => ({
      employeeId: u.employeeId,
      shiftId: u.shiftId,
      workDate: u.workDate,
    })),
  ];
}

/** 批量部分失败提示：只给「有 N 项失败」用户无从下手，要列出具体对象 */
export function formatBatchFailure(failedLabels: string[]): string {
  const shown = failedLabels.slice(0, 3).join('、');
  const extra = failedLabels.length > 3 ? ` 等 ${failedLabels.length} 项` : '';
  return `批量操作完成，${failedLabels.length} 项失败：${shown}${extra}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
/** Excel 1900 日期系统的起点：1899-12-30（含 1900 闰年 bug 的兼容偏移） */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Excel 日期序列号 → YYYY-MM-DD（避免依赖宿主机时区） */
export function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utc = new Date(EXCEL_EPOCH + Math.round(serial) * MS_PER_DAY);
  if (isNaN(utc.getTime())) return null;
  const y = utc.getUTCFullYear();
  const m = utc.getUTCMonth();
  const d = utc.getUTCDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface ImportEmployee {
  id: number;
  employeeNo?: string;
  name?: string;
}
interface ImportShift {
  id: number;
  name: string;
}

/**
 * 解析排班导入行。
 * 兼容三类日期：字符串、Date 实例（xlsx cellDates）、Excel 数字序列号；
 * 逐行校验员工/班次/日期范围，返回可导入项与可读错误，错误不影响其它行。
 */
export function parseScheduleImportRows(
  rows: Record<string, unknown>[],
  employees: ImportEmployee[],
  shifts: ImportShift[],
  range: { startDate: string; endDate: string },
): { items: ScheduleCreateDto[]; errors: string[] } {
  const empByNo = new Map<string, ImportEmployee>();
  const empByName = new Map<string, ImportEmployee>();
  employees.forEach((e) => {
    if (e.employeeNo) empByNo.set(String(e.employeeNo).toLowerCase(), e);
    if (e.name) empByName.set(e.name.trim(), e);
  });
  const shiftByName = new Map<string, ImportShift>();
  shifts.forEach((s) => shiftByName.set(s.name.trim(), s));

  const items: ScheduleCreateDto[] = [];
  const errors: string[] = [];

  rows.forEach((row, idx) => {
    const no = String(row['工号'] ?? row['employeeNo'] ?? row['员工工号'] ?? '').trim();
    const name = String(row['姓名'] ?? row['name'] ?? '').trim();
    const rawDate = row['日期'] ?? row['date'] ?? row['workDate'];
    const shiftName = String(row['班次'] ?? row['shift'] ?? row['shiftName'] ?? '').trim();

    let date = '';
    if (rawDate instanceof Date) {
      date = formatDate(rawDate, 'YYYY-MM-DD', '');
    } else if (typeof rawDate === 'number') {
      date = excelSerialToDate(rawDate) ?? '';
    } else if (typeof rawDate === 'string') {
      date = DATE_RE.test(rawDate) ? rawDate : formatDate(rawDate, 'YYYY-MM-DD', '');
    }

    if (!date) {
      errors.push(`第 ${idx + 2} 行：日期格式应为 YYYY-MM-DD`);
      return;
    }
    // 导入到非当前月份的数据会写入成功但界面看不到，直接拦下并说明原因
    if (date < range.startDate || date > range.endDate) {
      errors.push(`第 ${idx + 2} 行：日期 ${date} 不在当前月份（${range.startDate} ~ ${range.endDate}）`);
      return;
    }

    const emp = (no && empByNo.get(no.toLowerCase())) || empByName.get(name);
    if (!emp) {
      errors.push(`第 ${idx + 2} 行：找不到员工（${no || name}）`);
      return;
    }
    const shift = shiftByName.get(shiftName);
    if (!shift) {
      errors.push(`第 ${idx + 2} 行：找不到班次「${shiftName}」`);
      return;
    }
    items.push({ employeeId: emp.id, shiftId: shift.id, workDate: date });
  });

  return { items, errors };
}
