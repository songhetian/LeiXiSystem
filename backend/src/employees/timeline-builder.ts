export interface TimelineEmployee {
  id: number;
  name: string;
  employeeNo: string;
  status: string;
  hireDate: string | Date;
  resignDate?: string | Date | null;
  departmentId?: number;
  department?: string | null;
  position?: string | null;
}

export interface TimelineTransfer {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNo: string;
  type: string; // transfer | promotion | demotion | salary_adjust
  effectiveDate: string | Date;
  departmentId?: number;
  fromText?: string | null;
  toText?: string | null;
  reason?: string | null;
}

export interface TimelineResignation {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNo: string;
  resignDate: string | Date;
  departmentId?: number;
  reason?: string | null;
  department?: string | null;
}

export interface TimelineInputs {
  employees: TimelineEmployee[];
  transfers: TimelineTransfer[];
  resignations: TimelineResignation[];
}

export type TimelineRecordType = 'hire' | 'transfer' | 'promotion' | 'demotion' | 'salary_adjust' | 'resign';

export interface TimelineRecord {
  id: string;
  employeeId: number;
  departmentId?: number;
  employeeName: string;
  employeeNo: string;
  type: TimelineRecordType;
  occurredAt: string; // YYYY-MM-DD
  fromText?: string | null;
  toText?: string | null;
  detailText: string;
  reason?: string | null;
}

export type TimelineTypeCounts = Record<TimelineRecordType, number>;

export interface TimelineMonthPoint {
  month: string; // YYYY-MM
  total: number;
  counts: TimelineTypeCounts;
}

export interface TimelineEmployeeSummary {
  employeeId: number;
  employeeName: string;
  employeeNo: string;
  departmentId?: number;
  total: number;
  firstAt: string;
  lastAt: string;
  counts: TimelineTypeCounts;
}

/**
 * 履历概览：一次请求同时供「统计概览 / 时间轴 / 按员工」三种视图使用，
 * 避免前端为切换视图再翻页拉全量。
 */
export interface TimelineSummary {
  /** 当前筛选（含类型）的命中记录数，与分页 total 一致 */
  total: number;
  /** 忽略「类型」筛选后的记录数，用于类型页签上的「全部 N」 */
  scopeTotal: number;
  /** 各类型数量（忽略类型筛选，否则选中某类型后其余计数会全变 0） */
  counts: TimelineTypeCounts;
  /** 近 12 个月（以数据最新月份为右端）的按月分布，升序，空月补齐 */
  months: TimelineMonthPoint[];
  /** 按员工聚合（跟随类型筛选，按最近变动倒序） */
  employees: TimelineEmployeeSummary[];
  /** 当前筛选下的全量记录（时间倒序，最多 TIMELINE_RECORDS_LIMIT 条） */
  records: TimelineRecord[];
  /** records 是否因超限被截断 */
  truncated: boolean;
}

export interface TimelineFilters {
  keyword?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: number;
  departmentId?: number;
  page?: number;
  pageSize?: number;
}

export interface TimelinePage {
  list: TimelineRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary: TimelineSummary;
}

/** 时间轴/按员工视图走全量records，上限防单次响应过大 */
export const TIMELINE_RECORDS_LIMIT = 2000;

const MONTH_WINDOW = 12;

const RECORD_TYPES: TimelineRecordType[] = [
  'hire',
  'transfer',
  'promotion',
  'demotion',
  'salary_adjust',
  'resign',
];

function emptyCounts(): TimelineTypeCounts {
  return {
    hire: 0,
    transfer: 0,
    promotion: 0,
    demotion: 0,
    salary_adjust: 0,
    resign: 0,
  };
}

function toISODate(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    // 业务日以 UTC 午夜存储：取年月日必须用 getUTC*，否则 UTC+8 的容器会把
    // 月末/月初的记录算到相邻月份（月份趋势图整体错一格）
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, '0');
    const d = String(v.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

/** 以 latestMonth 为右端，向前取 size 个月（含本月），升序返回 YYYY-MM */
function monthWindow(latestMonth: string, size: number): string[] {
  const [year, mon] = latestMonth.split('-').map(Number);
  if (!year || !mon) return [];
  const out: string[] = [];
  for (let i = size - 1; i >= 0; i -= 1) {
    // Date.UTC 对负数月份会自动回退年份（1 月往前 = 上一年 12 月）
    const d = new Date(Date.UTC(year, mon - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function currentMonthUtc(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** 将多种来源（员工/调动/离职）聚合成统一的履历流，按发生日期倒序分页 */
export function buildTimeline(
  inputs: TimelineInputs,
  filters: TimelineFilters,
): TimelinePage {
  const { employees = [], transfers = [], resignations = [] } = inputs;
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;
  const keyword = (filters.keyword || '').trim().toLowerCase();

  // 类型筛选单独处理：统计口径（类型计数、月度趋势）必须忽略它，
  // 否则点选「离职」后其余类型的柱子和计数全部归零，用户看不出分布
  const matches = (rec: TimelineRecord, withType: boolean): boolean => {
    if (filters.employeeId && rec.employeeId !== filters.employeeId) return false;
    if (filters.departmentId && rec.departmentId !== filters.departmentId) return false;
    if (withType && filters.type && rec.type !== filters.type) return false;
    if (keyword && !rec.employeeName.toLowerCase().includes(keyword) && !rec.employeeNo.toLowerCase().includes(keyword)) {
      return false;
    }
    if (filters.dateFrom && rec.occurredAt < filters.dateFrom) return false;
    if (filters.dateTo && rec.occurredAt > filters.dateTo) return false;
    return true;
  };

  const records: TimelineRecord[] = [];

  // 入职：以员工入职日期为准
  for (const emp of employees) {
    const occurredAt = toISODate(emp.hireDate);
    if (!occurredAt) continue;
    const deptPos = [emp.department, emp.position].filter(Boolean).join(' · ');
    records.push({
      id: `hire-${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeNo: emp.employeeNo,
      departmentId: emp.departmentId,
      type: 'hire',
      occurredAt,
      toText: deptPos || null,
      detailText: `入职岗位${deptPos ? `：${deptPos}` : ''}`,
    });
  }

  // 调动/晋升/降级/调薪
  for (const t of transfers) {
    const occurredAt = toISODate(t.effectiveDate);
    if (!occurredAt) continue;
    records.push({
      id: `${t.type}-${t.id}`,
      employeeId: t.employeeId,
      employeeName: t.employeeName,
      employeeNo: t.employeeNo,
      departmentId: t.departmentId,
      type: t.type as TimelineRecordType,
      occurredAt,
      fromText: t.fromText || null,
      toText: t.toText || null,
      detailText: `${t.fromText ?? '-'} → ${t.toText ?? '-'}`,
      reason: t.reason || undefined,
    });
  }

  // 离职
  for (const r of resignations) {
    const occurredAt = toISODate(r.resignDate);
    if (!occurredAt) continue;
    records.push({
      id: `resign-${r.id}`,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      employeeNo: r.employeeNo,
      departmentId: r.departmentId,
      type: 'resign',
      occurredAt,
      fromText: r.department || null,
      detailText: `离任${r.department ? `：${r.department}` : ''}`,
      reason: r.reason || undefined,
    });
  }

  const sortDesc = (a: TimelineRecord, b: TimelineRecord): number =>
    a.occurredAt === b.occurredAt
      ? Number(a.id > b.id) - Number(a.id < b.id)
      : a.occurredAt < b.occurredAt
        ? 1
        : -1;

  const scopeRecords = records.filter((r) => matches(r, false)).sort(sortDesc);
  const filtered = filters.type
    ? scopeRecords.filter((r) => r.type === filters.type)
    : scopeRecords;

  // ---- 概览统计（忽略类型筛选）----
  const counts = emptyCounts();
  const monthBuckets = new Map<string, TimelineTypeCounts>();
  for (const r of scopeRecords) {
    counts[r.type] += 1;
    const mk = r.occurredAt.slice(0, 7);
    const bucket = monthBuckets.get(mk) ?? emptyCounts();
    bucket[r.type] += 1;
    monthBuckets.set(mk, bucket);
  }
  const latestMonth = scopeRecords.length > 0 ? scopeRecords[0].occurredAt.slice(0, 7) : currentMonthUtc();
  const months: TimelineMonthPoint[] = monthWindow(latestMonth, MONTH_WINDOW).map((month) => {
    const bucket = monthBuckets.get(month) ?? emptyCounts();
    return {
      month,
      total: RECORD_TYPES.reduce((sum, t) => sum + bucket[t], 0),
      counts: bucket,
    };
  });

  // ---- 按员工聚合（跟随类型筛选；filtered 已按时间倒序，首见即最近变动）----
  const employeeMap = new Map<number, TimelineEmployeeSummary>();
  for (const r of filtered) {
    const existing = employeeMap.get(r.employeeId);
    if (!existing) {
      const c = emptyCounts();
      c[r.type] = 1;
      employeeMap.set(r.employeeId, {
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        employeeNo: r.employeeNo,
        departmentId: r.departmentId,
        total: 1,
        firstAt: r.occurredAt,
        lastAt: r.occurredAt,
        counts: c,
      });
      continue;
    }
    existing.total += 1;
    existing.counts[r.type] += 1;
    if (r.occurredAt < existing.firstAt) existing.firstAt = r.occurredAt;
    // 部门以最近一条带部门的记录为准（调动后应显示新部门）
    if (!existing.departmentId && r.departmentId) existing.departmentId = r.departmentId;
  }
  const employeeGroups = Array.from(employeeMap.values()).sort(
    (a, b) => b.lastAt.localeCompare(a.lastAt) || b.total - a.total,
  );

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);

  return {
    list,
    total,
    page,
    pageSize,
    summary: {
      total,
      scopeTotal: scopeRecords.length,
      counts,
      months,
      employees: employeeGroups,
      records: filtered.slice(0, TIMELINE_RECORDS_LIMIT),
      truncated: total > TIMELINE_RECORDS_LIMIT,
    },
  };
}
