import { Injectable, ConflictException, UnprocessableEntityException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { employeeNoSchema } from '@lei/shared';
import { ERROR_CODES } from '../common/error-codes';

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
    } catch (e: any) {
      if (e.code === 'P2002') {
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
    const where: any = {};
    if (scope.selfEmployeeId) {
      where.employee = { id: scope.selfEmployeeId };
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (query.employeeNo) where.employeeNo = query.employeeNo;
    if (query.startDate || query.endDate) {
      where.punchTime = {};
      if (query.startDate) where.punchTime.gte = new Date(query.startDate + ' 00:00:00');
      if (query.endDate) where.punchTime.lte = new Date(query.endDate + ' 23:59:59');
    }
    if (query.status) where.status = query.status;

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
    const where: any = { employeeNo: { in: nos } };
    if (scope.selfEmployeeId) {
      where.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.departmentId = { in: scope.ids };
    }
    const emps = await this.prisma.employee.findMany({ where, select: { employeeNo: true } });
    return new Set(emps.map(e => e.employeeNo));
  }
}
