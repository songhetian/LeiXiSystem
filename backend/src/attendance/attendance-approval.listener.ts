import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { withEventRetry } from '../common/event-retry.util';
import { Prisma, AttendanceDailyStatus } from '@prisma/client';
import { isMonthlyDays } from './vacation-monthly';
import { getOvertimeToLeaveHours, overtimeHoursToLeaveDays } from './overtime-conversion';

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

    // 业务日以 UTC 存储，必须用 getUTC* 取年份：负时区宿主机上本地 getFullYear()
    // 会把 UTC 午夜的跨年日期退回上一年，导致扣减落到不存在的额度行。
    const year = record.startDate.getUTCFullYear();
    const month = record.month ?? 0;
    let deducted = false;

    // 幂等：以「approving → approved」条件更新作为一次性令牌。
    // VacationService.approveLeave（审批回调）与本监听是两条独立路径，
    // 共用同一令牌，只有抢到状态迁移的一方执行扣减。
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRecord.updateMany({
        where: { id: record.id, status: 'approving' },
        data: { status: 'approved', approvedAt: new Date() },
      });
      if (claimed.count === 0) return;

      const balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year_month: {
            employeeId: record.employeeId,
            vacationTypeId: record.vacationTypeId,
            year,
            month,
          },
        },
      });

      // 与 VacationService.deductLeaveBalance 保持同一口径：额度行缺失时不阻断审批通过，
      // 但绝不伪造 totalDays=0 的额度行（那会让「剩余天数」直接变成负数），仅记日志待人工补额度。
      if (!balance) {
        this.logger.error(
          `请假审批通过但休假额度行缺失，未扣减：leaveId=${record.id}, employeeId=${record.employeeId}, vacationTypeId=${record.vacationTypeId}, year=${year}, month=${month}`,
        );
        return;
      }

      const newUsed = new Prisma.Decimal(balance.usedDays).plus(record.days);
      // 流水口径与 VacationService 一致，统一记「剩余天数」（totalDays - usedDays）
      const balanceBefore = new Prisma.Decimal(balance.totalDays).minus(balance.usedDays);
      const balanceAfter = new Prisma.Decimal(balance.totalDays).minus(newUsed);

      await tx.vacationBalance.update({
        where: { id: balance.id },
        data: { usedDays: newUsed },
      });

      await tx.vacationBalanceChange.create({
        data: {
          employeeId: record.employeeId,
          balanceId: balance.id,
          changeType: 'deduction',
          amount: record.days,
          balanceBefore,
          balanceAfter,
          reason: `请假审批通过`,
          referenceType: 'leave_record',
          referenceId: record.id,
        },
      });

      deducted = true;
    });

    if (deducted) {
      this.logger.log(`请假审批通过，扣减假期余额：leaveId=${record.id}, days=${record.days}`);
    }
  }

  private async handleLeaveRejected(instanceId: number) {
    const record = await this.prisma.leaveRecord.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { vacationType: true },
    });
    if (!record) return;

    await this.prisma.$transaction(async (tx) => {
      // 必须以「事务内最新状态」决定是否退款：事件可能在本条记录的「通过」事务
      // 提交前就被读取（那时还是 approving），提交后却仍抢到驳回。若沿用事务外
      // 旧快照判定，就会出现「状态被改成 rejected 但额度没有退回」的永久少退。
      const current = await tx.leaveRecord.findUnique({ where: { id: record.id } });
      if (!current) return;
      // 收紧幂等令牌：仅「审批中/已通过」可驳回；draft/已驳回等状态不应被事件改写
      if (current.status !== 'approving' && current.status !== 'approved') return;

      const claimed = await tx.leaveRecord.updateMany({
        where: { id: record.id, status: current.status },
        data: { status: 'rejected' },
      });
      if (claimed.count === 0) return;

      if (current.status === 'approved') {
        await this.refundLeaveBalance(tx as any, current);
      }
    });
  }

  private async handleLeaveWithdrawn(instanceId: number) {
    const record = await this.prisma.leaveRecord.findFirst({
      where: { approvalInstanceId: instanceId },
      include: { vacationType: true },
    });
    if (!record) return;

    await this.prisma.$transaction(async (tx) => {
      // 同 handleLeaveRejected：以事务内最新状态判定，避免撤回后额度不退回。
      const current = await tx.leaveRecord.findUnique({ where: { id: record.id } });
      if (!current) return;
      if (current.status !== 'approving' && current.status !== 'approved') return;

      const claimed = await tx.leaveRecord.updateMany({
        where: { id: record.id, status: current.status },
        data: { status: 'draft', approvalInstanceId: null },
      });
      if (claimed.count === 0) return;

      if (current.status === 'approved') {
        await this.refundLeaveBalance(tx as any, current);
      }
    });
  }

  private async refundLeaveBalance(
    tx: any,
    record: {
      id: number;
      employeeId: number;
      vacationTypeId: number;
      month?: number | null;
      days: Prisma.Decimal;
      startDate: Date;
    },
  ) {
    // 年份必须与扣减时一致（扣减用 startDate 年份），否则跨年撤回会找不到额度而静默丢失
    const year = record.startDate.getUTCFullYear();
    const month = record.month ?? 0;
    const balance = await tx.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year_month: {
          employeeId: record.employeeId,
          vacationTypeId: record.vacationTypeId,
          year,
          month,
        },
      },
    });

    if (!balance) return;

    const newUsed = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      new Prisma.Decimal(balance.usedDays).sub(record.days),
    );
    // 口径与扣减一致：流水统一记「剩余天数」（totalDays - usedDays）
    const balanceBefore = new Prisma.Decimal(balance.totalDays).minus(balance.usedDays);
    const balanceAfter = new Prisma.Decimal(balance.totalDays).minus(newUsed);

    await tx.vacationBalance.update({
      where: { id: balance.id },
      data: { usedDays: newUsed },
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

    const year = record.overtimeDate.getUTCFullYear();
    const hoursPerDay = await getOvertimeToLeaveHours(this.prisma);
    const days = overtimeHoursToLeaveDays(record.hours, hoursPerDay);
    const isMonthlyComp = isMonthlyDays(compensatoryType.monthlyDays);
    const compMonth = isMonthlyComp ? record.overtimeDate.getUTCMonth() + 1 : 0;

    await this.prisma.$transaction(async (tx) => {
      // 一次性令牌：事件是 fire-and-forget 且可能重复投递（审批回调 + 事件监听
      // 是两条独立路径）。只有把 isCompensated 从 false 抢成 true 的一方才能入账，
      // 否则同一笔加班会被折算两次调休。
      const claimed = await tx.overtimeRecord.updateMany({
        where: { id: record.id, isCompensated: false },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          isCompensated: true,
          compensatedAt: new Date(),
        },
      });
      if (claimed.count === 0) return;

      let balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year_month: {
            employeeId: record.employeeId,
            vacationTypeId: compensatoryType.id,
            year,
            month: compMonth,
          },
        },
      });

      if (!balance) {
        balance = await tx.vacationBalance.create({
          data: {
            employeeId: record.employeeId,
            vacationTypeId: compensatoryType.id,
            year,
            month: compMonth,
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
      // 以事务内最新状态为准：并发下该加班可能刚被「通过」并折算过调休，
      // 此时驳回必须一并扣回，否则会留下「已驳回却仍占着调休」的错账。
      const current = await tx.overtimeRecord.findUnique({ where: { id: record.id } });
      if (!current) return;
      if (current.status !== 'approving' && current.status !== 'approved') return;

      const claimed = await tx.overtimeRecord.updateMany({
        where: { id: record.id, status: current.status },
        data: { status: 'rejected' },
      });
      if (claimed.count === 0) return;

      if (current.status === 'approved' && current.isCompensated) {
        await this.revertOvertimeCompensatory(tx as any, current);
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
      const current = await tx.overtimeRecord.findUnique({ where: { id: record.id } });
      if (!current) return;
      if (current.status !== 'approving' && current.status !== 'approved') return;

      const claimed = await tx.overtimeRecord.updateMany({
        where: { id: record.id, status: current.status },
        data: { status: 'draft', approvalInstanceId: null },
      });
      if (claimed.count === 0) return;

      if (current.status === 'approved' && current.isCompensated) {
        await this.revertOvertimeCompensatory(tx as any, current);
      }
    });
  }

  private async revertOvertimeCompensatory(
    tx: any,
    record: { id: number; employeeId: number; hours: Prisma.Decimal; overtimeDate: Date },
  ) {
    // 扣回的一次性令牌：只有确实处于「已兑换」状态的加班才能被扣回，
    // 重复投递的驳回/撤回事件不得二次扣回调休。
    const reverted = await tx.overtimeRecord.updateMany({
      where: { id: record.id, isCompensated: true },
      data: { isCompensated: false, compensatedAt: null },
    });
    if (reverted.count === 0) return;

    const compensatoryType = await tx.vacationType.findUnique({
      where: { code: 'compensatory' },
    });
    if (!compensatoryType) return;

    const year = record.overtimeDate.getUTCFullYear();
    const hoursPerDay = await getOvertimeToLeaveHours(tx);
    const days = overtimeHoursToLeaveDays(record.hours, hoursPerDay);
    const isMonthlyComp = isMonthlyDays(compensatoryType.monthlyDays);
    const compMonth = isMonthlyComp ? record.overtimeDate.getUTCMonth() + 1 : 0;

    const balance = await tx.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year_month: {
          employeeId: record.employeeId,
          vacationTypeId: compensatoryType.id,
          year,
          month: compMonth,
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
      // 一次性令牌：补卡落库（写 attendanceDaily）只在本监听器发生，
      // 因此必须由「approving → approved」条件更新来决定谁写卡，重复投递不得二次写卡。
      const claimed = await tx.punchMakeup.updateMany({
        where: { id: record.id, status: 'approving' },
        data: { status: 'approved', approvedAt: new Date() },
      });
      if (claimed.count === 0) return;

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

        // 补卡只在该方向确实缺卡时生效：已有真实打卡时既不能覆盖打卡时间，
        // 也不能把真实迟到/早退分钟清零（那等于给迟到洗白）。
        if (record.punchType === 'check_in' && record.makeupTime) {
          if (!daily.firstPunch) {
            updateData.firstPunch = record.makeupTime;
            updateData.punchCount = { increment: 1 };
            updateData.lateMinutes = 0;
          }
        } else if (record.punchType === 'check_out' && record.makeupTime) {
          if (!daily.lastPunch) {
            updateData.lastPunch = record.makeupTime;
            updateData.punchCount = { increment: 1 };
            updateData.earlyMinutes = 0;
          }
        }

        const refreshed = await tx.attendanceDaily.update({
          where: { id: daily.id },
          data: updateData,
          select: {
            punchCount: true,
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

    await this.prisma.$transaction(async (tx) => {
      // 与请假/加班同一口径：以「事务内最新状态」判定。事件可能在「通过」事务
      // 提交前被读取（那时还是 approving）、提交后却仍抢到驳回；若沿用事务外旧快照
      // 直接改写并回滚，会出现「状态被改成 rejected 但已写入的补卡没有撤回」的错账。
      const current = await tx.punchMakeup.findUnique({ where: { id: record.id } });
      if (!current) return;
      if (current.status !== 'approving' && current.status !== 'approved') return;

      const claimed = await tx.punchMakeup.updateMany({
        where: { id: record.id, status: current.status },
        data: { status: 'rejected' },
      });
      if (claimed.count === 0) return;

      // 已通过的补卡被驳回时，必须把本补卡写入的那次打卡一并撤回
      if (current.status === 'approved') {
        await this.revertPunchMakeupApproval(tx, current);
      }
    });
  }

  private async handlePunchMakeupWithdrawn(instanceId: number) {
    const record = await this.prisma.punchMakeup.findFirst({
      where: { approvalInstanceId: instanceId },
    });
    if (!record) return;

    await this.prisma.$transaction(async (tx) => {
      // 同 handlePunchMakeupRejected：状态与是否回滚都按事务内最新值判定
      const current = await tx.punchMakeup.findUnique({ where: { id: record.id } });
      if (!current) return;
      if (current.status !== 'approving' && current.status !== 'approved') return;

      const claimed = await tx.punchMakeup.updateMany({
        where: { id: record.id, status: current.status },
        data: { status: 'draft', approvalInstanceId: null },
      });
      if (claimed.count === 0) return;

      if (current.status === 'approved') {
        await this.revertPunchMakeupApproval(tx, current);
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
    record: {
      id: number;
      employeeId: number;
      punchDate: Date;
      punchType: string;
      makeupTime?: Date | null;
    },
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

    // 只有「审批时确实由本补卡写入」的打卡才能被撤回清除。审批时若该方向已有
    // 真实打卡则不会覆盖，撤回时若无条件清空会把真实打卡一并抹掉，并让
    // punchCount 减到与真实打卡数不符（甚至为负）。
    const writtenByThisMakeup = (current: Date | null | undefined) =>
      !!record.makeupTime && !!current && current.getTime() === record.makeupTime.getTime();

    const updateData: any = {};
    if (record.punchType === 'check_in') {
      if (writtenByThisMakeup(daily.firstPunch)) {
        updateData.firstPunch = null;
        updateData.punchCount = { decrement: 1 };
      }
    } else if (record.punchType === 'check_out') {
      if (writtenByThisMakeup(daily.lastPunch)) {
        updateData.lastPunch = null;
        updateData.punchCount = { decrement: 1 };
      }
    }

    if (Object.keys(updateData).length > 0) {
      const refreshed = await tx.attendanceDaily.update({
        where: { id: daily.id },
        data: updateData,
        select: {
          punchCount: true,
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
    punchCount: number;
    lateMinutes: number;
    earlyMinutes: number;
    absentMinutes: number;
    leaveDays: Prisma.Decimal;
    status: string;
  }): AttendanceDailyStatus {
    if (daily.leaveDays && daily.leaveDays.gt(0)) return AttendanceDailyStatus.leave;
    if (daily.absentMinutes && daily.absentMinutes > 0) return AttendanceDailyStatus.absent;
    // 撤回/驳回补卡后打卡次数会归零，而 absent_minutes 全库无人写正值
    // （引擎 upsert 不写该列），故缺勤只能由 punchCount 推导，否则会被洗成 normal。
    if (!daily.punchCount || daily.punchCount <= 0) return AttendanceDailyStatus.absent;
    // 与引擎 buildDaily 同口径：单日打卡 > 4 次视为异常
    if (daily.punchCount > 4) return AttendanceDailyStatus.abnormal;
    const hasLate = daily.lateMinutes > 0;
    const hasEarly = daily.earlyMinutes > 0;
    if (hasLate && hasEarly) return AttendanceDailyStatus.late_early;
    if (hasLate) return AttendanceDailyStatus.late;
    if (hasEarly) return AttendanceDailyStatus.early;
    return AttendanceDailyStatus.normal;
  }
}
