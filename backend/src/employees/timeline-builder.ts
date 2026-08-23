export interface TimelineEmployee {
  id: number;
  name: string;
  employeeNo: string;
  status: string;
  hireDate: string | Date;
  resignDate?: string | Date | null;
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
  employeeName: string;
  employeeNo: string;
  type: TimelineRecordType;
  occurredAt: string; // YYYY-MM-DD
  fromText?: string | null;
  toText?: string | null;
  detailText: string;
  reason?: string | null;
}

export interface TimelineFilters {
  keyword?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: number;
  page?: number;
  pageSize?: number;
}

export interface TimelinePage {
  list: TimelineRecord[];
  total: number;
  page: number;
  pageSize: number;
}

function toISODate(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
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

  const matches = (rec: TimelineRecord): boolean => {
    if (filters.employeeId && rec.employeeId !== filters.employeeId) return false;
    if (filters.type && rec.type !== filters.type) return false;
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
      type: 'resign',
      occurredAt,
      fromText: r.department || null,
      detailText: `离任${r.department ? `：${r.department}` : ''}`,
      reason: r.reason || undefined,
    });
  }

  const filtered = records
    .filter(matches)
    .sort((a, b) => (a.occurredAt === b.occurredAt ? Number(a.id > b.id) - Number(a.id < b.id) : a.occurredAt < b.occurredAt ? 1 : -1));

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const list = filtered.slice(start, start + pageSize);
  return { list, total, page, pageSize };
}