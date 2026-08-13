import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { AttendanceDailyService } from './attendance-daily.service';

@Injectable()
export class AttendanceDailyRecalcService {
  private readonly logger = new Logger(AttendanceDailyRecalcService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyService: AttendanceDailyService,
  ) {}

  @Cron('0 0 2 * * *')
  async handleDailyRecalc() {
    this.logger.log('开始执行每日考勤日报定时重算');
    const result = await this.runDailyRecalc();
    if (result.success) {
      this.logger.log(`每日重算完成，处理 ${result.recordCount} 条记录，耗时 ${result.durationMs}ms`);
    } else {
      this.logger.error(`每日重算失败: ${result.error}`);
    }
  }

  async runDailyRecalc() {
    const startTime = Date.now();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = this.formatDate(yesterday);
    const endDate = this.formatDate(yesterday);

    const task = await this.prisma.attendanceDailyRecalcTask.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'running',
        triggerType: 'cron',
      },
    });

    try {
      const adminUser = await this.prisma.user.findFirst({
        where: { username: 'admin' },
      });
      const userId = adminUser?.id || 1;

      const result = await this.dailyService.recalculate({
        startDate,
        endDate,
        userId,
      });

      const durationMs = Date.now() - startTime;
      await this.prisma.attendanceDailyRecalcTask.update({
        where: { id: task.id },
        data: {
          status: 'success',
          recordCount: result.count,
          durationMs,
          finishedAt: new Date(),
        },
      });

      return { success: true, recordCount: result.count, durationMs, taskId: task.id };
    } catch (e: any) {
      const durationMs = Date.now() - startTime;
      await this.prisma.attendanceDailyRecalcTask.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorMessage: e.message || String(e),
          durationMs,
          finishedAt: new Date(),
        },
      });
      return { success: false, error: e.message || String(e), durationMs, taskId: task.id };
    }
  }

  async createTask(params: {
    startDate: string;
    endDate: string;
    userId?: number;
    triggerType?: string;
  }) {
    const { startDate, endDate, userId, triggerType = 'manual' } = params;
    return this.prisma.attendanceDailyRecalcTask.create({
      data: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'running',
        triggeredBy: userId,
        triggerType,
      },
    });
  }

  async completeTask(id: number, success: boolean, recordCount: number, durationMs: number, errorMessage?: string) {
    return this.prisma.attendanceDailyRecalcTask.update({
      where: { id },
      data: {
        status: success ? 'success' : 'failed',
        recordCount,
        errorMessage,
        durationMs,
        finishedAt: new Date(),
      },
    });
  }

  async listTasks(params: { page: number; pageSize: number; status?: string }) {
    const { page, pageSize, status } = params;
    const where: any = {};
    if (status) where.status = status;

    const [total, list] = await Promise.all([
      this.prisma.attendanceDailyRecalcTask.count({ where }),
      this.prisma.attendanceDailyRecalcTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { list, total, page, pageSize };
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
