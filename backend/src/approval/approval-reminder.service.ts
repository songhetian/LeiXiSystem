import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationClientInterface } from '../notification/notification-client.interface';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class ApprovalReminderService {
  private readonly logger = new Logger(ApprovalReminderService.name);
  private readonly DEFAULT_OVERDUE_DAYS = 3;
  private readonly SETTING_KEY = 'approval.overdue_days';
  private readonly NOTIFICATION_TYPE = 'approval_overdue';

  constructor(
    private prisma: PrismaService,
    @Inject('NOTIFICATION_CLIENT') private notificationService: NotificationClientInterface,
    private settingsService: SettingsService,
  ) {}

  // 提醒语义是「上班后不久」：按北京时间 09:00 触发，避免容器 TZ=UTC 时错位到北京 17:00
  @Cron('0 9 * * *', { timeZone: 'Asia/Shanghai' })
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

      const approverIds = await this.getApproverIdsForNode(currentRecord.node, {
        applicantId: instance.applicantId,
        applicantDepartmentId: instance.departmentId,
      });
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

  /**
   * 解析当前节点应提醒的审批人。
   *
   * role/group 型节点与实例无关；department_manager/initiator 型节点依赖实例
   * 上下文（申请部门、申请人），必须传入 ctx，否则这类节点永远收不到超时提醒。
   * 与 approval.service#notifyApproversForNode 保持同一套口径。
   */
  private async getApproverIdsForNode(
    node: {
      type: string;
      roleCode?: string | null;
      approvalGroupId?: number | null;
    },
    ctx: { applicantId?: number | null; applicantDepartmentId?: number | null } = {},
  ): Promise<number[]> {
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

    if (node.type === 'department_manager') {
      const managerUserId = await this.resolveDepartmentManagerUserId(
        ctx.applicantDepartmentId,
      );
      return managerUserId === null ? [] : [managerUserId];
    }

    if (node.type === 'initiator') {
      return ctx.applicantId === undefined || ctx.applicantId === null
        ? []
        : [ctx.applicantId];
    }

    return [];
  }

  /** 申请部门的负责人 userId；部门为空或未设置负责人时返回 null。 */
  private async resolveDepartmentManagerUserId(
    departmentId?: number | null,
  ): Promise<number | null> {
    if (departmentId === undefined || departmentId === null) return null;
    const dept = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { manager: { select: { userId: true } } },
    });
    return dept?.manager?.userId ?? null;
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
