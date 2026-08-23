import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

const MAX_EXPORT_COUNT = 10000;

export interface AuditLogQuery {
  userId?: number;
  module?: string;
  action?: string;
  status?: string;
  ip?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class OperationLogService {
  constructor(private prisma: PrismaService) {}

  async createLog(params: {
    userId?: number;
    username?: string;
    module: string;
    action: string;
    method?: string;
    url?: string;
    ip?: string;
    params?: string;
    result?: string;
    status?: string;
  }) {
    return this.prisma.operationLog.create({ data: params });
  }

  private buildWhere(query: Partial<AuditLogQuery>) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.module) where.module = query.module;
    if (query.action) where.action = query.action;
    if (query.status) where.status = query.status;
    if (query.ip) where.ip = { contains: query.ip };
    if (query.keyword) {
      where.OR = [
        { username: { contains: query.keyword } },
        { action: { contains: query.keyword } },
        { module: { contains: query.keyword } },
        { url: { contains: query.keyword } },
        { ip: { contains: query.keyword } },
      ];
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate + 'T23:59:59');
    }
    return where;
  }

  async listLogs(params: AuditLogQuery) {
    const { page, pageSize } = params;
    const where = this.buildWhere(params);

    const [list, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.operationLog.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  /** 获取所有模块列表（用于筛选下拉） */
  async getModules(): Promise<string[]> {
    const result = await this.prisma.operationLog.findMany({
      select: { module: true },
      distinct: ['module'],
      take: 100,
    });
    return result.map((r) => r.module).filter(Boolean);
  }

  /** 获取所有操作类型列表（用于筛选下拉） */
  async getActions(module?: string): Promise<string[]> {
    const where: any = {};
    if (module) where.module = module;
    const result = await this.prisma.operationLog.findMany({
      select: { action: true },
      distinct: ['action'],
      where,
      take: 100,
    });
    return result.map((r) => r.action).filter(Boolean);
  }

  /** 统计概览：总记录数、今日、按模块分布 */
  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, todayCount, byModule] = await Promise.all([
      this.prisma.operationLog.count(),
      this.prisma.operationLog.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.operationLog.groupBy({
        by: ['module'],
        _count: { module: true },
        orderBy: { _count: { module: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total,
      todayCount,
      byModule: byModule.map((item) => ({
        module: item.module,
        count: item._count.module,
      })),
    };
  }

  async exportExcel(params: {
    startDate?: string;
    endDate?: string;
    module?: string;
    operatorId?: number;
    action?: string;
    statusCode?: string;
    ip?: string;
    keyword?: string;
  }): Promise<Buffer> {
    const where = this.buildWhere(params);
    if (params.operatorId) where.userId = params.operatorId;
    if (params.statusCode) where.status = params.statusCode;

    const count = await this.prisma.operationLog.count({ where });
    if (count > MAX_EXPORT_COUNT) {
      throw new BadRequestException({
        code: 4000,
        message: `导出数据量过大（${count} 条），请缩小筛选范围，最多导出 ${MAX_EXPORT_COUNT} 条`,
      });
    }

    const logs = await this.prisma.operationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_COUNT,
    });

    const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is number => id !== null))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, realName: true, username: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const employeeUserIds = userIds;
    const employees = await this.prisma.employee.findMany({
      where: { userId: { in: employeeUserIds } },
      select: { userId: true, departmentId: true },
    });
    const empDeptMap = new Map(employees.map((e) => [e.userId, e.departmentId]));

    const deptIds = [...new Set(employees.map((e) => e.departmentId).filter((id): id is number => id !== null))];
    const departments = await this.prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    });
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('操作日志');
    sheet.columns = [
      { header: '操作时间', key: 'createdAt', width: 20 },
      { header: '操作人', key: 'operatorName', width: 15 },
      { header: '所属部门', key: 'departmentName', width: 20 },
      { header: '模块', key: 'module', width: 15 },
      { header: '操作', key: 'action', width: 20 },
      { header: 'IP地址', key: 'ipAddress', width: 18 },
      { header: '请求路径', key: 'path', width: 30 },
      { header: '方法', key: 'method', width: 10 },
      { header: '状态', key: 'status', width: 10 },
      { header: '耗时(ms)', key: 'duration', width: 12 },
    ];

    logs.forEach((log) => {
      const user = log.userId ? userMap.get(log.userId) : null;
      const deptId = log.userId ? empDeptMap.get(log.userId) : null;
      const deptName = deptId ? deptMap.get(deptId) || '' : '';

      sheet.addRow({
        createdAt: log.createdAt ? log.createdAt.toISOString().replace('T', ' ').slice(0, 19) : '',
        operatorName: user?.realName || log.username || '',
        departmentName: deptName,
        module: log.module || '',
        action: log.action || '',
        ipAddress: log.ip || '',
        path: log.url || '',
        method: log.method || '',
        status: log.status || '',
        duration: '-',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }
}
