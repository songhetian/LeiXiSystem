import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalService } from '../approval/approval.service';

@Injectable()
export class ReimbursementService {
  constructor(
    private prisma: PrismaService,
    private approvalService: ApprovalService,
  ) {}

  // ===== 报销类型 =====
  async listTypes() {
    return this.prisma.reimbursementType.findMany({
      where: { status: 'active' },
      orderBy: { id: 'asc' },
    });
  }

  // ===== 创建报销 =====
  async create(params: {
    userId: number;
    typeCode: string;
    title: string;
    description?: string;
    totalAmount: number;
    items: Array<{ name: string; amount: number; description?: string }>;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new NotFoundException({ code: 7002, message: '用户不存在' });
    }

    const type = await this.prisma.reimbursementType.findUnique({
      where: { code: params.typeCode },
    });
    if (!type) {
      throw new NotFoundException({ code: 7003, message: '报销类型不存在' });
    }

    const itemsTotal = params.items.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(itemsTotal - params.totalAmount) > 0.01) {
      throw new BadRequestException({ code: 7001, message: '明细金额合计与总金额不一致' });
    }

    return this.prisma.reimbursement.create({
      data: {
        typeId: type.id,
        typeCode: type.code,
        title: params.title,
        description: params.description,
        totalAmount: params.totalAmount,
        applicantId: params.userId,
        applicantName: user.name,
        status: 'pending',
        items: {
          create: params.items.map((item) => ({
            name: item.name,
            description: item.description,
            amount: item.amount,
          })),
        },
      },
      include: { items: true },
    });
  }

  // ===== 我的报销列表 =====
  async listMine(userId: number, page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.reimbursement.findMany({
        where: { applicantId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { type: true },
      }),
      this.prisma.reimbursement.count({ where: { applicantId: userId } }),
    ]);
    return { items, total, page, pageSize };
  }

  // ===== 待我审批的报销 =====
  async listPending(userId: number, page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException({ code: 7002, message: '用户不存在' });

    const roleCodes = user.roles.map((ur) => ur.role.code);

    const pendingInstances = await this.prisma.approvalInstance.findMany({
      where: {
        status: 'pending',
        workflowCode: 'reimbursement',
        records: {
          some: {
            status: 'pending',
            node: {
              type: 'role',
              roleCode: { in: roleCodes },
            },
          },
        },
      },
      select: { id: true },
    });

    const instanceIds = pendingInstances.map((i) => i.id);

    const [items, total] = await Promise.all([
      this.prisma.reimbursement.findMany({
        where: { approvalInstanceId: { in: instanceIds } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { type: true },
      }),
      this.prisma.reimbursement.count({
        where: { approvalInstanceId: { in: instanceIds } },
      }),
    ]);

    return { items, total, page, pageSize };
  }

  // ===== 报销详情 =====
  async getDetail(id: number, userId: number) {
    const reim = await this.prisma.reimbursement.findUnique({
      where: { id },
      include: {
        items: true,
        type: true,
      },
    });
    if (!reim) {
      throw new NotFoundException({ code: 7004, message: '报销单不存在' });
    }

    if (reim.applicantId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
      const isAdmin = user?.roles.some((ur) => ur.role.code === 'admin');

      let canView = isAdmin;
      if (!canView && reim.approvalInstanceId) {
        const roleCodes = user!.roles.map((ur) => ur.role.code);
        const instance = await this.prisma.approvalInstance.findUnique({
          where: { id: reim.approvalInstanceId },
        });
        if (instance && instance.currentNodeKey) {
          const node = await this.prisma.approvalWorkflowNode.findUnique({
            where: { workflowId_nodeKey: { workflowId: instance.workflowId, nodeKey: instance.currentNodeKey } },
          });
          if (node && node.type === 'role' && node.roleCode && roleCodes.includes(node.roleCode)) {
            canView = true;
          }
        }
      }

      if (!canView) {
        throw new ForbiddenException({ code: 5003, message: '无权限查看' });
      }
    }

    const result: any = { ...reim };

    if (reim.approvalInstanceId) {
      const approvalInstance = await this.prisma.approvalInstance.findUnique({
        where: { id: reim.approvalInstanceId },
        include: { records: { orderBy: { order: 'asc' } } },
      });
      result.approvalInstance = approvalInstance;

      if (approvalInstance && reim.status === 'approving') {
        if (approvalInstance.status === 'approved') {
          await this.prisma.reimbursement.update({
            where: { id },
            data: { status: 'approved' },
          });
          result.status = 'approved';
        } else if (approvalInstance.status === 'rejected') {
          await this.prisma.reimbursement.update({
            where: { id },
            data: { status: 'rejected' },
          });
          result.status = 'rejected';
        }
      }
    }

    return result;
  }

  // ===== 发起审批 =====
  async submit(id: number, userId: number) {
    const reim = await this.prisma.reimbursement.findUnique({ where: { id } });
    if (!reim) {
      throw new NotFoundException({ code: 7004, message: '报销单不存在' });
    }
    if (reim.applicantId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    if (reim.status !== 'pending' && reim.status !== 'draft') {
      throw new BadRequestException({ code: 7005, message: '当前状态不可提交审批' });
    }
    if (reim.approvalInstanceId) {
      throw new BadRequestException({ code: 7006, message: '已在审批中' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalService.startInstance({
      workflowCode: 'reimbursement',
      title: reim.title,
      formData: {
        reimbursementId: reim.id,
        totalAmount: reim.totalAmount.toString(),
        type: reim.typeCode,
      },
      userId,
      userName: user!.name,
    });

    const updated = await this.prisma.reimbursement.update({
      where: { id },
      data: {
        status: 'approving',
        approvalInstanceId: instance.id,
      },
      include: { items: true },
    });

    return updated;
  }
}
