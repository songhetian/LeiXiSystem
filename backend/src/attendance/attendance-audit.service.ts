import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { LeaveStatus, OvertimeStatus } from '@prisma/client';

export interface AttendanceAuditQuery {
  page: number;
  pageSize: number;
  /** pending | approving | approved | rejected | cancelled | all */
  status?: string;
  /** leave | overtime | all */
  recordType?: string;
  departmentId?: number | string;
  keyword?: string;
  /** 仅请假：假期类型 id */
  vacationTypeId?: number | string;
  /** 业务日期起点 YYYY-MM-DD */
  startDate?: string;
  /** 业务日期终点 YYYY-MM-DD */
  endDate?: string;
}

export interface AttendanceAuditRow {
  recordType: 'leave' | 'overtime';
  id: number;
  employeeId: number;
  employeeName: string;
  employeeNo: string;
  departmentId: number | null;
  departmentName: string;
  businessTypeName: string;
  status: string;
  approvalInstanceId: number | null;
  approvalNote: string | null;
  createdAt: Date;
  reason: string | null;
  // leave 专属
  startDate: Date | null;
  endDate: Date | null;
  days: number | null;
  // overtime 专属
  overtimeDate: Date | null;
  hours: number | null;
}

// 批次六 · 考勤申请聚合审计（对齐参考 CompensatoryApproval 的审批人审计信息层级；
// 聚合请假/加班申请，复用现有审批实例 approve/reject 端点，不引入参考的排班交换缺陷）
@Injectable()
export class AttendanceAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async list(userId: number, query: AttendanceAuditQuery) {
    const scope = await this.dataScope.visibleScope(userId);
    const employeeCond = this.buildEmployeeCondition(scope, query);
    const status = query.status && query.status !== 'all' ? query.status : undefined;

    const runLeave = query.recordType !== 'overtime';
    const runOvertime = query.recordType !== 'leave';

    const [leaves, overtimes] = await Promise.all([
      runLeave
        ? this.prisma.leaveRecord.findMany({
            where: {
              ...(scope.selfEmployeeId
                ? { employeeId: scope.selfEmployeeId }
                : { employee: employeeCond }),
              ...(status ? { status: status as LeaveStatus } : {}),
              ...(this.toNum(query.vacationTypeId) !== undefined
                ? { vacationTypeId: this.toNum(query.vacationTypeId) }
                : {}),
              ...(query.startDate
                ? { startDate: { gte: new Date(query.startDate) } }
                : {}),
              ...(query.endDate ? { startDate: { lte: new Date(query.endDate) } } : {}),
            },
            include: {
              employee: {
                select: {
                  employeeNo: true,
                  name: true,
                  department: { select: { id: true, name: true } },
                },
              },
              vacationType: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
      runOvertime
        ? this.prisma.overtimeRecord.findMany({
            where: {
              ...(scope.selfEmployeeId
                ? { employeeId: scope.selfEmployeeId }
                : { employee: employeeCond }),
              ...(status ? { status: status as OvertimeStatus } : {}),
              ...(query.startDate
                ? { overtimeDate: { gte: new Date(query.startDate) } }
                : {}),
              ...(query.endDate
                ? { overtimeDate: { lte: new Date(query.endDate) } }
                : {}),
            },
            include: {
              employee: {
                select: {
                  employeeNo: true,
                  name: true,
                  department: { select: { id: true, name: true } },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ]);

    const rows: AttendanceAuditRow[] = [
      ...leaves.map((r) => this.normalizeLeave(r)),
      ...overtimes.map((r) => this.normalizeOvertime(r)),
    ];
    rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    return {
      list: rows.slice(start, start + query.pageSize),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // ADR-0010：可见部门范围统一经 DataScopeService 注入，构建 employee 过滤条件
  private buildEmployeeCondition(scope: { all: boolean; ids: number[] }, query: AttendanceAuditQuery) {
    const cond: Record<string, unknown> = {};
    if (!scope.all) cond.departmentId = { in: scope.ids };
    const fid = this.toNum(query.departmentId);
    if (fid !== undefined) {
      if (scope.all || scope.ids.includes(fid)) {
        cond.departmentId = { in: [fid] };
      } else {
        cond.departmentId = { in: [-1] };
      }
    }
    if (query.keyword) {
      cond.OR = [
        { name: { contains: query.keyword } },
        { employeeNo: { contains: query.keyword } },
      ];
    }
    return cond;
  }

  private toNum(v: number | string | undefined): number | undefined {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }

  private normalizeLeave(r: any): AttendanceAuditRow {
    return {
      recordType: 'leave',
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee?.name ?? '',
      employeeNo: r.employee?.employeeNo ?? '',
      departmentId: r.employee?.department?.id ?? null,
      departmentName: r.employee?.department?.name ?? '',
      businessTypeName: r.vacationType?.name ?? '',
      status: r.status,
      approvalInstanceId: r.approvalInstanceId,
      approvalNote: r.approvalNote,
      createdAt: r.createdAt,
      reason: r.reason ?? null,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days ? Number(r.days) : null,
      overtimeDate: null,
      hours: null,
    };
  }

  private normalizeOvertime(r: any): AttendanceAuditRow {
    return {
      recordType: 'overtime',
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employee?.name ?? '',
      employeeNo: r.employee?.employeeNo ?? '',
      departmentId: r.employee?.department?.id ?? null,
      departmentName: r.employee?.department?.name ?? '',
      businessTypeName: '加班',
      status: r.status,
      approvalInstanceId: r.approvalInstanceId,
      approvalNote: r.approvalNote,
      createdAt: r.createdAt,
      reason: r.reason ?? null,
      startDate: null,
      endDate: null,
      days: null,
      overtimeDate: r.overtimeDate,
      hours: r.hours ? Number(r.hours) : null,
    };
  }
}