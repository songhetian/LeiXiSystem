import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { withEventRetry } from '../common/event-retry.util';
import { Prisma, AttendanceDailyStatus } from '@prisma/client';

@Injectable()
export class AttendanceApprovalListener {
  private readonly logger = new Logger(AttendanceApprovalListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('approval.approved')
  async handleApproved(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        if (workflowCode === 'leave') {
          await this.handleLeaveApproved(instanceId);
        } else if (workflowCode === 'overtime') {
          await this.handleOvertimeApproved(instanceId);
        } else if (workflowCode === 'punch_makeup') {
          await this.handlePunchMakeupApproved(instanceId);
        }
      },
      `approval.approved (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.rejected')
  async handleRejected(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        if (workflowCode === 'leave') {
          await this.handleLeaveRejected(instanceId);
        } else if (workflowCode === 'overtime') {
          await this.handleOvertimeRejected(instanceId);
        } else if (workflowCode === 'punch_makeup') {
          await this.handlePunchMakeupRejected(instanceId);
        }
      },
      `approval.rejected (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.withdrawn')
  async handleWithdrawn(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        if (workflowCode === 'leave') {
          await this.handleLeaveWithdrawn(instanceId);
        } else if (workflowCode === 'overtime') {
          await this.handleOvertimeWithdrawn(instanceId);
        } else if (workflowCode === 'punch_makeup') {
          await this.handlePunchMakeupWithdrawn(instanceId);
        }
      },
      `approval.withdrawn (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  @OnEvent('approval.resubmitted')
  async handleResubmitted(payload: any) {
    const { instanceId, workflowCode } = payload;
    if (!workflowCode) return;

    await withEventRetry(
      async () => {
        if (workflowCode === 'leave') {
          await this.handleLeaveResubmitted(instanceId);
        } else if (workflowCode === 'overtime') {
          await this.handleOvertimeResubmitted(instanceId);
        } else if (workflowCode === 'punch_makeup') {
          await this.handlePunchMakeupResubmitted(instanceId);
        }
      },
      `approval.resubmitted (${workflowCode})`,
      payload,
      this.logger,
    );
  }

  private async handleLeaveApproved(instanceId: number) {
    const record = await this.prisma.leaveRecord.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { vacationType: true },
    });
    if (!record) return;
    if (record.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.leaveRecord.update({
        where: { id: record.id },
        data: { status: 'approved', approvedAt: new Date() },
      });

      const year = record.startDate.getFullYear();
      const balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId: record.employeeId,
            vacationTypeId: record.vacationTypeId,
            year,
          },
        },
      });

      const balanceBefore = balance?.usedDays ?? new Prisma.Decimal(0);
      const balanceAfter = balanceBefore.add(record.days);
      const totalDays = balance?.totalDays ?? new Prisma.Decimal(0);

      if (balance) {
        await tx.vacationBalance.update({
          where: { id: balance.id },
          data: { usedDays: balanceAfter },
        });
      } else {
        await tx.vacationBalance.create({
          data: {
            employeeId: record.employeeId,
            vacationTypeId: record.vacationTypeId,
            year,
            totalDays,
            usedDays: record.days,
          },
        });
      }

      await tx.vacationBalanceChange.create({
        data: {
          employeeId: record.employeeId,
          balanceId: balance?.id ?? 0,
          changeType: 'deduction',
          amount: record.days,
          balanceBefore,
          balanceAfter,
          reason: `请假审批通过`,
          referenceType: 'leave_record',
          referenceId: record.id,
        },
      });

      if (!balance) {
        const newBalance = await tx.vacationBalance.findUnique({
          where: {
            employeeId_vacationTypeId_year: {
              employeeId: record.employeeId,
              vacationTypeId: record.vacationTypeId,
              year,
            },
          },
        });
        if (newBalance) {
          await tx.vacationBalanceChange.updateMany({
            where: { referenceType: 'leave_record', referenceId: record.id },
            data: { balanceId: newBalance.id },
          });
        }
      }
    });

    this.logger.log(`请假审批通过，扣减假期余额：leaveId=${record.id}, days=${record.days}`);
  }

  private async handleLeaveRejected(instanceId: number) {
    const record = await this.prisma.leaveRecord.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { vacationType: true },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.leaveRecord.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });

      if (record.status === 'approved') {
        await this.refundLeaveBalance(tx as any, record);
      }
    });
  }

  private async handleLeaveWithdrawn(instanceId: number) {
    const record = await this.prisma.leaveRecord.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { vacationType: true },
    });
    if (!record) return;
    if (record.status !== 'approving' && record.status !== 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.leaveRecord.update({
        where: { id: record.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (record.status === 'approved') {
        await this.refundLeaveBalance(tx as any, record);
      }
    });
  }

  private async refundLeaveBalance(
    tx: any,
    record: { id: number; employeeId: number; vacationTypeId: number; days: Prisma.Decimal },
  ) {
    const year = new Date().getFullYear();
    const balance = await tx.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year: {
          employeeId: record.employeeId,
          vacationTypeId: record.vacationTypeId,
          year,
        },
      },
    });

    if (!balance) return;

    const balanceBefore = balance.usedDays;
    const balanceAfter = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      balanceBefore.sub(record.days),
    );

    await tx.vacationBalance.update({
      where: { id: balance.id },
      data: { usedDays: balanceAfter },
    });

    await tx.vacationBalanceChange.create({
      data: {
        employeeId: record.employeeId,
        balanceId: balance.id,
        changeType: 'addition',
        amount: record.days,
        balanceBefore,
        balanceAfter,
        reason: '请假驳回/撤回，退回假期',
        referenceType: 'leave_record',
        referenceId: record.id,
      },
    });
  }

  private async handleOvertimeApproved(instanceId: number) {
    const record = await this.prisma.overtimeRecord.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'approved' && record.isCompensated) return;

    const compensatoryType = await this.prisma.vacationType.findUnique({
      where: { code: 'compensatory' },
    });
    if (!compensatoryType) {
      this.logger.error(`未找到调休假期类型，无法转换加班: overtimeId=${record.id}`);
      await this.prisma.overtimeRecord.update({
        where: { id: record.id },
        data: { status: 'approved', approvedAt: new Date() },
      });
      return;
    }

    const year = record.overtimeDate.getFullYear();
    const days = new Prisma.Decimal(record.hours).dividedBy(8);

    await this.prisma.$transaction(async (tx) => {
      const current = await tx.overtimeRecord.findUnique({
        where: { id: record.id },
      });
      if (!current) return;
      if (current.status === 'approved' && current.isCompensated) return;

      await tx.overtimeRecord.update({
        where: { id: record.id },
        data: { status: 'approved', approvedAt: new Date(), isCompensated: true, compensatedAt: new Date() },
      });

      let balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId: record.employeeId,
            vacationTypeId: compensatoryType.id,
            year,
          },
        },
      });

      if (!balance) {
        balance = await tx.vacationBalance.create({
          data: {
            employeeId: record.employeeId,
            vacationTypeId: compensatoryType.id,
            year,
            totalDays: 0,
            usedDays: 0,
          },
        });
      }

      const balanceBefore = new Prisma.Decimal(balance.totalDays).minus(balance.usedDays);
      const newTotal = new Prisma.Decimal(balance.totalDays).plus(days);
      const balanceAfter = newTotal.minus(balance.usedDays);

      await tx.vacationBalance.update({
        where: { id: balance.id },
        data: { totalDays: newTotal },
      });

      await tx.vacationBalanceChange.create({
        data: {
          employeeId: record.employeeId,
          balanceId: balance.id,
          changeType: 'conversion',
          amount: days,
          balanceBefore,
          balanceAfter,
          reason: `加班审批通过转调休 ${record.hours}小时`,
          referenceType: 'overtime_record',
          referenceId: record.id,
        },
      });
    });

    this.logger.log(`加班审批通过，转换调休：overtimeId=${record.id}, hours=${record.hours}, days=${days}`);
  }

  private async handleOvertimeRejected(instanceId: number) {
    const record = await this.prisma.overtimeRecord.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.overtimeRecord.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });

      if (record.status === 'approved' && record.isCompensated) {
        await this.revertOvertimeCompensatory(tx as any, record);
      }
    });
  }

  private async handleOvertimeWithdrawn(instanceId: number) {
    const record = await this.prisma.overtimeRecord.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status !== 'approving' && record.status !== 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.overtimeRecord.update({
        where: { id: record.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (record.status === 'approved' && record.isCompensated) {
        await this.revertOvertimeCompensatory(tx as any, record);
      }
    });
  }

  private async revertOvertimeCompensatory(
    tx: any,
    record: { id: number; employeeId: number; hours: Prisma.Decimal; overtimeDate: Date },
  ) {
    const compensatoryType = await tx.vacationType.findUnique({
      where: { code: 'compensatory' },
    });
    if (!compensatoryType) return;

    const year = record.overtimeDate.getFullYear();
    const days = new Prisma.Decimal(record.hours).dividedBy(8);

    const balance = await tx.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year: {
          employeeId: record.employeeId,
          vacationTypeId: compensatoryType.id,
          year,
        },
      },
    });

    if (!balance) return;

    const balanceBefore = new Prisma.Decimal(balance.totalDays).minus(balance.usedDays);
    const newTotal = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      new Prisma.Decimal(balance.totalDays).minus(days),
    );
    const balanceAfter = newTotal.minus(balance.usedDays);

    await tx.vacationBalance.update({
      where: { id: balance.id },
      data: { totalDays: newTotal },
    });

    await tx.overtimeRecord.update({
      where: { id: record.id },
      data: { isCompensated: false, compensatedAt: null },
    });

    await tx.vacationBalanceChange.create({
      data: {
        employeeId: record.employeeId,
        balanceId: balance.id,
        changeType: 'deduction',
        amount: days,
        balanceBefore,
        balanceAfter,
        reason: '加班驳回/撤回，扣回调休',
        referenceType: 'overtime_record',
        referenceId: record.id,
      },
    });
  }

  private async handlePunchMakeupApproved(instanceId: number) {
    const record = await this.prisma.punchMakeup.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.punchMakeup.update({
        where: { id: record.id },
        data: { status: 'approved', approvedAt: new Date() },
      });

      const daily = await tx.attendanceDaily.findUnique({
        where: {
          employeeId_workDate: {
            employeeId: record.employeeId,
            workDate: record.punchDate,
          },
        },
      });

      if (daily) {
        const updateData: any = { makeupReason: record.reason };

        if (record.punchType === 'check_in' && record.makeupTime) {
          if (!daily.firstPunch) {
            updateData.firstPunch = record.makeupTime;
            updateData.punchCount = { increment: 1 };
          }
          updateData.lateMinutes = 0;
        } else if (record.punchType === 'check_out' && record.makeupTime) {
          if (!daily.lastPunch) {
            updateData.lastPunch = record.makeupTime;
            updateData.punchCount = { increment: 1 };
          }
          updateData.earlyMinutes = 0;
        }

        const refreshed = await tx.attendanceDaily.update({
          where: { id: daily.id },
          data: updateData,
          select: {
            lateMinutes: true,
            earlyMinutes: true,
            absentMinutes: true,
            leaveDays: true,
            status: true,
          },
        });

        const newStatus = this.recalcDailyStatus(refreshed as any);
        if (newStatus !== daily.status) {
          await tx.attendanceDaily.update({
            where: { id: daily.id },
            data: { status: newStatus },
          });
        }
      }
    });

    this.logger.log(`补卡审批通过，更新考勤日报：makeupId=${record.id}`);
  }

  private async handlePunchMakeupRejected(instanceId: number) {
    const record = await this.prisma.punchMakeup.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'rejected') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.punchMakeup.update({
        where: { id: record.id },
        data: { status: 'rejected' },
      });
    });
  }

  private async handlePunchMakeupWithdrawn(instanceId: number) {
    const record = await this.prisma.punchMakeup.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status !== 'approving' && record.status !== 'approved') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.punchMakeup.update({
        where: { id: record.id },
        data: { status: 'draft', approvalInstanceId: null },
      });

      if (record.status === 'approved') {
        await this.revertPunchMakeupApproval(tx, record);
      }
    });
  }

  private async handleLeaveResubmitted(instanceId: number) {
    const record = await this.prisma.leaveRecord.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'approving') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.leaveRecord.update({
        where: { id: record.id },
        data: { status: 'approving' },
      });
    });
  }

  private async handleOvertimeResubmitted(instanceId: number) {
    const record = await this.prisma.overtimeRecord.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'approving') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.overtimeRecord.update({
        where: { id: record.id },
        data: { status: 'approving' },
      });
    });
  }

  private async handlePunchMakeupResubmitted(instanceId: number) {
    const record = await this.prisma.punchMakeup.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;
    if (record.status === 'approving') return;

    await this.prisma.$transaction(async (tx) => {
      await tx.punchMakeup.update({
        where: { id: record.id },
        data: { status: 'approving' },
      });
    });
  }

  private async revertPunchMakeupApproval(
    tx: any,
    record: { id: number; employeeId: number; punchDate: Date; punchType: string },
  ) {
    const daily = await tx.attendanceDaily.findUnique({
      where: {
        employeeId_workDate: {
          employeeId: record.employeeId,
          workDate: record.punchDate,
        },
      },
    });
    if (!daily) return;

    const updateData: any = {};
    if (record.punchType === 'check_in') {
      updateData.firstPunch = null;
      updateData.lateMinutes = daily.lateMinutes || 0;
      updateData.punchCount = { decrement: 1 };
    } else if (record.punchType === 'check_out') {
      updateData.lastPunch = null;
      updateData.earlyMinutes = daily.earlyMinutes || 0;
      updateData.punchCount = { decrement: 1 };
    }

    if (Object.keys(updateData).length > 0) {
      const refreshed = await tx.attendanceDaily.update({
        where: { id: daily.id },
        data: updateData,
        select: {
          lateMinutes: true,
          earlyMinutes: true,
          absentMinutes: true,
          leaveDays: true,
          status: true,
        },
      });

      const newStatus = this.recalcDailyStatus(refreshed as any);
      if (newStatus !== daily.status) {
        await tx.attendanceDaily.update({
          where: { id: daily.id },
          data: { status: newStatus },
        });
      }
    }
  }

  private recalcDailyStatus(daily: {
    lateMinutes: number;
    earlyMinutes: number;
    absentMinutes: number;
    leaveDays: Prisma.Decimal;
    status: string;
  }): AttendanceDailyStatus {
    if (daily.leaveDays && daily.leaveDays.gt(0)) return AttendanceDailyStatus.leave;
    if (daily.absentMinutes && daily.absentMinutes > 0) return AttendanceDailyStatus.absent;
    const hasLate = daily.lateMinutes > 0;
    const hasEarly = daily.earlyMinutes > 0;
    if (hasLate && hasEarly) return AttendanceDailyStatus.late_early;
    if (hasLate) return AttendanceDailyStatus.late;
    if (hasEarly) return AttendanceDailyStatus.early;
    return AttendanceDailyStatus.normal;
  }
}
