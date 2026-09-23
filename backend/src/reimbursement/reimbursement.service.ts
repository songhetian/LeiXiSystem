import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataScopeService } from '../common/data-scope.service';
import { ApprovalClientInterface } from '../approval/approval-client.interface';
import { validateStateTransition } from './reimbursement-state-machine';
import { ERROR_CODES } from '../common/error-codes';
import { generateAutoCode } from '../common/code-gen.util';
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

  /** 报销类型列表（管理用，含停用） */
  async listAllTypes() {
    return this.prisma.reimbursementType.findMany({
      orderBy: { id: 'asc' },
    });
  }

  /**
   * 新建报销类型。编码可留空，由后端自动生成（前缀 ET + 时间戳 + 随机），避免用户手填英文编码。
   */
  async createType(params: { code?: string; name: string; description?: string }) {
    const code = params.code || generateAutoCode('ET');
    if (params.code) {
      const existing = await this.prisma.reimbursementType.findUnique({ where: { code } });
      if (existing) {
        throw new ConflictException({ code: 7010, message: '报销类型编码已存在' });
      }
    }
    return this.prisma.reimbursementType.create({
      data: {
        code,
        name: params.name,
        description: params.description,
        status: 'active',
      },
    });
  }

  async updateType(
    id: number,
    params: { name?: string; description?: string; status?: string },
  ) {
    const existing = await this.prisma.reimbursementType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({ code: 7011, message: '报销类型不存在' });
    }
    const data: any = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.description !== undefined) data.description = params.description;
    if (params.status !== undefined) data.status = params.status;
    return this.prisma.reimbursementType.update({ where: { id }, data });
  }

  async removeType(id: number) {
    const existing = await this.prisma.reimbursementType.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({ code: 7011, message: '报销类型不存在' });
    }
    const usedCount = await this.prisma.reimbursement.count({
      where: { typeId: id },
    });
    if (usedCount > 0) {
      throw new ConflictException({ code: 7012, message: '报销类型已被报销单占用，无法删除' });
    }
    await this.prisma.reimbursementType.delete({ where: { id } });
    return { success: true };
  }

  // ===== 二级费用类型（对齐老项目 expense_types）=====
  /** 启用中的费用类型（申请表单下拉用） */
  async listExpenseTypes() {
    return this.prisma.expenseType.findMany({
      where: { status: 'active' },
      orderBy: { id: 'asc' },
    });
  }

  /** 费用类型列表（管理用，含停用） */
  async listAllExpenseTypes() {
    return this.prisma.expenseType.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async createExpenseType(params: { name: string; unit?: string; sortOrder?: number }) {
    return this.prisma.expenseType.create({
      data: {
        name: params.name,
        unit: params.unit,
        sortOrder: params.sortOrder ?? 0,
        status: 'active',
      },
    });
  }

  async updateExpenseType(
    id: number,
    params: { name?: string; unit?: string; sortOrder?: number; status?: string },
  ) {
    const existing = await this.prisma.expenseType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 7011, message: '费用类型不存在' });
    }
    const data: any = {};
    if (params.name !== undefined) data.name = params.name;
    if (params.unit !== undefined) data.unit = params.unit;
    if (params.sortOrder !== undefined) data.sortOrder = params.sortOrder;
    if (params.status !== undefined) data.status = params.status;
    return this.prisma.expenseType.update({ where: { id }, data });
  }

  async removeExpenseType(id: number) {
    const existing = await this.prisma.expenseType.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 7011, message: '费用类型不存在' });
    }
    await this.prisma.expenseType.delete({ where: { id } });
    return { success: true };
  }

  // ===== 创建报销 =====
  /**
   * 报销单号自动生成（对齐老项目）：BX + 14位日期时间(YYYYMMDDHHmmss) + 3位随机数。
   * 即使同一秒并发也几乎不重复，满足唯一索引约束。
   */
  private generateReimbursementNo(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts =
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
      `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `BX${ts}${rand}`;
  }

  async create(params: {
    userId: number;
    typeCode: string;
    title: string;
    remark?: string;
    totalAmount: number;
    status?: 'draft' | 'pending';
    items: Array<{
      itemType?: string;
      name?: string;
      amount: number;
      expenseDate?: string | Date;
      description?: string;
      attachmentUrl?: string;
    }>;
    attachments?: Array<{ fileName: string; fileUrl: string }>;
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

    if (!params.items || params.items.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '报销明细不能为空' });
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

    return this.createWithRetry({
      type,
      user,
      params,
      itemsTotal,
    });
  }

  /** 写入报销单；单号在并发下命中唯一索引冲突（P2002）时重新生成并重试 */
  private async createWithRetry(ctx: {
    type: any;
    user: any;
    params: any;
    itemsTotal: number;
  }) {
    const { type, user, params, itemsTotal } = ctx;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.reimbursement.create({
          data: {
            reimbursementNo: this.generateReimbursementNo(),
            typeId: type.id,
            typeCode: type.code,
            title: params.title,
            description: params.remark,
            totalAmount: itemsTotal,
            applicantId: params.userId,
            applicantName: user.realName,
            status: params.status ?? 'pending',
            items: {
              create: params.items.map((item: any) => {
                const label = item.itemType?.trim() || item.name?.trim() || '其他';
                return {
                  name: label,
                  itemType: item.itemType?.trim() || item.name?.trim() || null,
                  expenseDate: item.expenseDate ? new Date(item.expenseDate) : null,
                  description: item.description,
                  attachmentUrl: item.attachmentUrl ?? null,
                  amount: item.amount,
                };
              }),
            },
            attachments: params.attachments?.length
              ? { create: params.attachments.map((a: any) => ({ fileName: a.fileName, fileUrl: a.fileUrl })) }
              : undefined,
          },
          include: { items: true, attachments: true },
        });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
        // 单号唯一冲突 → 重新生成单号并重试
      }
    }
    throw new ConflictException({ code: 7013, message: '报销单号生成冲突，请重试' });
  }

  // ===== 我的报销列表 =====
  async listMine(userId: number, page = 1, pageSize = 10, status?: string) {
    const skip = (page - 1) * pageSize;
    const where: any = { applicantId: userId };
    if (status) where.status = status;

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
        attachments: true,
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

  // ===== 撤销报销申请（对齐老项目：pending/approving 可撤销）=====
  async cancel(id: number, userId: number) {
    const reim = await this.prisma.reimbursement.findUnique({ where: { id } });
    if (!reim) {
      throw new NotFoundException({ code: 7004, message: '报销单不存在' });
    }
    if (reim.applicantId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    if (!['pending', 'approving'].includes(reim.status)) {
      throw new BadRequestException({ code: 7005, message: '当前状态不可撤销' });
    }
    const validation = validateStateTransition(reim.status, 'cancelled');
    if (!validation.valid) {
      throw new BadRequestException({ code: 4000, message: validation.message });
    }
    await this.prisma.reimbursement.update({
      where: { id },
      data: { status: 'cancelled', approvalInstanceId: null },
    });
    return { success: true };
  }

  // ===== 删除报销申请（对齐老项目：draft/cancelled/rejected 可删除，级联明细与附件）=====
  async remove(id: number, userId: number) {
    const reim = await this.prisma.reimbursement.findUnique({ where: { id } });
    if (!reim) {
      throw new NotFoundException({ code: 7004, message: '报销单不存在' });
    }
    if (reim.applicantId !== userId) {
      throw new ForbiddenException({ code: 5003, message: '无权限操作' });
    }
    if (!['draft', 'cancelled', 'rejected'].includes(reim.status)) {
      throw new BadRequestException({ code: 7005, message: '当前状态不可删除' });
    }
    await this.prisma.reimbursement.delete({ where: { id } });
    return { success: true };
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
