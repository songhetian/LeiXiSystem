import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 审批事件补偿服务（事务外事件最终一致性保障）
 *
 * 问题：审批通过/拒绝是数据库事务，但事件发布在事务外。
 * 若进程在事务提交后、事件发布前崩溃，会导致「审批显示终态但业务数据没更新」。
 *
 * 方案：定时扫描最近 N 小时内的终态审批单，重新发布事件。
 * 监听器侧已有幂等检查（status === 'approved' 则跳过），重复发布安全。
 *
 * 恢复窗口：最多延迟 10 分钟（默认调度频率）
 */
@Injectable()
export class ApprovalReconcilerService {
  private readonly logger = new Logger(ApprovalReconcilerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    try {
      const count = await this.reconcileRecent(1);
      if (count > 0) {
        this.logger.log(`[reconciler] 重发 ${count} 个终态审批事件`);
      }
    } catch (err) {
      this.logger.error(
        `[reconciler] 补偿任务失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 扫描最近 hours 小时内的终态审批单，重新发布对应事件
   * @returns 重发的事件数量
   */
  async reconcileRecent(hours: number): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const instances = await this.prisma.approvalInstance.findMany({
      where: {
        status: { in: ['approved', 'rejected', 'cancelled'] },
        updatedAt: { gte: since },
      },
      select: {
        id: true,
        status: true,
        workflowId: true,
        workflowCode: true,
        applicantId: true,
        title: true,
        workflow: {
          select: { module: true },
        },
      },
    });

    let emitted = 0;
    for (const inst of instances) {
      const eventName = this.statusToEvent(inst.status);
      if (!eventName) continue;

      this.eventEmitter.emit(eventName, {
        instanceId: inst.id,
        workflowId: inst.workflowId,
        workflowCode: inst.workflowCode,
        module: (inst.workflow as any)?.module,
        status: inst.status,
        applicantId: inst.applicantId,
        title: inst.title,
        _reconciled: true,
      });
      emitted++;
    }

    return emitted;
  }

  private statusToEvent(status: string): string | null {
    switch (status) {
      case 'approved':
        return 'approval.approved';
      case 'rejected':
        return 'approval.rejected';
      case 'cancelled':
        return 'approval.withdrawn';
      default:
        return null;
    }
  }
}
