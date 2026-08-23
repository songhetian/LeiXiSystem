import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ApprovalReminderService {
  private readonly logger = new Logger(ApprovalReminderService.name);
  private readonly DEFAULT_OVERDUE_DAYS = 3;
  private readonly SETTING_KEY = 'approval.overdue_days';
  private readonly NOTIFICATION_TYPE = 'approval_overdue';

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private settingsService: SettingsService,
  ) {}

  @Cron('0 9 * * *')
  async handleCron() {
    this.logger.log('开始执行审批超时提醒定时任务');
    try {
      const result = await this.checkOverdueAndNotify();
      this.logger.log(
        '审批超时提醒执行完成：共 ' + result.instanceCount + ' 条超时审批，提醒了 ' + result.remindedCount + ' 位审批人',
      );
    } catch (err) {
      this.logger.error(
        '审批超时提醒执行失败：' + (err instanceof Error ? err.message : String(err)),
      );
    }
  }

  async checkOverdueAndNotify(): Promise<{
    instanceCount: number;
    remindedCount: number;
  }> {
    const overdueDays = await this.getOverdueDays();
    const cutoffDate = new Date(Date.now() - overdueDays * 24 * 60 * 60 * 1000);

    const instances = await this.prisma.approvalInstance.findMany({
      where: {
        status: 'pending',
        createdAt: { lte: cutoffDate },
      },
      include: {
        records: {
          where: { status: 'pending' },
          include: { node: true },
        },
      },
    });

    if (instances.length === 0) {
      return { instanceCount: 0, remindedCount: 0 };
    }

    const approverInstancesMap = new Map<number, Array<{ id: number; title: string }>>();
    let totalInstancePairs = 0;

    for (const instance of instances) {
      const currentRecord = instance.records.find(
        (r) => r.nodeKey === instance.currentNodeKey && r.status === 'pending',
      );
      if (!currentRecord) continue;

      const approverIds = await this.getApproverIdsForNode(currentRecord.node);
      for (const userId of approverIds) {
        if (!approverInstancesMap.has(userId)) {
          approverInstancesMap.set(userId, []);
        }
        approverInstancesMap.get(userId)!.push({
          id: instance.id,
          title: instance.title,
        });
        totalInstancePairs++;
      }
    }

    let remindedCount = 0;
    const todayStart = this.getTodayStart();
    const todayEnd = this.getTodayEnd();

    for (const [userId, userInstances] of approverInstancesMap.entries()) {
      const alreadyNotified = await this.prisma.notification.count({
        where: {
          userId,
          type: this.NOTIFICATION_TYPE,
          createdAt: { gte: todayStart, lte: todayEnd },
        },
      });

      if (alreadyNotified > 0) {
        continue;
      }

      const count = userInstances.length;
      const displayTitles = userInstances.slice(0, 5).map((i) => i.title);
      const moreCount = count - displayTitles.length;

      let content = '';
      if (moreCount > 0) {
        content = displayTitles.join('、') + '...等 ' + count + ' 条审批已超时，请及时处理';
      } else {
        content = displayTitles.join('、') + ' 已超时，请及时处理';
      }

      await this.notificationService.create({
        userId,
        title: '您有 ' + count + ' 条审批已超时',
        content,
        type: this.NOTIFICATION_TYPE,
        relatedType: 'approval_overdue',
      });

      remindedCount++;
    }

    return {
      instanceCount: totalInstancePairs,
      remindedCount,
    };
  }

  private async getOverdueDays(): Promise<number> {
    try {
      const setting = await this.settingsService.get(this.SETTING_KEY);
      const days = parseInt(setting.value, 10);
      if (!isNaN(days) && days > 0) {
        return days;
      }
      return this.DEFAULT_OVERDUE_DAYS;
    } catch {
      return this.DEFAULT_OVERDUE_DAYS;
    }
  }

  private async getApproverIdsForNode(node: {
    type: string;
    roleCode?: string | null;
    approvalGroupId?: number | null;
  }): Promise<number[]> {
    if (node.type === 'role' && node.roleCode) {
      const userRoles = await this.prisma.userRole.findMany({
        where: { role: { code: node.roleCode } },
        select: { userId: true },
      });
      return userRoles.map((ur) => ur.userId);
    }

    if (node.type === 'group' && node.approvalGroupId) {
      const members = await this.prisma.approvalGroupMember.findMany({
        where: { groupId: node.approvalGroupId },
        select: { userId: true },
      });
      return members.map((m) => m.userId);
    }

    return [];
  }

  private getTodayStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  private getTodayEnd(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }
}
