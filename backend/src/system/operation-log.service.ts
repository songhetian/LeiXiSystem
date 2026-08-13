import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async listLogs(params: {
    userId?: number;
    module?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }) {
    const { userId, module, startDate, endDate, page, pageSize } = params;
    const where: any = {};
    if (userId) where.userId = userId;
    if (module) where.module = module;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + 'T23:59:59');
    }

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
}
