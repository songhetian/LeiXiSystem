import { Injectable, UnprocessableEntityException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { ApprovalService } from '../approval/approval.service';
import { ERROR_CODES } from '../common/error-codes';

@Injectable()
export class VacationService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    private approvalService: ApprovalService,
  ) {}

  async listBalances(params: { employeeId?: number; year: number; userId: number }) {
    const { employeeId, year, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.VacationBalanceWhereInput = {
      year,
    };
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) where.employeeId = employeeId;

    const [data, total] = await Promise.all([
      this.prisma.vacationBalance.findMany({
        where,
        include: {
          vacationType: { select: { id: true, code: true, name: true } },
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
        orderBy: { vacationType: { sortOrder: 'asc' } },
      }),
      this.prisma.vacationBalance.count({ where }),
    ]);
    return { list: data, total };
  }

  async getMyBalances(userId: number, year?: number) {
    const y = year || new Date().getFullYear();
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return [];

    const balances = await this.prisma.vacationBalance.findMany({
      where: { employeeId: emp.id, year: y },
      include: {
        vacationType: { select: { id: true, code: true, name: true } },
      },
      orderBy: { vacationType: { sortOrder: 'asc' } },
    });
    return balances;
  }

  async listMyChanges(userId: number) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return [];

    const changes = await this.prisma.vacationBalanceChange.findMany({
      where: { employeeId: emp.id },
      include: {
        balance: { include: { vacationType: { select: { id: true, code: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return changes;
  }

  async createLeaveRecord(
    data: {
      employeeId: number;
      vacationTypeId: number;
      startDate: string;
      endDate: string;
      days: number;
      reason: string;
    },
    userId: number,
  ) {
    const year = new Date(data.startDate).getFullYear();
    const balance = await this.prisma.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year: {
          employeeId: data.employeeId,
          vacationTypeId: data.vacationTypeId,
          year,
        },
      },
    });
    if (!balance) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.VACATION_BALANCE_NOT_FOUND, message: '休假额度不存在' });
    }
    const remaining = new Prisma.Decimal(balance.totalDays).minus(balance.usedDays);
    if (remaining.lessThan(data.days)) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.VACATION_BALANCE_INSUFFICIENT, message: '休假额度不足' });
    }

    const record = await this.prisma.leaveRecord.create({
      data: {
        employeeId: data.employeeId,
        vacationTypeId: data.vacationTypeId,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days: new Prisma.Decimal(data.days),
        reason: data.reason,
        status: 'pending',
      },
    });

    return record;
  }

  async submitLeave(id: number, userId: number) {
    const leave = await this.prisma.leaveRecord.findUnique({ where: { id } });
    if (!leave) {
      throw new NotFoundException({ code: ERROR_CODES.LEAVE_NOT_FOUND, message: '请假记录不存在' });
    }
    const emp = await this.prisma.employee.findUnique({ where: { id: leave.employeeId } });
    if (!emp || emp.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权限操作' });
    }
    if (leave.status !== 'pending') {
      throw new BadRequestException({ code: ERROR_CODES.LEAVE_STATUS_INVALID, message: '当前状态不可提交审批' });
    }
    if (leave.approvalInstanceId) {
      throw new BadRequestException({ code: ERROR_CODES.LEAVE_ALREADY_SUBMITTED, message: '已在审批中' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalService.startInstance({
      workflowCode: 'leave',
      title: `请假申请 - ${emp.name}`,
      formData: {
        leaveId: leave.id,
        days: leave.days.toString(),
        vacationTypeId: leave.vacationTypeId,
      },
      userId,
      userName: user!.name,
      departmentId: emp.departmentId ?? undefined,
    });

    const updated = await this.prisma.leaveRecord.update({
      where: { id },
      data: {
        status: 'approving',
        approvalInstanceId: instance.id,
      },
    });

    return updated;
  }

  async approveLeave(id: number, userId: number, comment?: string) {
    const leave = await this.prisma.leaveRecord.findUnique({ where: { id } });
    if (!leave) {
      throw new NotFoundException({ code: ERROR_CODES.LEAVE_NOT_FOUND, message: '请假记录不存在' });
    }
    if (!leave.approvalInstanceId) {
      throw new BadRequestException({ code: ERROR_CODES.LEAVE_NOT_SUBMITTED, message: '未提交审批' });
    }
    if (leave.status !== 'approving') {
      throw new BadRequestException({ code: ERROR_CODES.LEAVE_STATUS_INVALID, message: '当前状态不可审批' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalService.approve({
      instanceId: leave.approvalInstanceId,
      userId,
      userName: user!.name,
      comment,
    });

    if (instance.status === 'approved') {
      await this.deductLeaveBalance(leave.id);
      const updated = await this.prisma.leaveRecord.update({
        where: { id },
        data: {
          status: 'approved',
          approverId: userId,
          approvedAt: new Date(),
          approvalNote: comment,
        },
      });
      return updated;
    }

    const updated = await this.prisma.leaveRecord.update({
      where: { id },
      data: { approvalNote: comment },
    });
    return updated;
  }

  async rejectLeave(id: number, userId: number, comment?: string) {
    const leave = await this.prisma.leaveRecord.findUnique({ where: { id } });
    if (!leave) {
      throw new NotFoundException({ code: ERROR_CODES.LEAVE_NOT_FOUND, message: '请假记录不存在' });
    }
    if (!leave.approvalInstanceId) {
      throw new BadRequestException({ code: ERROR_CODES.LEAVE_NOT_SUBMITTED, message: '未提交审批' });
    }
    if (leave.status !== 'approving') {
      throw new BadRequestException({ code: ERROR_CODES.LEAVE_STATUS_INVALID, message: '当前状态不可审批' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    await this.approvalService.reject({
      instanceId: leave.approvalInstanceId,
      userId,
      userName: user!.name,
      comment,
    });

    const updated = await this.prisma.leaveRecord.update({
      where: { id },
      data: {
        status: 'rejected',
        approverId: userId,
        approvalNote: comment,
      },
    });

    return updated;
  }

  private async deductLeaveBalance(leaveId: number) {
    const leave = await this.prisma.leaveRecord.findUnique({ where: { id: leaveId } });
    if (!leave) return;

    const year = leave.startDate.getFullYear();

    await this.prisma.$transaction(async (tx) => {
      const balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId: leave.employeeId,
            vacationTypeId: leave.vacationTypeId,
            year,
          },
        },
      });
      if (!balance) return;

      const newUsed = new Prisma.Decimal(balance.usedDays).plus(leave.days);
      await tx.vacationBalance.update({
        where: { id: balance.id },
        data: { usedDays: newUsed },
      });

      await tx.vacationBalanceChange.create({
        data: {
          employeeId: leave.employeeId,
          balanceId: balance.id,
          changeType: 'deduction',
          amount: leave.days,
          balanceBefore: new Prisma.Decimal(balance.totalDays).minus(balance.usedDays),
          balanceAfter: new Prisma.Decimal(balance.totalDays).minus(newUsed),
          reason: `请假审批通过 ${leave.startDate.toISOString().split('T')[0]} ~ ${leave.endDate.toISOString().split('T')[0]}`,
          referenceType: 'leave',
          referenceId: leave.id,
        },
      });
    });
  }

  async listLeaveRecords(params: { employeeId?: number; status?: string; userId: number }) {
    const { employeeId, status, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.LeaveRecordWhereInput = {};
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status as any;

    const [list, total] = await Promise.all([
      this.prisma.leaveRecord.findMany({
        where,
        include: {
          vacationType: { select: { id: true, code: true, name: true } },
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveRecord.count({ where }),
    ]);
    return { list, total };
  }

  async listMyLeaveRecords(userId: number) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return { list: [], total: 0 };

    const [list, total] = await Promise.all([
      this.prisma.leaveRecord.findMany({
        where: { employeeId: emp.id },
        include: {
          vacationType: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.leaveRecord.count({ where: { employeeId: emp.id } }),
    ]);
    return { list, total };
  }

  async createOvertime(data: {
    employeeId: number;
    overtimeDate: string;
    startTime: string;
    endTime: string;
    hours: number;
    reason?: string;
  }) {
    return this.prisma.overtimeRecord.create({
      data: {
        employeeId: data.employeeId,
        overtimeDate: new Date(data.overtimeDate),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        hours: new Prisma.Decimal(data.hours),
        reason: data.reason,
        status: 'pending',
      },
    });
  }

  async submitOvertime(id: number, userId: number) {
    const ot = await this.prisma.overtimeRecord.findUnique({ where: { id } });
    if (!ot) {
      throw new NotFoundException({ code: ERROR_CODES.OVERTIME_NOT_FOUND, message: '加班记录不存在' });
    }
    const emp = await this.prisma.employee.findUnique({ where: { id: ot.employeeId } });
    if (!emp || emp.userId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权限操作' });
    }
    if (ot.status !== 'pending') {
      throw new BadRequestException({ code: ERROR_CODES.OVERTIME_STATUS_INVALID, message: '当前状态不可提交审批' });
    }
    if (ot.approvalInstanceId) {
      throw new BadRequestException({ code: ERROR_CODES.OVERTIME_ALREADY_SUBMITTED, message: '已在审批中' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalService.startInstance({
      workflowCode: 'overtime',
      title: `加班申请 - ${emp.name}`,
      formData: {
        overtimeId: ot.id,
        hours: ot.hours.toString(),
        overtimeDate: ot.overtimeDate.toISOString().split('T')[0],
      },
      userId,
      userName: user!.name,
      departmentId: emp.departmentId ?? undefined,
    });

    const updated = await this.prisma.overtimeRecord.update({
      where: { id },
      data: {
        status: 'approving',
        approvalInstanceId: instance.id,
      },
    });

    return updated;
  }

  async approveOvertime(id: number, userId: number, comment?: string) {
    const ot = await this.prisma.overtimeRecord.findUnique({ where: { id } });
    if (!ot) {
      throw new NotFoundException({ code: ERROR_CODES.OVERTIME_NOT_FOUND, message: '加班记录不存在' });
    }
    if (!ot.approvalInstanceId) {
      throw new BadRequestException({ code: ERROR_CODES.OVERTIME_NOT_SUBMITTED, message: '未提交审批' });
    }
    if (ot.status !== 'approving') {
      throw new BadRequestException({ code: ERROR_CODES.OVERTIME_STATUS_INVALID, message: '当前状态不可审批' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalService.approve({
      instanceId: ot.approvalInstanceId,
      userId,
      userName: user!.name,
      comment,
    });

    if (instance.status === 'approved') {
      const updated = await this.prisma.overtimeRecord.update({
        where: { id },
        data: {
          status: 'approved',
          approverId: userId,
          approvedAt: new Date(),
          approvalNote: comment,
        },
      });
      return updated;
    }

    const updated = await this.prisma.overtimeRecord.update({
      where: { id },
      data: { approvalNote: comment },
    });
    return updated;
  }

  async rejectOvertime(id: number, userId: number, comment?: string) {
    const ot = await this.prisma.overtimeRecord.findUnique({ where: { id } });
    if (!ot) {
      throw new NotFoundException({ code: ERROR_CODES.OVERTIME_NOT_FOUND, message: '加班记录不存在' });
    }
    if (!ot.approvalInstanceId) {
      throw new BadRequestException({ code: ERROR_CODES.OVERTIME_NOT_SUBMITTED, message: '未提交审批' });
    }
    if (ot.status !== 'approving') {
      throw new BadRequestException({ code: ERROR_CODES.OVERTIME_STATUS_INVALID, message: '当前状态不可审批' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    await this.approvalService.reject({
      instanceId: ot.approvalInstanceId,
      userId,
      userName: user!.name,
      comment,
    });

    const updated = await this.prisma.overtimeRecord.update({
      where: { id },
      data: {
        status: 'rejected',
        approverId: userId,
        approvalNote: comment,
      },
    });

    return updated;
  }

  async listOvertime(params: { employeeId?: number; status?: string; userId: number }) {
    const { employeeId, status, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.OvertimeRecordWhereInput = {};
    if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status as any;

    const [list, total] = await Promise.all([
      this.prisma.overtimeRecord.findMany({
        where,
        include: {
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.overtimeRecord.count({ where }),
    ]);
    return { list, total };
  }

  async listMyOvertime(userId: number) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return { list: [], total: 0 };

    const [list, total] = await Promise.all([
      this.prisma.overtimeRecord.findMany({
        where: { employeeId: emp.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.overtimeRecord.count({ where: { employeeId: emp.id } }),
    ]);
    return { list, total };
  }

  async convertOvertimeToCompensatory(params: {
    employeeId: number;
    overtimeId: number;
    vacationTypeId: number;
    hours: number;
    userId: number;
  }) {
    const { employeeId, overtimeId, vacationTypeId, hours, userId } = params;
    const year = new Date().getFullYear();

    return this.prisma.$transaction(async (tx) => {
      const overtime = await tx.overtimeRecord.findUnique({ where: { id: overtimeId } });
      if (!overtime || overtime.employeeId !== employeeId) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.OVERTIME_NOT_FOUND, message: '加班记录不存在' });
      }
      if (overtime.status !== 'approved') {
        throw new UnprocessableEntityException({ code: ERROR_CODES.OVERTIME_NOT_APPROVED, message: '加班未审批通过' });
      }
      if (overtime.isCompensated) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.OVERTIME_ALREADY_COMPENSATED, message: '加班已兑换调休' });
      }
      if (new Prisma.Decimal(overtime.hours).lessThan(hours)) {
        throw new UnprocessableEntityException({ code: ERROR_CODES.OVERTIME_HOURS_EXCEEDED, message: '兑换小时数超出加班时长' });
      }

      const days = new Prisma.Decimal(hours).dividedBy(8);

      let balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId,
            year,
          },
        },
      });
      if (!balance) {
        balance = await tx.vacationBalance.create({
          data: {
            employeeId,
            vacationTypeId,
            year,
            totalDays: 0,
            usedDays: 0,
          },
        });
      }

      const newTotal = new Prisma.Decimal(balance.totalDays).plus(days);
      await tx.vacationBalance.update({
        where: { id: balance.id },
        data: { totalDays: newTotal },
      });

      await tx.overtimeRecord.update({
        where: { id: overtimeId },
        data: { isCompensated: true, compensatedAt: new Date() },
      });

      await tx.vacationBalanceChange.create({
        data: {
          employeeId,
          balanceId: balance.id,
          changeType: 'conversion',
          amount: days,
          balanceBefore: new Prisma.Decimal(balance.totalDays).minus(balance.usedDays),
          balanceAfter: newTotal.minus(balance.usedDays),
          reason: `加班转调休 ${hours}小时`,
          referenceType: 'overtime',
          referenceId: overtimeId,
          createdBy: userId,
        },
      });

      return { days: days.toString() };
    });
  }

  async convertOvertimeToCompensatoryMine(params: {
    overtimeId: number;
    vacationTypeId: number;
    hours: number;
    userId: number;
  }) {
    const emp = await this.prisma.employee.findUnique({ where: { userId: params.userId } });
    if (!emp) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.EMPLOYEE_INFO_NOT_FOUND, message: '员工信息不存在' });
    }
    return this.convertOvertimeToCompensatory({
      employeeId: emp.id,
      overtimeId: params.overtimeId,
      vacationTypeId: params.vacationTypeId,
      hours: params.hours,
      userId: params.userId,
    });
  }
}
