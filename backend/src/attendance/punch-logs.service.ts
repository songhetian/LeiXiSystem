import { Injectable, ConflictException, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { employeeNoSchema } from '@lei/shared';
import { Prisma, $Enums } from '@prisma/client';
import { ERROR_CODES } from '../common/error-codes';
import { beijingDateRangeFilter } from '../common/date.util';
import { errorCode } from '../common/error.util';

interface PunchLogRow {
  employeeNo: string;
  punchTime: string;
  deviceNo: string;
}

@Injectable()
export class PunchLogsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
  ) {}

  async importCsv(csvText: string, userId: number) {
    const rows = this.parseCsv(csvText);
    if (rows.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: 'CSV 无有效数据' });
    }
    for (const row of rows) {
      const result = employeeNoSchema.safeParse(row.employeeNo);
      if (!result.success) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.PARAM_INVALID, message: `工号格式错误：${row.employeeNo}` });
      }
      if (!this.validateDateTime(row.punchTime)) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.PARAM_INVALID, message: `时间格式错误：${row.punchTime}` });
      }
    }

    const scope = await this.dataScope.visibleScope(userId);
    const validNos = await this.getValidEmployeeNos(rows.map(r => r.employeeNo), scope);
    for (const row of rows) {
      if (!validNos.has(row.employeeNo)) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.PARAM_INVALID, message: `工号不存在或无权限：${row.employeeNo}` });
      }
    }

    try {
      const count = await this.prisma.$transaction(async (tx) => {
        let n = 0;
        for (const row of rows) {
          await tx.punchLog.create({
            data: {
              employeeNo: row.employeeNo,
              deviceNo: row.deviceNo,
              punchTime: new Date(row.punchTime),
              source: 'import',
              status: 'pending',
              rawData: JSON.stringify(row),
            },
          });
          n++;
        }
        return n;
      });
      return { count };
    } catch (e) {
      if (errorCode(e) === 'P2002') {
        throw new ConflictException({ code: 2003, message: '打卡记录重复（已全部回滚）' });
      }
      throw e;
    }
  }

  async list(
    userId: number,
    query: { employeeNo?: string; startDate?: string; endDate?: string; status?: string; page: number; pageSize: number },
  ) {
    const scope = await this.dataScope.visibleScope(userId);
    // PunchLog 只有 employeeNo 字符串，没有 employee 关系，因此可见范围必须先落成
    // 工号集合再过滤（此前直接写 where.employee 是非法过滤键，非 admin 必 500）。
    // 此处用真实 Prisma 类型而非 any：将来再写错键名会被 tsc 直接拦下。
    const where: Prisma.PunchLogWhereInput = {};

    const visibleNos = await this.visibleEmployeeNos(scope);
    // null 表示全量（admin/hr）；数组表示可见工号（可能为空 = 无任何可见数据）
    const allowedNos: string[] | null = visibleNos
      ? query.employeeNo
        ? visibleNos.has(query.employeeNo)
          ? [query.employeeNo]
          : []
        : [...visibleNos]
      : query.employeeNo
        ? [query.employeeNo]
        : null;
    if (allowedNos) where.employeeNo = { in: allowedNos };

    // punchTime 是真实时刻列，前端按北京时间业务日传 'YYYY-MM-DD'。
    // 不能用 `new Date(str + ' 00:00:00')`：那按服务器本地时区解析，UTC 容器下
    // 会把北京当日 00:00~08:00 的打卡排除、并混入次日凌晨的记录。
    const punchRange = beijingDateRangeFilter(query.startDate, query.endDate);
    if (punchRange) where.punchTime = punchRange;
    if (query.status) where.status = query.status as $Enums.PunchLogStatus;

    const [list, total] = await Promise.all([
      this.prisma.punchLog.findMany({
        where,
        orderBy: { punchTime: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.punchLog.count({ where }),
    ]);
    return { list, total, page: query.page, pageSize: query.pageSize };
  }

  private parseCsv(text: string): PunchLogRow[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map(h => h.trim());
    const idxNo = header.findIndex(h => h.includes('工号') || h === 'employee_no');
    const idxTime = header.findIndex(h => h.includes('时间') || h === 'punch_time');
    const idxDev = header.findIndex(h => h.includes('设备') || h === 'device_no');
    if (idxNo < 0 || idxTime < 0 || idxDev < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: 'CSV 表头缺少必要字段（工号/打卡时间/设备号）' });
    }
    const rows: PunchLogRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3) continue;
      rows.push({
        employeeNo: cols[idxNo],
        punchTime: cols[idxTime],
        deviceNo: cols[idxDev],
      });
    }
    return rows;
  }

  private validateDateTime(s: string): boolean {
    const d = new Date(s);
    return !isNaN(d.getTime());
  }

  private async getValidEmployeeNos(nos: string[], scope: { all: boolean; ids: number[]; selfEmployeeId?: number }): Promise<Set<string>> {
    const where: Prisma.EmployeeWhereInput = { employeeNo: { in: nos } };
    if (scope.selfEmployeeId) {
      where.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.departmentId = { in: scope.ids };
    }
    const emps = await this.prisma.employee.findMany({ where, select: { employeeNo: true } });
    return new Set(emps.map(e => e.employeeNo));
  }

  /**
   * 把数据范围解析成「可见工号集合」。
   * - 全量（admin/hr）→ 返回 null，调用方不加过滤
   * - 员工本人 → 仅本人工号
   * - 部门范围 → 范围内所有员工的工号
   * 注意：部门范围为空集合时返回空 Set（而非 null），保证 fail-closed 而不是放行全量。
   */
  private async visibleEmployeeNos(
    scope: { all: boolean; ids: number[]; selfEmployeeId?: number },
  ): Promise<Set<string> | null> {
    if (scope.all) return null;
    if (scope.selfEmployeeId) {
      const emps = await this.prisma.employee.findMany({
        where: { id: scope.selfEmployeeId },
        select: { employeeNo: true },
      });
      return new Set(emps.map((e) => e.employeeNo));
    }
    const emps = await this.prisma.employee.findMany({
      where: { departmentId: { in: scope.ids } },
      select: { employeeNo: true },
    });
    return new Set(emps.map((e) => e.employeeNo));
  }
}
