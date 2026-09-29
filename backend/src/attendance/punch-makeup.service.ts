import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ERROR_CODES } from '../common/error-codes';
import { beijingBusinessDate, beijingDateTime } from '../common/date.util';
import { ApprovalClientInterface } from '../approval/approval-client.interface';
import { AttendanceSettingsService } from './settings.service';
import { PUNCH_MAKEUP_TYPE_LABELS, PunchMakeupType } from './punch-makeup-type';

@Injectable()
export class PunchMakeupService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    @Inject('APPROVAL_CLIENT') private approvalService: ApprovalClientInterface,
    private settingsService: AttendanceSettingsService,
  ) {}

  async list(params: {
    employeeId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    userId: number;
    page: number;
    pageSize: number;
  }) {
    const { employeeId, status, startDate, endDate, userId, page, pageSize } = params;
    const scope = await this.dataScope.visibleScope(userId);

    const where: any = {};
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
    if (status) where.status = status;
    if (startDate || endDate) {
      where.punchDate = {};
      if (startDate) where.punchDate.gte = new Date(startDate);
      if (endDate) where.punchDate.lte = new Date(endDate);
    }

    const [list, total] = await Promise.all([
      this.prisma.punchMakeup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.punchMakeup.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async detail(id: number, userId?: number) {
    const makeup = await this.prisma.punchMakeup.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!makeup) {
      throw new NotFoundException({ code: 2101, message: '补卡申请不存在' });
    }
    if (userId !== undefined) {
      // IDOR fix: use DataScopeService instead of emp.userId check
      const scope = await this.dataScope.visibleScope(userId);
      const emp = await this.prisma.employee.findUnique({
        where: { id: makeup.employeeId },
      });
      if (scope.selfEmployeeId) {
        if (makeup.employeeId !== scope.selfEmployeeId) {
          throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他员工的记录' });
        }
      } else if (!scope.all) {
        if (!emp || !scope.ids.includes(emp.departmentId)) {
          throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权查看其他部门的记录' });
        }
      }
    }
    return makeup;
  }

  async create(params: {
    userId: number;
    punchDate: string;
    punchType: PunchMakeupType;
    originalTime?: string;
    makeupTime?: string;
    reason: string;
  }) {
    const emp = await this.prisma.employee.findFirst({
      where: { userId: params.userId },
    });
    if (!emp) {
      throw new BadRequestException({ code: 2102, message: '员工信息不存在' });
    }

    const settings = await this.settingsService.getSettings({ publicOnly: true });
    const daysLimit = Number(settings.makeupDaysLimit) || 30;

    // punchDate 由 'YYYY-MM-DD' 解析而来（UTC 午夜），「今天」也必须用北京时间的
    // 业务日同口径；用服务器本地 setHours 会在 UTC 容器里把北京 00:00~08:00 退回前一天，
    // 导致当天补卡被误判为「不能补未来日期的卡」
    const punchDateObj = new Date(params.punchDate);
    const today = beijingBusinessDate();

    const diffTime = today.getTime() - punchDateObj.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > daysLimit) {
      throw new BadRequestException({
        code: ERROR_CODES.MAKEUP_DATE_OUT_OF_RANGE,
        message: `只能补最近 ${daysLimit} 天内的卡，当前补卡日期已超出范围`,
      });
    }

    if (punchDateObj.getTime() > today.getTime()) {
      throw new BadRequestException({
        code: ERROR_CODES.MAKEUP_FUTURE_DATE,
        message: '不能补未来日期的卡',
      });
    }

    const data: any = {
      employeeId: emp.id,
      punchDate: new Date(params.punchDate),
      punchType: params.punchType,
      reason: params.reason,
    };
    if (params.originalTime) data.originalTime = beijingDateTime(punchDateObj, params.originalTime);
    if (params.makeupTime) data.makeupTime = beijingDateTime(punchDateObj, params.makeupTime);

    const makeup = await this.prisma.punchMakeup.create({ data });
    return makeup;
  }

  async update(id: number, userId: number, params: {
    punchDate?: string;
    punchType?: PunchMakeupType;
    originalTime?: string | null;
    makeupTime?: string | null;
    reason?: string;
  }) {
    const makeup = await this.prisma.punchMakeup.findUnique({ where: { id } });
    if (!makeup) {
      throw new NotFoundException({ code: 2101, message: '补卡申请不存在' });
    }
    if (makeup.status !== 'pending') {
      throw new BadRequestException({ code: 2103, message: '当前状态不可修改' });
    }

    const emp = await this.prisma.employee.findUnique({
      where: { id: makeup.employeeId },
    });
    if (!emp || emp.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    if (params.punchDate !== undefined) {
      const settings = await this.settingsService.getSettings({ publicOnly: true });
      const daysLimit = Number(settings.makeupDaysLimit) || 30;

      const punchDateObj = new Date(params.punchDate);
      const today = beijingBusinessDate();

      const diffTime = today.getTime() - punchDateObj.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > daysLimit) {
        throw new BadRequestException({
          code: ERROR_CODES.MAKEUP_DATE_OUT_OF_RANGE,
          message: `只能补最近 ${daysLimit} 天内的卡，当前补卡日期已超出范围`,
        });
      }

      if (punchDateObj.getTime() > today.getTime()) {
        throw new BadRequestException({
          code: ERROR_CODES.MAKEUP_FUTURE_DATE,
          message: '不能补未来日期的卡',
        });
      }
    }

    const data: any = {};
    if (params.punchDate !== undefined) {
      data.punchDate = new Date(params.punchDate);
    }
    if (params.punchType !== undefined) data.punchType = params.punchType;
    // 业务日优先取本次传入的新日期，未传则沿用原记录的业务日；时间一律按北京时间解析
    const businessDate = params.punchDate !== undefined ? new Date(params.punchDate) : makeup.punchDate;
    if (params.originalTime !== undefined) {
      data.originalTime = params.originalTime
        ? beijingDateTime(businessDate, params.originalTime)
        : null;
    }
    if (params.makeupTime !== undefined) {
      data.makeupTime = params.makeupTime
        ? beijingDateTime(businessDate, params.makeupTime)
        : null;
    }
    if (params.reason !== undefined) data.reason = params.reason;

    const updated = await this.prisma.punchMakeup.update({
      where: { id },
      data,
    });
    return updated;
  }

  async remove(id: number, userId: number) {
    const makeup = await this.prisma.punchMakeup.findUnique({ where: { id } });
    if (!makeup) {
      throw new NotFoundException({ code: 2101, message: '补卡申请不存在' });
    }
    if (makeup.status !== 'pending') {
      throw new BadRequestException({ code: 2103, message: '当前状态不可删除' });
    }

    const emp = await this.prisma.employee.findUnique({
      where: { id: makeup.employeeId },
    });
    if (!emp || emp.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    await this.prisma.punchMakeup.delete({ where: { id } });
    return { success: true };
  }

  async submit(id: number, userId: number) {
    const makeup = await this.prisma.punchMakeup.findUnique({ where: { id } });
    if (!makeup) {
      throw new NotFoundException({ code: 2101, message: '补卡申请不存在' });
    }
    if (makeup.status !== 'pending') {
      throw new BadRequestException({ code: 2103, message: '当前状态不可提交' });
    }
    if (makeup.approvalInstanceId) {
      throw new BadRequestException({ code: 2104, message: '已提交审批' });
    }

    const emp = await this.prisma.employee.findUnique({
      where: { id: makeup.employeeId },
    });
    if (!emp || emp.userId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }

    const settings = await this.settingsService.getSettings({ publicOnly: true });
    const monthlyLimit = Number(settings.makeupMonthlyLimit) || 3;

    // punchDate 以 UTC 午夜存储，故月份区间也必须用同一表示（UTC），
    // 否则在 UTC+8 主机上会把月末最后一天算到区间外，导致当月次数少统计
    const punchDate = new Date(makeup.punchDate);
    const year = punchDate.getUTCFullYear();
    const month = punchDate.getUTCMonth();

    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month + 1, 1));

    const monthlyCount = await this.prisma.punchMakeup.count({
      where: {
        employeeId: makeup.employeeId,
        punchDate: {
          gte: monthStart,
          lt: monthEnd,
        },
        status: {
          in: ['approving', 'approved', 'rejected'],
        },
      },
    });

    if (monthlyCount >= monthlyLimit) {
      throw new BadRequestException({
        code: ERROR_CODES.MAKEUP_MONTHLY_LIMIT,
        message: `当月补卡次数已达上限（${monthlyLimit}次），请下月再申请`,
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalService.startInstance({
      workflowCode: 'punch_makeup',
      title: `补卡申请 - ${emp.name} - ${PUNCH_MAKEUP_TYPE_LABELS[makeup.punchType as PunchMakeupType] ?? makeup.punchType}`,
      formData: {
        makeupId: makeup.id,
        punchDate: makeup.punchDate.toISOString().split('T')[0],
        punchType: makeup.punchType,
      },
      userId,
      userName: user!.realName,
      departmentId: emp.departmentId ?? undefined,
    });

    const updated = await this.prisma.punchMakeup.update({
      where: { id },
      data: {
        status: 'approving',
        approvalInstanceId: instance.id,
      },
    });

    return updated;
  }

  async approve(id: number, userId: number, comment?: string) {
    const makeup = await this.prisma.punchMakeup.findUnique({ where: { id } });
    if (!makeup) {
      throw new NotFoundException({ code: 2101, message: '补卡申请不存在' });
    }
    if (!makeup.approvalInstanceId) {
      throw new BadRequestException({ code: 2105, message: '未提交审批' });
    }
    if (makeup.status !== 'approving') {
      throw new BadRequestException({ code: 2103, message: '当前状态不可审批' });
    }

    const approver = await this.prisma.user.findUnique({ where: { id: userId } });

    await this.approvalService.approve({
      instanceId: makeup.approvalInstanceId,
      userId,
      userName: approver?.realName || '',
      comment,
    });

    // 终审状态迁移与「补卡写入考勤日报」统一由 approval.approved 监听器完成，
    // 服务层不得抢先改写状态：监听器以「approving → approved」条件更新作为一次性
    // 令牌，若此处先把状态改成 approved，监听器将抢不到令牌而直接返回，补卡永远不落库。
    return (await this.prisma.punchMakeup.findUnique({ where: { id } }))!;
  }

  async reject(id: number, userId: number, comment?: string) {
    const makeup = await this.prisma.punchMakeup.findUnique({ where: { id } });
    if (!makeup) {
      throw new NotFoundException({ code: 2101, message: '补卡申请不存在' });
    }
    if (!makeup.approvalInstanceId) {
      throw new BadRequestException({ code: 2105, message: '未提交审批' });
    }
    if (makeup.status !== 'approving') {
      throw new BadRequestException({ code: 2103, message: '当前状态不可审批' });
    }

    const approver = await this.prisma.user.findUnique({ where: { id: userId } });

    await this.approvalService.reject({
      instanceId: makeup.approvalInstanceId,
      userId,
      userName: approver?.realName || '',
      comment,
    });

    const updated = await this.prisma.punchMakeup.update({
      where: { id },
      data: {
        status: 'rejected',
        approverId: userId,
        approvedAt: new Date(),
        approvalNote: comment,
      },
    });

    return updated;
  }
}
