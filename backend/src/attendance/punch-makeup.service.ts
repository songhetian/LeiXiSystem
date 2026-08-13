import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalService } from '../approval/approval.service';

@Injectable()
export class PunchMakeupService {
  constructor(
    private prisma: PrismaService,
    private approvalService: ApprovalService,
  ) {}

  async list(params: {
    employeeId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }) {
    const { employeeId, status, startDate, endDate, page, pageSize } = params;
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
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
      const emp = await this.prisma.employee.findUnique({
        where: { id: makeup.employeeId },
      });
      if (!emp || emp.userId !== userId) {
        throw new ForbiddenException({ code: 5003, message: '无权限查看' });
      }
    }
    return makeup;
  }

  async create(params: {
    userId: number;
    punchDate: string;
    punchType: string;
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

    const data: any = {
      employeeId: emp.id,
      punchDate: new Date(params.punchDate),
      punchType: params.punchType,
      reason: params.reason,
    };
    if (params.originalTime) data.originalTime = new Date(`${params.punchDate} ${params.originalTime}`);
    if (params.makeupTime) data.makeupTime = new Date(`${params.punchDate} ${params.makeupTime}`);

    const makeup = await this.prisma.punchMakeup.create({ data });
    return makeup;
  }

  async update(id: number, userId: number, params: {
    punchDate?: string;
    punchType?: string;
    originalTime?: string;
    makeupTime?: string;
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

    const data: any = {};
    if (params.punchDate !== undefined) {
      data.punchDate = new Date(params.punchDate);
    }
    if (params.punchType !== undefined) data.punchType = params.punchType;
    if (params.originalTime !== undefined) {
      data.originalTime = params.originalTime
        ? new Date(`${params.punchDate || makeup.punchDate.toISOString().split('T')[0]} ${params.originalTime}`)
        : null;
    }
    if (params.makeupTime !== undefined) {
      data.makeupTime = params.makeupTime
        ? new Date(`${params.punchDate || makeup.punchDate.toISOString().split('T')[0]} ${params.makeupTime}`)
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalService.startInstance({
      workflowCode: 'punch_makeup',
      title: `补卡申请 - ${emp.name} - ${makeup.punchType}`,
      formData: {
        makeupId: makeup.id,
        punchDate: makeup.punchDate.toISOString().split('T')[0],
        punchType: makeup.punchType,
      },
      userId,
      userName: user!.name,
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
      userName: approver?.name || '',
      comment,
    });

    const updated = await this.prisma.punchMakeup.update({
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
      userName: approver?.name || '',
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
