import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { OperationLogService } from './operation-log.service';

export interface CleanupResult {
  operationLogs: number;
  notifications: number;
  exportTasks: number;
}

@Injectable()
export class DataCleanupService {
  private readonly logger = new Logger(DataCleanupService.name);

  private readonly DEFAULT_OPERATION_LOG_DAYS = 180;
  private readonly DEFAULT_NOTIFICATION_DAYS = 90;
  private readonly DEFAULT_EXPORT_TASK_DAYS = 30;

  private readonly SETTING_KEY_OPERATION_LOG = 'retention.operation_log_days';
  private readonly SETTING_KEY_NOTIFICATION = 'retention.notification_days';
  private readonly SETTING_KEY_EXPORT_TASK = 'retention.export_task_days';

  private readonly BATCH_SIZE = 1000;

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
    private operationLogService: OperationLogService,
  ) {}

  @Cron('0 2 * * *')
  async handleCron() {
    this.logger.log('开始执行历史数据定期清理定时任务');
    try {
      const result = await this.cleanAll();
      this.logger.log(
        `历史数据清理完成：操作日志 ${result.operationLogs} 条，通知 ${result.notifications} 条，导出任务 ${result.exportTasks} 条`,
      );
    } catch (err) {
      this.logger.error(
        '历史数据清理执行失败：' + (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  async cleanAll(): Promise<CleanupResult> {
    const [operationLogDays, notificationDays, exportTaskDays] = await Promise.all([
      this.getRetentionDays(this.SETTING_KEY_OPERATION_LOG, this.DEFAULT_OPERATION_LOG_DAYS),
      this.getRetentionDays(this.SETTING_KEY_NOTIFICATION, this.DEFAULT_NOTIFICATION_DAYS),
      this.getRetentionDays(this.SETTING_KEY_EXPORT_TASK, this.DEFAULT_EXPORT_TASK_DAYS),
    ]);

    const [operationLogs, notifications, exportTasks] = await Promise.all([
      this.cleanOperationLogs(operationLogDays),
      this.cleanNotifications(notificationDays),
      this.cleanExportTasks(exportTaskDays),
    ]);

    const total = operationLogs + notifications + exportTasks;
    if (total > 0) {
      await this.operationLogService.createLog({
        module: 'system',
        action: 'data_cleanup',
        status: 'success',
        params: JSON.stringify({ operationLogDays, notificationDays, exportTaskDays }),
        result: JSON.stringify({ operationLogs, notifications, exportTasks, total }),
      });
    }

    return { operationLogs, notifications, exportTasks };
  }

  async cleanOperationLogs(retentionDays: number): Promise<number> {
    const cutoffDate = this.getCutoffDate(retentionDays);
    this.logger.log(`清理操作日志：保留 ${retentionDays} 天，删除 ${cutoffDate.toISOString()} 之前的数据`);

    let totalDeleted = 0;
    while (true) {
      const logs = await this.prisma.operationLog.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: { id: true },
        take: this.BATCH_SIZE,
        orderBy: { id: 'asc' },
      });
      if (logs.length === 0) break;

      const ids = logs.map((l) => l.id);
      const result = await this.prisma.operationLog.deleteMany({
        where: { id: { in: ids } },
      });
      totalDeleted += result.count;
      if (logs.length < this.BATCH_SIZE) break;
    }

    this.logger.log(`操作日志清理完成，共删除 ${totalDeleted} 条`);
    return totalDeleted;
  }

  async cleanNotifications(retentionDays: number): Promise<number> {
    const cutoffDate = this.getCutoffDate(retentionDays);
    this.logger.log(`清理已读通知：保留 ${retentionDays} 天，删除 ${cutoffDate.toISOString()} 之前的已读通知`);

    let totalDeleted = 0;
    while (true) {
      const notifications = await this.prisma.notification.findMany({
        where: {
          read: true,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true },
        take: this.BATCH_SIZE,
        orderBy: { id: 'asc' },
      });
      if (notifications.length === 0) break;

      const ids = notifications.map((n) => n.id);
      const result = await this.prisma.notification.deleteMany({
        where: { id: { in: ids } },
      });
      totalDeleted += result.count;
      if (notifications.length < this.BATCH_SIZE) break;
    }

    this.logger.log(`通知清理完成，共删除 ${totalDeleted} 条已读通知`);
    return totalDeleted;
  }

  async cleanExportTasks(retentionDays: number): Promise<number> {
    const cutoffDate = this.getCutoffDate(retentionDays);
    this.logger.log(`清理导出任务：保留 ${retentionDays} 天，删除 ${cutoffDate.toISOString()} 之前的数据`);

    let totalDeleted = 0;
    while (true) {
      const tasks = await this.prisma.exportTask.findMany({
        where: { createdAt: { lt: cutoffDate } },
        select: { id: true },
        take: this.BATCH_SIZE,
        orderBy: { id: 'asc' },
      });
      if (tasks.length === 0) break;

      const ids = tasks.map((t) => t.id);
      const result = await this.prisma.exportTask.deleteMany({
        where: { id: { in: ids } },
      });
      totalDeleted += result.count;
      if (tasks.length < this.BATCH_SIZE) break;
    }

    this.logger.log(`导出任务清理完成，共删除 ${totalDeleted} 条`);
    return totalDeleted;
  }

  private async getRetentionDays(settingKey: string, defaultValue: number): Promise<number> {
    try {
      const setting = await this.settingsService.get(settingKey);
      const days = parseInt(setting.value, 10);
      if (!isNaN(days) && days > 0) {
        return days;
      }
      return defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private getCutoffDate(retentionDays: number): Date {
    return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  }
}
