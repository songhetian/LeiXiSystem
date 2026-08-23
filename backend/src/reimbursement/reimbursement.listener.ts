import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { withEventRetry } from '../common/event-retry.util';
import { validateStateTransition, ReimbursementStatus } from './reimbursement-state-machine';

@Injectable()
export class ReimbursementListener {
  private readonly logger = new Logger(ReimbursementListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('approval.approved')
  async handleApprovalApproved(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (workflowCode !== 'reimbursement') return;

    await withEventRetry(
      async () => {
        const reimbursement = await this.prisma.reimbursement.findFirst({
          where: { approvalInstanceId: instanceId },
        });
        if (!reimbursement) return;
        if (reimbursement.status === 'approved') return;

        const validation = validateStateTransition(
          reimbursement.status as ReimbursementStatus,
          'approved',
        );
        if (!validation.valid) {
          this.logger.warn(
            `状态流转校验失败: reimbursementId=${reimbursement.id}, ${validation.message}`,
          );
          return;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.reimbursement.update({
            where: { id: reimbursement.id },
            data: { status: 'approved' },
          });

          const existingPayment = await tx.reimbursementPayment.findUnique({
            where: { reimbursementId: reimbursement.id },
          });
          if (!existingPayment) {
            await tx.reimbursementPayment.create({
              data: {
                reimbursementId: reimbursement.id,
                amount: reimbursement.totalAmount,
                status: 'pending',
                createdBy: reimbursement.applicantId,
              },
            });
          }
        });

        this.logger.log(`报销审批通过: reimbursementId=${reimbursement.id}, instanceId=${instanceId}`);
      },
      'approval.approved (reimbursement)',
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.rejected')
  async handleApprovalRejected(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (workflowCode !== 'reimbursement') return;

    await withEventRetry(
      async () => {
        const reimbursement = await this.prisma.reimbursement.findFirst({
          where: { approvalInstanceId: instanceId },
        });
        if (!reimbursement) return;
        if (reimbursement.status === 'rejected') return;

        const validation = validateStateTransition(
          reimbursement.status as ReimbursementStatus,
          'rejected',
        );
        if (!validation.valid) {
          this.logger.warn(
            `状态流转校验失败: reimbursementId=${reimbursement.id}, ${validation.message}`,
          );
          return;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.reimbursement.update({
            where: { id: reimbursement.id },
            data: { status: 'rejected' },
          });
        });

        this.logger.log(`报销审批拒绝: reimbursementId=${reimbursement.id}, instanceId=${instanceId}`);
      },
      'approval.rejected (reimbursement)',
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.withdrawn')
  async handleApprovalWithdrawn(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (workflowCode !== 'reimbursement') return;

    await withEventRetry(
      async () => {
        const reimbursement = await this.prisma.reimbursement.findFirst({
          where: { approvalInstanceId: instanceId },
        });
        if (!reimbursement) return;
        if (reimbursement.status !== 'approving' && reimbursement.status !== 'approved') return;

        const wasApproved = reimbursement.status === 'approved';

        const validation = validateStateTransition(
          reimbursement.status as ReimbursementStatus,
          'draft',
        );
        if (!validation.valid) {
          this.logger.warn(
            `状态流转校验失败: reimbursementId=${reimbursement.id}, ${validation.message}`,
          );
          return;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.reimbursement.update({
            where: { id: reimbursement.id },
            data: { status: 'draft', approvalInstanceId: null },
          });

          if (wasApproved) {
            const existingPayment = await tx.reimbursementPayment.findUnique({
              where: { reimbursementId: reimbursement.id },
            });
            if (existingPayment && existingPayment.status !== 'cancelled') {
              await tx.reimbursementPayment.update({
                where: { id: existingPayment.id },
                data: {
                  status: 'cancelled',
                  remark: '报销撤回，付款取消',
                },
              });
            }
          }
        });

        this.logger.log(`报销审批撤回: reimbursementId=${reimbursement.id}, instanceId=${instanceId}`);
      },
      'approval.withdrawn (reimbursement)',
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.resubmitted')
  async handleApprovalResubmitted(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (workflowCode !== 'reimbursement') return;

    await withEventRetry(
      async () => {
        const reimbursement = await this.prisma.reimbursement.findFirst({
          where: { approvalInstanceId: instanceId },
        });
        if (!reimbursement) return;
        if (reimbursement.status === 'approving') return;

        const validation = validateStateTransition(
          reimbursement.status as ReimbursementStatus,
          'approving',
        );
        if (!validation.valid) {
          this.logger.warn(
            `状态流转校验失败: reimbursementId=${reimbursement.id}, ${validation.message}`,
          );
          return;
        }

        await this.prisma.$transaction(async (tx) => {
          await tx.reimbursement.update({
            where: { id: reimbursement.id },
            data: { status: 'approving' },
          });
        });

        this.logger.log(`报销审批重提交: reimbursementId=${reimbursement.id}, instanceId=${instanceId}`);
      },
      'approval.resubmitted (reimbursement)',
      payload,
      this.logger,
    );
  }
}
