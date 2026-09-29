import { Injectable, Inject, UnprocessableEntityException, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService, scopeIsEmpty } from '../common/data-scope.service';
import { Prisma, $Enums } from '@prisma/client';
import { ApprovalClientInterface } from '../approval/approval-client.interface';
import { NotificationClientInterface } from '../notification/notification-client.interface';
import { ERROR_CODES } from '../common/error-codes';
import {
  isValidDate,
  isStartBeforeEnd,
  isDateNotTooFarFuture,
  isDateNotBeforeHireDate,
  beijingNow,
  parseBeijingDateTime,
  beijingDateTimeStr,
} from '../common/date.util';
import { getMonthlyDays, isMonthlyDays } from './vacation-monthly';
import { getOvertimeToLeaveHours } from './overtime-conversion';
import { DistributedLockService } from '../common/distributed-lock.service';
import { ACTIVE_EMPLOYEE_STATUSES } from '../common/employee-status';
import * as ExcelJS from 'exceljs';

/** 额度初始化/跨年结转的锁 TTL（>10s 时 withLock 会自动续期） */
const BALANCE_LOCK_TTL_MS = 5 * 60 * 1000;
/** 跨年结转流水的 referenceType，用于重复执行的幂等判定 */
const CARRY_OVER_REFERENCE_TYPE = 'vacation_carry_over';

/**
 * 年假按工龄规则的单项（`VacationType.seniorityRule` JSON 列的数组元素）。
 * 之前以 `any` 读取，`rule.minYears` / `rule.days` 拼写错误无法在编译期发现。
 */
export interface SeniorityRuleItem {
  minYears?: number;
  maxYears?: number;
  days: number;
}

@Injectable()
export class VacationService {
  private readonly logger = new Logger(VacationService.name);

  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    @Inject('APPROVAL_CLIENT') private approvalClient: ApprovalClientInterface,
    @Inject('NOTIFICATION_CLIENT') private notificationService: NotificationClientInterface,
    private readonly lockService: DistributedLockService,
  ) {}

  async listBalances(params: { employeeId?: number; year: number; month?: number; userId: number }) {
    const { employeeId, year, month, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.VacationBalanceWhereInput = {
      year,
    };
    if (month) {
      where.month = month;
    }
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.vacationBalance.findMany({
        where,
        include: {
          vacationType: { select: { id: true, code: true, name: true, monthlyDays: true } },
          employee: { select: { id: true, employeeNo: true, name: true } },
        },
        orderBy: { vacationType: { sortOrder: 'asc' } },
      }),
      this.prisma.vacationBalance.count({ where }),
    ]);
    return { list: data, total };
  }

  async getMyBalances(userId: number, year?: number, month?: number) {
    const y = year || beijingNow().year;
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) return [];

    const balances = await this.prisma.vacationBalance.findMany({
      where: { employeeId: emp.id, year: y, ...(month ? { month } : {}) },
      include: {
        // monthlyDays 必须一并返回：前端据此判断假期类型是否为月假，
        // 决定申请请假时是否展示「抵扣月份」下拉（缺失会导致月假请假提交被 400）
        vacationType: { select: { id: true, code: true, name: true, monthlyDays: true } },
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
      month?: number;
      reason: string;
    },
    userId: number,
  ) {
    // IDOR fix: verify the employee is in the caller's data scope
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== data.employeeId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' });
      }
    }
    // 既无 admin/hr 全量权限、又无部门范围、又未关联员工 → 该用户无任何数据可见范围，
    // 不应静默放行为任意员工创建记录（否则构成横向越权）。
    if (scopeIsEmpty(scope)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' });
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

    // 确定抵扣月份：月假类型必选/推导具体月份；非月假（整户/年度）归入 month=0
    const leaveType = await this.prisma.vacationType.findUnique({
      where: { id: data.vacationTypeId },
    });
    if (!leaveType) {
      throw new UnprocessableEntityException({ code: ERROR_CODES.VACATION_TYPE_NOT_FOUND, message: '假期类型不存在' });
    }
    const isMonthly = isMonthlyDays(leaveType.monthlyDays);
    let month = isMonthly ? (data.month ?? 0) : 0;
    if (isMonthly) {
      if (month < 1 || month > 12) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '请选择抵扣的假期月份' });
      }
    }

    // 业务日一律以 UTC 存储（new Date('YYYY-MM-DD')），取年份必须用 getUTC*：
    // 负时区宿主机上本地 getFullYear() 会把 UTC 午夜的跨年日期退回上一年。
    const year = new Date(data.startDate).getUTCFullYear();
    const balance = await this.prisma.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year_month: {
          employeeId: data.employeeId,
          vacationTypeId: data.vacationTypeId,
          year,
          month,
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
        month,
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

    // 审批通过前复核余额：创建时的校验到这里可能已失效（期间被其他请假占用、
    // 或管理员调整过额度）。必须在通知审批引擎「通过」之前拦截，否则会出现
    // 「审批实例已通过、本地却扣不动额度」的死局。
    await this.assertLeaveQuotaAvailable(leave);

    const instance = await this.approvalClient.approve({
      instanceId: leave.approvalInstanceId,
      userId,
      userName: user!.realName,
      comment,
    });

    if (instance.status === 'approved') {
      // 扣减与状态迁移合并在 deductLeaveBalance 内完成（含幂等令牌），
      // 避免与 approval.approved 事件监听形成双路径重复扣减
      const applied = await this.deductLeaveBalance(leave.id, { approverId: userId, comment });
      if (applied) return applied;
      return this.prisma.leaveRecord.findUniqueOrThrow({ where: { id } });
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

    const claimed = await this.prisma.leaveRecord.updateMany({
      where: { id, status: 'approving' },
      data: {
        status: 'rejected',
        approverId: userId,
        approvalNote: comment,
      },
    });
    // 条件更新：绝不用无条件 update 覆盖已终结状态。若并发下记录已被另一路径
    // （审批回调 / approval.* 监听）迁到 approved，则此处不覆盖，状态迁移与额度
    // 退回由监听器按「事务内最新状态」完成。
    if (claimed.count === 0) {
      this.logger.warn(`请假驳回并发冲突，跳过状态覆盖：leaveId=${id}`);
    }

    return (await this.prisma.leaveRecord.findUnique({ where: { id } }))!;
  }

  /**
   * 复核请假额度是否仍然充足（剩余 = totalDays - usedDays）。
   * 与创建请假时的校验同一口径，供审批通过前再次把关。
   */
  private async assertLeaveQuotaAvailable(leave: {
    employeeId: number;
    vacationTypeId: number;
    month?: number | null;
    days: Prisma.Decimal;
    startDate: Date;
  }) {
    const year = leave.startDate.getUTCFullYear();
    const month = leave.month ?? 0;
    const balance = await this.prisma.vacationBalance.findUnique({
      where: {
        employeeId_vacationTypeId_year_month: {
          employeeId: leave.employeeId,
          vacationTypeId: leave.vacationTypeId,
          year,
          month,
        },
      },
    });
    if (!balance) {
      throw new UnprocessableEntityException({
        code: ERROR_CODES.VACATION_BALANCE_NOT_FOUND,
        message: '休假额度不存在',
      });
    }
    const remaining = new Prisma.Decimal(balance.totalDays).minus(balance.usedDays);
    if (remaining.lessThan(leave.days)) {
      throw new UnprocessableEntityException({
        code: ERROR_CODES.VACATION_BALANCE_INSUFFICIENT,
        message: '休假额度不足',
      });
    }
  }

  /**
   * 请假终审通过：迁移状态「approving → approved」并扣减额度。
   *
   * 幂等：以条件更新（status 必须仍为 approving）作为一次性令牌。
   * approveLeave（审批回调）与 AttendanceApprovalListener（approval.approved 事件）
   * 是两条独立路径，同一次终审可能都被触发；只有抢到状态迁移的一方才执行扣减，
   * 另一方 updateMany 影响行数为 0 直接返回 null，避免一次终审扣两次额度。
   */
  private async deductLeaveBalance(
    leaveId: number,
    meta?: { approverId?: number; comment?: string },
  ) {
    const leave = await this.prisma.leaveRecord.findUnique({ where: { id: leaveId } });
    if (!leave) return null;

    const year = leave.startDate.getUTCFullYear();
    const month = leave.month ?? 0;

    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRecord.updateMany({
        where: { id: leaveId, status: 'approving' },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          ...(meta?.approverId !== undefined ? { approverId: meta.approverId } : {}),
          ...(meta?.comment !== undefined ? { approvalNote: meta.comment } : {}),
        },
      });
      if (claimed.count === 0) return null;

      const balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year_month: {
            employeeId: leave.employeeId,
            vacationTypeId: leave.vacationTypeId,
            year,
            month,
          },
        },
      });
      // 额度缺失（未初始化）时不阻断审批通过，仅无法扣减
      if (balance) {
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
            referenceType: 'leave_record',
            referenceId: leave.id,
          },
        });
      }

      return tx.leaveRecord.findUnique({ where: { id: leaveId } });
    });
  }

  async listLeaveRecords(params: {
    employeeId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    userId: number;
  }) {
    const { employeeId, status, startDate, endDate, userId } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: Prisma.LeaveRecordWhereInput = {};
    if (scope.selfEmployeeId) {
      where.employeeId = scope.selfEmployeeId;
    } else if (!scope.all) {
      where.employee = { departmentId: { in: scope.ids } };
    }
    if (employeeId) {
      if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }
    if (status) where.status = status as $Enums.LeaveStatus;
    // 区间重叠过滤：请假区间 [startDate, endDate] 与查询区间相交
    // startDate/endDate 为 @db.Date，需补全为完整 ISO-8601 时间戳，否则 Prisma 无法解析纯日期字符串
    if (startDate) where.endDate = { gte: new Date(`${startDate} 00:00:00`) };
    if (endDate) where.startDate = { lte: new Date(`${endDate} 23:59:59`) };

    const [list, total] = await Promise.all([
      this.prisma.leaveRecord.findMany({
        where,
        include: {
          vacationType: { select: { id: true, code: true, name: true, monthlyDays: true } },
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

    if (params.status) where.status = params.status as $Enums.LeaveStatus;
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
        // createdAt 是真实时刻：按 UTC 取日期会让北京时间凌晨的记录落到前一天，
        // 须按北京时间取日历日（startDate/endDate 是 @db.Date，UTC 午夜写入，不受影响）
        createdAt: r.createdAt ? beijingDateTimeStr(r.createdAt).slice(0, 10) : '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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
      where.status = status as $Enums.LeaveStatus;
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
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' });
      }
    }
    // 既无 admin/hr 全量权限、又无部门范围、又未关联员工 → 该用户无任何数据可见范围，
    // 不应静默放行为任意员工创建记录（否则构成横向越权）。
    if (scopeIsEmpty(scope)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工创建记录' });
    }

    if (!isValidDate(data.overtimeDate)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '加班日期格式无效' });
    }
    // 前端 RangePicker 回传的是无时区墙钟串（YYYY-MM-DD HH:mm），必须按北京时间解析：
    // 直接用 new Date(str) 会按服务器本地时区解析，UTC 容器下起止时刻整体偏 8 小时、甚至跨日。
    const start = parseBeijingDateTime(data.startTime);
    if (!start) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '开始时间格式无效' });
    }
    const end = parseBeijingDateTime(data.endTime);
    if (!end) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '结束时间格式无效' });
    }

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

    // 时长由起止时间推算（支持跨天），以服务端计算为准，忽略客户端提交的 hours
    const computedHours = Math.round(((end.getTime() - start.getTime()) / 3600000) * 10) / 10;
    if (computedHours <= 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '加班小时数必须大于0' });
    }

    return this.prisma.overtimeRecord.create({
      data: {
        employeeId: data.employeeId,
        overtimeDate: new Date(data.overtimeDate),
        startTime: start,
        endTime: end,
        hours: new Prisma.Decimal(computedHours),
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

    const claimed = await this.prisma.overtimeRecord.updateMany({
      where: { id, status: 'approving' },
      data: {
        status: 'rejected',
        approverId: userId,
        approvalNote: comment,
      },
    });
    // 同 rejectLeave：条件更新，避免覆盖已通过状态并漏掉调休扣回。
    if (claimed.count === 0) {
      this.logger.warn(`加班驳回并发冲突，跳过状态覆盖：overtimeId=${id}`);
    }

    return (await this.prisma.overtimeRecord.findUnique({ where: { id } }))!;
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
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
      }
      if (!scope.selfEmployeeId) {
        where.employeeId = employeeId;
      }
    }
    if (status) where.status = status as $Enums.OvertimeStatus;

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
    overtimeId: number;
    vacationTypeId: number;
    hours: number;
    employeeId: number;
    userId: number;
  }) {
    const { employeeId, overtimeId, vacationTypeId, hours, userId } = params;

    // Scope 校验：验证 employeeId 在调用者数据范围内
    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工操作调休转换' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工操作调休转换' });
      }
    }
    // 既无 admin/hr 全量权限、又无部门范围、又未关联员工 → 该用户无任何数据可见范围，
    // 不应静默放行为任意员工兑换调休（否则构成横向越权）。
    if (scopeIsEmpty(scope)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权为其他员工操作调休转换' });
    }

    if (hours <= 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '兑换小时数必须大于0' });
    }

    const hoursPerDay = await getOvertimeToLeaveHours(this.prisma);

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

      // 一次性令牌：并发/重复兑换只能有一方把 isCompensated 从 false 抢成 true，
      // 否则同一笔加班会被折算两次调休（本接口与「加班审批通过自动转调休」监听
      // 是两条独立路径，共用同一条记录）。
      const claimed = await tx.overtimeRecord.updateMany({
        where: { id: overtimeId, isCompensated: false },
        data: { isCompensated: true, compensatedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new UnprocessableEntityException({
          code: ERROR_CODES.OVERTIME_ALREADY_COMPENSATED,
          message: '加班已兑换调休',
        });
      }

      const days = new Prisma.Decimal(hours).dividedBy(hoursPerDay);

      // 入账年月一律取加班业务日期，与「加班审批通过自动转调休」监听口径保持一致，
      // 否则同一笔加班经两条路径会落到不同年度/月份的额度行。
      // 月假类型按加班所在月份入账；年假类型 month=0 归入年度整户。
      const year = overtime.overtimeDate.getUTCFullYear();
      const isMonthly = await this.isMonthlyLeaveType(vacationTypeId, tx);
      const month = isMonthly ? overtime.overtimeDate.getUTCMonth() + 1 : 0;

      let balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year_month: {
            employeeId,
            vacationTypeId,
            year,
            month,
          },
        },
      });
      if (!balance) {
        balance = await tx.vacationBalance.create({
          data: {
            employeeId,
            vacationTypeId,
            year,
            month,
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

      await tx.vacationBalanceChange.create({
        data: {
          employeeId,
          balanceId: balance.id,
          changeType: 'conversion',
          amount: days,
          balanceBefore: new Prisma.Decimal(balance.totalDays).minus(balance.usedDays),
          balanceAfter: newTotal.minus(balance.usedDays),
          reason: `加班转调休 ${hours}小时`,
          referenceType: 'overtime_record',
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

  /** 判断某假期类型是否为月假（口径见 vacation-monthly.ts） */
  private async isMonthlyLeaveType(
    vacationTypeId: number,
    client: Prisma.TransactionClient,
  ): Promise<boolean> {
    const vt = await client.vacationType.findUnique({ where: { id: vacationTypeId } });
    return isMonthlyDays(vt?.monthlyDays);
  }

  async calculateAnnualLeaveDays(
    employee: { hireDate: Date | string },
    vacationType?: { seniorityRule?: Prisma.JsonValue; baseDays: string | number | Prisma.Decimal },
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

    const seniorityRule = vacationType.seniorityRule as SeniorityRuleItem[] | null;
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
    // 定时任务与手工触发（POST /vacation/balances/initialize）可能同时执行，
    // 用分布式锁串行化，避免并发写入同一额度行。
    await this.lockService.withLock('vacation:initialize-balances', BALANCE_LOCK_TTL_MS, async () => {
      const vacationTypes = await this.prisma.vacationType.findMany({
        where: { enabled: true },
      });
      if (vacationTypes.length === 0) return;

      const where: Prisma.EmployeeWhereInput = { status: { in: [...ACTIVE_EMPLOYEE_STATUSES] } };
      if (employeeId) {
        where.id = employeeId;
      }
      const employees = await this.prisma.employee.findMany({ where });
      if (employees.length === 0) return;

      for (const emp of employees) {
        for (const vt of vacationTypes) {
          const monthly = getMonthlyDays(vt.monthlyDays);

          // 月假：按 1~12 月各生成一条额度；年假：单条 month=0 整户额度
          const monthsToInit = monthly ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [0];

          for (const month of monthsToInit) {
            const totalDays = monthly
              ? new Prisma.Decimal(monthly[month - 1] ?? 0)
              : await this.calculateAnnualLeaveDays(emp, vt);

            // upsert 而非 findUnique + create：唯一键（员工+类型+年+月）天然幂等，
            // 并发下也不会撞唯一键报错；已存在的额度一律不改动（update: {}），
            // 避免覆盖管理员手工调整过的 totalDays。
            await this.prisma.vacationBalance.upsert({
              where: {
                employeeId_vacationTypeId_year_month: {
                  employeeId: emp.id,
                  vacationTypeId: vt.id,
                  year,
                  month,
                },
              },
              update: {},
              create: {
                employeeId: emp.id,
                vacationTypeId: vt.id,
                year,
                month,
                totalDays,
                usedDays: 0,
              },
            });
          }
        }
      }
    });
  }

  async carryOverBalances(fromYear: number, toYear: number): Promise<void> {
    await this.lockService.withLock('vacation:carry-over', BALANCE_LOCK_TTL_MS, async () => {
      await this.initializeYearBalances(toYear);

      const vacationTypes = await this.prisma.vacationType.findMany({
        where: {
          enabled: true,
          OR: [{ carryOverMaxDays: { not: null } }, { carryOverRatio: { not: null } }],
        },
      });
      if (vacationTypes.length === 0) return;

      const employees = await this.prisma.employee.findMany({
        where: { status: { in: [...ACTIVE_EMPLOYEE_STATUSES] } },
      });
      if (employees.length === 0) return;

      for (const emp of employees) {
        for (const vt of vacationTypes) {
          // 月假月度作废、不自动结转，仅年假支持跨年结转
          const isMonthlyType = isMonthlyDays(vt.monthlyDays);
          if (isMonthlyType) continue;

          const fromBalance = await this.prisma.vacationBalance.findUnique({
            where: {
              employeeId_vacationTypeId_year_month: {
                employeeId: emp.id,
                vacationTypeId: vt.id,
                year: fromYear,
                month: 0,
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
              employeeId_vacationTypeId_year_month: {
                employeeId: emp.id,
                vacationTypeId: vt.id,
                year: toYear,
                month: 0,
              },
            },
          });

          if (!toBalance) continue;

          // 幂等：同一条「上一年额度」只允许结转一次。结转量由 fromYear 余额唯一确定，
          // 重复执行会把上一年余额反复累加到当年，因此以结转流水为幂等标记跳过。
          const alreadyCarried = await this.prisma.vacationBalanceChange.count({
            where: { referenceType: CARRY_OVER_REFERENCE_TYPE, referenceId: fromBalance.id },
          });
          if (alreadyCarried > 0) continue;

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
                referenceType: CARRY_OVER_REFERENCE_TYPE,
                referenceId: fromBalance.id,
              },
            });
          });
        }
      }
    });
  }

  async adjustBalance(params: {
    employeeId: number;
    vacationTypeId: number;
    year: number;
    month?: number;
    changeDays: number;
    reason: string;
    userId: number;
  }) {
    const { employeeId, vacationTypeId, year, month = 0, changeDays, reason, userId } = params;

    const scope = await this.dataScope.visibleScope(userId);
    if (scope.selfEmployeeId && scope.selfEmployeeId !== employeeId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权调整其他员工的假期余额' });
    }
    if (!scope.all && scope.ids.length > 0) {
      const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
      if (!emp || !scope.ids.includes(emp.departmentId)) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权调整其他员工的假期余额' });
      }
    }
    // 既无 admin/hr 全量权限、又无部门范围、又未关联员工 → 该用户无任何数据可见范围，
    // 不应静默放行为任意员工调整额度（否则可自增他人假期余额，构成横向越权）。
    if (scopeIsEmpty(scope)) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权调整其他员工的假期余额' });
    }

    const changeDecimal = new Prisma.Decimal(changeDays);

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.vacationBalance.findUnique({
        where: {
          employeeId_vacationTypeId_year_month: {
            employeeId,
            vacationTypeId,
            year,
            month,
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
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
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
      where.changeType = changeType as $Enums.BalanceChangeType;
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

  /**
   * 考勤统计：按 员工 × 月份 汇总应休/已休/剩余假期天数与加班时长。
   * 应休 totalDays、已休 usedDays 取自 VacationBalance，口径为「本月月假额度（month=查询月）
   * + 年度型额度（month=0）」——年度型（如年假）只有一条 month=0 记录，不并入会让该列恒为 0。
   * 加班时长取自 OvertimeRecord(status=approved) 在当月加班日期内的 hours 求和。
   */
  async getAttendanceStatistics(params: {
    userId: number;
    year: number;
    month: number;
    departmentId?: number;
    employeeId?: number;
    keyword?: string;
  }) {
    const { userId, year, month } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const empWhere: Prisma.EmployeeWhereInput = {
      status: { in: [...ACTIVE_EMPLOYEE_STATUSES] },
    };
    if (scope.selfEmployeeId) {
      empWhere.id = scope.selfEmployeeId;
    } else if (!scope.all) {
      const ids = params.departmentId ? scope.ids.filter((id) => id === params.departmentId) : scope.ids;
      empWhere.departmentId = { in: ids };
    } else if (params.departmentId) {
      empWhere.departmentId = params.departmentId;
    }
    if (params.employeeId) {
      empWhere.id = params.employeeId;
    }
    if (params.keyword) {
      empWhere.OR = [
        { name: { contains: params.keyword } },
        { employeeNo: { contains: params.keyword } },
      ];
    }

    // 额外约束：若指定 employeeId 且不在可见范围，需拦截（沿用 IDOR 防护）
    if (params.employeeId && scope.selfEmployeeId && scope.selfEmployeeId !== params.employeeId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
    }

    const emps = await this.prisma.employee.findMany({
      where: empWhere,
      select: {
        id: true,
        employeeNo: true,
        name: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });

    const empIds = emps.map((e) => e.id);
    if (empIds.length === 0) {
      return { rows: [], total: 0 };
    }

    const [balanceAgg, overtimeAgg] = await Promise.all([
      this.prisma.vacationBalance.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: empIds }, year, month: { in: [0, month] } },
        _sum: { totalDays: true, usedDays: true },
      }),
      this.prisma.overtimeRecord.groupBy({
        by: ['employeeId'],
        where: {
          employeeId: { in: empIds },
          status: 'approved',
          overtimeDate: {
            gte: new Date(`${year}-${String(month).padStart(2, '0')}-01 00:00:00`),
            lt: new Date(
              `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01 00:00:00`,
            ),
          },
        },
        _sum: { hours: true },
      }),
    ]);

    // 天数一律以 Prisma.Decimal 参与运算，禁止转 float 后做加减（项目硬约束），
    // 仅在最终出参时做一次 toNumber 转换。
    const balanceMap = new Map<number, { total: Prisma.Decimal; used: Prisma.Decimal }>();
    for (const row of balanceAgg) {
      balanceMap.set(row.employeeId, {
        total: new Prisma.Decimal(row._sum.totalDays ?? 0),
        used: new Prisma.Decimal(row._sum.usedDays ?? 0),
      });
    }
    const overtimeMap = new Map<number, number>();
    for (const row of overtimeAgg) {
      overtimeMap.set(row.employeeId, row._sum.hours?.toNumber() ?? 0);
    }

    const rows = emps.map((e) => {
      const b = balanceMap.get(e.id) ?? { total: new Prisma.Decimal(0), used: new Prisma.Decimal(0) };
      return {
        employeeId: e.id,
        employeeNo: e.employeeNo,
        name: e.name,
        departmentId: e.departmentId,
        departmentName: e.department?.name ?? '',
        totalDays: b.total.toNumber(),
        usedDays: b.used.toNumber(),
        remainingDays: b.total.minus(b.used).toNumber(),
        overtimeHours: overtimeMap.get(e.id) ?? 0,
      };
    });

    return { rows, total: rows.length };
  }
}
