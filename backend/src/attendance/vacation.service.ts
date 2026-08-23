import { Injectable, Inject, UnprocessableEntityException, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { Prisma } from '@prisma/client';
import { ApprovalClientInterface } from '../approval/approval-client.interface';
import { NotificationService } from '../notification/notification.service';
import { ERROR_CODES } from '../common/error-codes';
import {
  isValidDate,
  isStartBeforeEnd,
  isDateNotTooFarFuture,
  isDateNotBeforeHireDate,
} from '../common/date.util';
import * as ExcelJS from 'exceljs';

@Injectable()
export class VacationService {
  private readonly logger = new Logger(VacationService.name);

  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    @Inject('APPROVAL_CLIENT') private approvalClient: ApprovalClientInterface,
    private notificationService: NotificationService,
  ) {}

  async listBalances(params: { employeeId?: number; year: number; userId: number }) {
    const { employeeId, year, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.VacationBalanceWhereInput = {
      year,
    };
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({ code: 4030, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }

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
    // IDOR fix: verify the employee is in the caller's data scope
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== data.employeeId) {
      throw new ForbiddenException({ code: 4030, message: '无权为其他员工创建记录' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: 4030, message: '无权为其他员工创建记录' });
      }
    }

    if (!isValidDate(data.startDate)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '开始日期格式无效' });
    }
    if (!isValidDate(data.endDate)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '结束日期格式无效' });
    }
    if (!isStartBeforeEnd(data.startDate, data.endDate)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '开始日期不能晚于结束日期' });
    }
    if (!isDateNotTooFarFuture(data.endDate, 1)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '结束日期不能超过当前日期1年以上' });
    }

    const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (emp && emp.hireDate) {
      if (!isDateNotBeforeHireDate(data.startDate, emp.hireDate)) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '请假开始日期不能早于入职日期' });
      }
    }

    if (data.days <= 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '请假天数必须大于0' });
    }

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

  async submitLeave(id: number, userId: number, ccEmployeeIds?: number[]) {
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

    const instance = await this.approvalClient.startInstance({
      workflowCode: 'leave',
      title: `请假申请 - ${emp.name}`,
      formData: {
        leaveId: leave.id,
        days: leave.days.toString(),
        vacationTypeId: leave.vacationTypeId,
      },
      userId,
      userName: user!.realName,
      departmentId: emp.departmentId ?? undefined,
      ccEmployeeIds,
    });

    const updated = await this.prisma.leaveRecord.update({
      where: { id },
      data: {
        status: 'approving',
        approvalInstanceId: instance.id,
      },
    });

    // Notify the employee's department manager(s) about the leave request.
    // Wrapped in try/catch so a notification failure never breaks the submit.
    try {
      const managerUserIds = await this.getManagerUserIds(emp.departmentId);
      if (managerUserIds.length > 0) {
        await this.notificationService.createMany(managerUserIds, {
          title: `请假申请：${emp.name}`,
          content: '有员工提交了请假申请，请及时审批',
          type: 'leave',
          relatedId: leave.id,
          relatedType: 'leave_record',
        });
      }
    } catch (err) {
      this.logger.error(
        `Failed to create leave-applied notifications for leave ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

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

    const instance = await this.approvalClient.approve({
      instanceId: leave.approvalInstanceId,
      userId,
      userName: user!.realName,
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

    await this.approvalClient.reject({
      instanceId: leave.approvalInstanceId,
      userId,
      userName: user!.realName,
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
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({ code: 4030, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }
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

  async exportLeaveRecords(userId: number, params: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    departmentId?: number;
  }): Promise<Buffer> {
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.LeaveRecordWhereInput = {};

    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      const deptIds = params.departmentId
        ? scope.ids.filter((id) => id === params.departmentId)
        : scope.ids;
      where.employee = { departmentId: { in: deptIds } };
    } else if (params.departmentId) {
      where.employee = { departmentId: params.departmentId };
    }

    if (params.status) where.status = params.status as any;
    if (params.type) {
      where.vacationType = { code: params.type };
    }
    if (params.startDate || params.endDate) {
      where.startDate = {};
      if (params.startDate) where.startDate.gte = new Date(params.startDate);
      if (params.endDate) where.startDate.lte = new Date(params.endDate);
    }

    const leaveRecords = await this.prisma.leaveRecord.findMany({
      where,
      include: {
        vacationType: { select: { id: true, code: true, name: true } },
        employee: { include: { department: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('请假记录');
    sheet.columns = [
      { header: '单号', key: 'id', width: 10 },
      { header: '申请人', key: 'employeeName', width: 12 },
      { header: '部门', key: 'department', width: 20 },
      { header: '假期类型', key: 'vacationType', width: 15 },
      { header: '开始日期', key: 'startDate', width: 15 },
      { header: '结束日期', key: 'endDate', width: 15 },
      { header: '天数', key: 'days', width: 10 },
      { header: '状态', key: 'status', width: 10 },
      { header: '申请日期', key: 'createdAt', width: 15 },
    ];

    const statusMap: Record<string, string> = {
      draft: '草稿',
      pending: '待提交',
      approving: '审批中',
      approved: '已通过',
      rejected: '已驳回',
      cancelled: '已取消',
    };

    leaveRecords.forEach((r) => {
      sheet.addRow({
        id: r.id,
        employeeName: r.employee?.name || '',
        department: r.employee?.department?.name || '',
        vacationType: r.vacationType?.name || '',
        startDate: r.startDate ? r.startDate.toISOString().split('T')[0] : '',
        endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : '',
        days: r.days.toString(),
        status: statusMap[r.status] || r.status,
        createdAt: r.createdAt ? r.createdAt.toISOString().split('T')[0] : '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }

  async listMyLeaveRecords(
    userId: number,
    page: number,
    pageSize: number,
    vacationType?: string,
    status?: string,
  ) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return { list: [], total: 0, page, pageSize };

    const where: Prisma.LeaveRecordWhereInput = { employeeId: emp.id };
    if (vacationType) {
      where.vacationType = { code: vacationType };
    }
    if (status) {
      where.status = status as any;
    }

    const [list, total] = await Promise.all([
      this.prisma.leaveRecord.findMany({
        where,
        include: {
          vacationType: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.leaveRecord.count({ where }),
    ]);
    return { list, total, page, pageSize };
  }

  async createOvertime(data: {
    employeeId: number;
    overtimeDate: string;
    startTime: string;
    endTime: string;
    hours: number;
    reason?: string;
  }, userId: number) {
    // IDOR fix: verify the employee is in the caller's data scope
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== data.employeeId) {
      throw new ForbiddenException({ code: 4030, message: '无权为其他员工创建记录' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: 4030, message: '无权为其他员工创建记录' });
      }
    }

    if (!isValidDate(data.overtimeDate)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '加班日期格式无效' });
    }
    if (!isValidDate(data.startTime)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '开始时间格式无效' });
    }
    if (!isValidDate(data.endTime)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '结束时间格式无效' });
    }

    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (start.getTime() >= end.getTime()) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '加班开始时间必须早于结束时间' });
    }
    if (!isDateNotTooFarFuture(data.overtimeDate, 1)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '加班日期不能超过当前日期1年以上' });
    }

    const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (emp && emp.hireDate) {
      if (!isDateNotBeforeHireDate(data.overtimeDate, emp.hireDate)) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '加班日期不能早于入职日期' });
      }
    }

    if (data.hours <= 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '加班小时数必须大于0' });
    }

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

  async submitOvertime(id: number, userId: number, ccEmployeeIds?: number[]) {
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

    const instance = await this.approvalClient.startInstance({
      workflowCode: 'overtime',
      title: `加班申请 - ${emp.name}`,
      formData: {
        overtimeId: ot.id,
        hours: ot.hours.toString(),
        overtimeDate: ot.overtimeDate.toISOString().split('T')[0],
      },
      userId,
      userName: user!.realName,
      departmentId: emp.departmentId ?? undefined,
      ccEmployeeIds,
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

    const instance = await this.approvalClient.approve({
      instanceId: ot.approvalInstanceId,
      userId,
      userName: user!.realName,
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

    await this.approvalClient.reject({
      instanceId: ot.approvalInstanceId,
      userId,
      userName: user!.realName,
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
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({ code: 4030, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }
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

    // Scope 校验：验证 employeeId 在调用者数据范围内
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
      throw new ForbiddenException({ code: 4030, message: '无权为其他员工操作调休转换' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: 4030, message: '无权为其他员工操作调休转换' });
      }
    }

    if (hours <= 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '兑换小时数必须大于0' });
    }

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

  /**
   * Resolves the user IDs of department managers for a given department.
   *
   * Strategy:
   *  1. Find all users holding the `dept_manager` role.
   *  2. If a `departmentId` is provided, narrow to those who are also
   *     employees in that department.
   *  3. If no department-scoped managers are found, fall back to ALL users
   *     with the `dept_manager` role so the notification is not silently
   *     dropped.
   */
  private async getManagerUserIds(departmentId?: number | null): Promise<number[]> {
    const managerRoles = await this.prisma.userRole.findMany({
      where: { role: { code: 'dept_manager' } },
      select: { userId: true },
    });
    const allManagerUserIds = managerRoles.map((m) => m.userId);
    if (allManagerUserIds.length === 0) return [];

    if (!departmentId) return allManagerUserIds;

    const deptManagers = await this.prisma.employee.findMany({
      where: { userId: { in: allManagerUserIds }, departmentId },
      select: { userId: true },
    });
    const deptManagerUserIds = deptManagers
      .map((e) => e.userId)
      .filter((uid): uid is number => uid !== null);

    return deptManagerUserIds.length > 0 ? deptManagerUserIds : allManagerUserIds;
  }

  async calculateAnnualLeaveDays(
    employee: { hireDate: Date | string },
    vacationType?: { seniorityRule?: any; baseDays: string | number | Prisma.Decimal },
  ): Promise<Prisma.Decimal> {
    if (!vacationType) {
      const annualType = await this.prisma.vacationType.findUnique({
        where: { code: 'annual' },
      });
      if (!annualType) {
        return new Prisma.Decimal(0);
      }
      vacationType = annualType;
    }

    const seniorityRule = vacationType.seniorityRule as any;
    if (!seniorityRule || !Array.isArray(seniorityRule) || seniorityRule.length === 0) {
      return new Prisma.Decimal(vacationType.baseDays);
    }

    const hireDate = new Date(employee.hireDate);
    const now = new Date();
    const yearsOfService =
      (now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    for (const rule of seniorityRule) {
      const minYears = rule.minYears ?? 0;
      const maxYears = rule.maxYears ?? Infinity;
      if (yearsOfService >= minYears && yearsOfService < maxYears) {
        return new Prisma.Decimal(rule.days);
      }
    }

    const lastRule = seniorityRule[seniorityRule.length - 1];
    return new Prisma.Decimal(lastRule.days ?? vacationType.baseDays);
  }

  async initializeYearBalances(year: number, employeeId?: number): Promise<void> {
    const vacationTypes = await this.prisma.vacationType.findMany({
      where: { enabled: true },
    });
    if (vacationTypes.length === 0) return;

    const where: Prisma.EmployeeWhereInput = { status: 'active' };
    if (employeeId) {
      where.id = employeeId;
    }
    const employees = await this.prisma.employee.findMany({ where });
    if (employees.length === 0) return;

    for (const emp of employees) {
      for (const vt of vacationTypes) {
        const existing = await this.prisma.vacationBalance.findUnique({
          where: {
            employeeId_vacationTypeId_year: {
              employeeId: emp.id,
              vacationTypeId: vt.id,
              year,
            },
          },
        });

        if (existing) continue;

        const totalDays = await this.calculateAnnualLeaveDays(emp, vt);

        await this.prisma.vacationBalance.create({
          data: {
            employeeId: emp.id,
            vacationTypeId: vt.id,
            year,
            totalDays,
            usedDays: 0,
          },
        });
      }
    }
  }

  async carryOverBalances(fromYear: number, toYear: number): Promise<void> {
    await this.initializeYearBalances(toYear);

    const vacationTypes = await this.prisma.vacationType.findMany({
      where: {
        enabled: true,
        OR: [{ carryOverMaxDays: { not: null } }, { carryOverRatio: { not: null } }],
      },
    });
    if (vacationTypes.length === 0) return;

    const employees = await this.prisma.employee.findMany({
      where: { status: 'active' },
    });
    if (employees.length === 0) return;

    for (const emp of employees) {
      for (const vt of vacationTypes) {
        const fromBalance = await this.prisma.vacationBalance.findUnique({
          where: {
            employeeId_vacationTypeId_year: {
              employeeId: emp.id,
              vacationTypeId: vt.id,
              year: fromYear,
            },
          },
        });

        if (!fromBalance) continue;

        const remaining = new Prisma.Decimal(fromBalance.totalDays).minus(fromBalance.usedDays);
        if (remaining.lessThanOrEqualTo(0)) continue;

        let carryOverDays = remaining;

        if (vt.carryOverRatio !== null && vt.carryOverRatio !== undefined) {
          const ratioDays = remaining.times(vt.carryOverRatio);
          if (ratioDays.lessThan(carryOverDays)) {
            carryOverDays = ratioDays;
          }
        }

        if (vt.carryOverMaxDays !== null && vt.carryOverMaxDays !== undefined) {
          const maxDays = new Prisma.Decimal(vt.carryOverMaxDays);
          if (maxDays.lessThan(carryOverDays)) {
            carryOverDays = maxDays;
          }
        }

        if (carryOverDays.lessThanOrEqualTo(0)) continue;

        const toBalance = await this.prisma.vacationBalance.findUnique({
          where: {
            employeeId_vacationTypeId_year: {
              employeeId: emp.id,
              vacationTypeId: vt.id,
              year: toYear,
            },
          },
        });

        if (!toBalance) continue;

        await this.prisma.$transaction(async (tx) => {
          const newTotal = new Prisma.Decimal(toBalance.totalDays).plus(carryOverDays);
          await tx.vacationBalance.update({
            where: { id: toBalance.id },
            data: { totalDays: newTotal },
          });

          await tx.vacationBalanceChange.create({
            data: {
              employeeId: emp.id,
              balanceId: toBalance.id,
              changeType: 'addition',
              amount: carryOverDays,
              balanceBefore: new Prisma.Decimal(toBalance.totalDays).minus(toBalance.usedDays),
              balanceAfter: newTotal.minus(toBalance.usedDays),
              reason: `${fromYear}年假期余额结转`,
            },
          });
        });
      }
    }
  }

  async adjustBalance(params: {
    employeeId: number;
    vacationTypeId: number;
    year: number;
    changeDays: number;
    reason: string;
    userId: number;
  }) {
    const { employeeId, vacationTypeId, year, changeDays, reason, userId } = params;

    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
      throw new ForbiddenException({ code: 4030, message: '无权调整其他员工的假期余额' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: 4030, message: '无权调整其他员工的假期余额' });
      }
    }

    const changeDecimal = new Prisma.Decimal(changeDays);

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year: {
            employeeId,
            vacationTypeId,
            year,
          },
        },
      });
      if (!balance) {
        throw new UnprocessableEntityException({
          code: ERROR_CODES.VACATION_BALANCE_NOT_FOUND,
          message: '休假额度不存在',
        });
      }

      const balanceBefore = new Prisma.Decimal(balance.totalDays).minus(balance.usedDays);
      const newTotal = new Prisma.Decimal(balance.totalDays).plus(changeDecimal);
      const balanceAfter = newTotal.minus(balance.usedDays);

      const updatedBalance = await tx.vacationBalance.update({
        where: { id: balance.id },
        data: { totalDays: newTotal },
      });

      const change = await tx.vacationBalanceChange.create({
        data: {
          employeeId,
          balanceId: balance.id,
          changeType: 'adjustment',
          amount: changeDecimal,
          balanceBefore,
          balanceAfter,
          reason,
          createdBy: userId,
        },
      });

      return { balance: updatedBalance, change };
    });
  }

  async listBalanceChanges(params: {
    employeeId?: number;
    vacationTypeId?: number;
    year?: number;
    changeType?: string;
    userId: number;
    page: number;
    pageSize: number;
  }) {
    const { employeeId, vacationTypeId, year, changeType, userId, page, pageSize } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.VacationBalanceChangeWhereInput = {};

    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }

    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({ code: 4030, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }

    if (vacationTypeId || year) {
      where.balance = {};
      if (vacationTypeId) {
        where.balance.vacationTypeId = vacationTypeId;
      }
      if (year) {
        where.balance.year = year;
      }
    }

    if (changeType) {
      where.changeType = changeType as any;
    }

    const [list, total] = await Promise.all([
      this.prisma.vacationBalanceChange.findMany({
        where,
        include: {
          balance: { include: { vacationType: { select: { id: true, code: true, name: true } } } },
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.vacationBalanceChange.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }
}
