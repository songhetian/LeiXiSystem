import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ApprovalClientInterface } from '../approval/approval-client.interface';
import { validateStateTransition } from './reimbursement-state-machine';
import { ERROR_CODES } from '../common/error-codes';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ReimbursementService {
  constructor(
    private prisma: PrismaService,
    private dataScope: DataScopeService,
    @Inject('APPROVAL_CLIENT') private approvalClient: ApprovalClientInterface,
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

    if (params.totalAmount < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '报销总金额不能为负' });
    }
    for (const item of params.items) {
      if (item.amount < 0) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '报销明细金额不能为负' });
      }
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
        applicantName: user.realName,
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
    const isAdmin = roleCodes.includes('admin');
    const isDeptManager = roleCodes.includes('dept_manager');

    const instanceIds = await this.approvalClient.listPendingForUser(userId, 'reimbursement');

    const where: any = { approvalInstanceId: { in: instanceIds } };

    if (!isAdmin && isDeptManager) {
      const deptUserIds = await this.getDepartmentUserIds(userId);
      if (deptUserIds.length > 0) {
        where.applicantId = { in: deptUserIds };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.reimbursement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { type: true },
      }),
      this.prisma.reimbursement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private async getDepartmentUserIds(userId: number): Promise<number[]> {
    const userDepts = await this.prisma.userDepartment.findMany({
      where: { userId },
      select: { departmentId: true },
    });
    const deptIds = userDepts.map((d) => d.departmentId);
    const allDeptIds = [...deptIds];
    let frontier = deptIds;
    while (frontier.length > 0) {
      const children = await this.prisma.department.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const ids = children.map((c) => c.id);
      allDeptIds.push(...ids);
      frontier = ids;
    }

    const deptUsers = await this.prisma.userDepartment.findMany({
      where: { departmentId: { in: allDeptIds } },
      select: { userId: true },
    });
    return deptUsers.map((u) => u.userId);
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
        const instance = await this.approvalClient.getInstanceStatus(reim.approvalInstanceId);
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
      const approvalInstance = await this.approvalClient.getInstanceStatus(reim.approvalInstanceId);

      if (approvalInstance && reim.status === 'approving') {
        if (approvalInstance.status === 'approved') {
          const validation = validateStateTransition(reim.status, 'approved');
          if (!validation.valid) {
            throw new BadRequestException({ code: 4000, message: validation.message });
          }
          await this.prisma.reimbursement.update({
            where: { id },
            data: { status: 'approved' },
          });
          result.status = 'approved';
        } else if (approvalInstance.status === 'rejected') {
          const validation = validateStateTransition(reim.status, 'rejected');
          if (!validation.valid) {
            throw new BadRequestException({ code: 4000, message: validation.message });
          }
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
    const submitValidation = validateStateTransition(reim.status, 'approving');
    if (!submitValidation.valid) {
      throw new BadRequestException({ code: 4000, message: submitValidation.message });
    }
    if (reim.approvalInstanceId) {
      throw new BadRequestException({ code: 7006, message: '已在审批中' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    const instance = await this.approvalClient.startInstance({
      workflowCode: 'reimbursement',
      title: reim.title,
      formData: {
        reimbursementId: reim.id,
        totalAmount: reim.totalAmount.toString(),
        type: reim.typeCode,
      },
      userId,
      userName: user!.realName,
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

  async exportExcel(userId: number, params: {
    status?: string;
    type?: string;
    startDate?: string;
    endDate?: string;
    departmentId?: number;
  }): Promise<Buffer> {
    const scope = await this.dataScope.visibleScope(userId);
    const where: any = {};

    if (scope.selfEmployeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: scope.selfEmployeeId } });
      if (emp) {
        where.applicantId = emp.userId;
      } else {
        where.applicantId = -1;
      }
    } else if (!scope.all) {
      where.departmentId = { in: scope.ids };
    }

    if (params.status) where.status = params.status;
    if (params.type) where.typeCode = params.type;
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      if (params.endDate) where.createdAt.lte = new Date(new Date(params.endDate).getTime() + 86400000 - 1);
    }

    const reimbursements = await this.prisma.reimbursement.findMany({
      where,
      include: {
        type: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const deptIds = [...new Set(reimbursements.map((r) => r.departmentId).filter((id): id is number => id !== null))];
    const departments = await this.prisma.department.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    });
    const deptMap = new Map(departments.map((d) => [d.id, d.name]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('报销记录');
    sheet.columns = [
      { header: '单号', key: 'id', width: 10 },
      { header: '申请人', key: 'applicantName', width: 12 },
      { header: '部门', key: 'department', width: 20 },
      { header: '类型', key: 'type', width: 15 },
      { header: '金额', key: 'totalAmount', width: 12 },
      { header: '状态', key: 'status', width: 10 },
      { header: '申请日期', key: 'createdAt', width: 15 },
      { header: '说明', key: 'description', width: 30 },
    ];

    const statusMap: Record<string, string> = {
      draft: '草稿',
      pending: '待提交',
      approving: '审批中',
      approved: '已通过',
      rejected: '已驳回',
      cancelled: '已取消',
    };

    reimbursements.forEach((r) => {
      sheet.addRow({
        id: r.id,
        applicantName: r.applicantName,
        department: r.departmentId ? deptMap.get(r.departmentId) || '' : '',
        type: r.type?.name || r.typeCode,
        totalAmount: r.totalAmount.toString(),
        status: statusMap[r.status] || r.status,
        createdAt: r.createdAt ? r.createdAt.toISOString().split('T')[0] : '',
        description: r.description || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as any);
  }
}
