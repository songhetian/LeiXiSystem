import {
  Injectable,
  Inject,
  Logger,
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
import { sumReimbursementItems } from './reimbursement-items';
import { fromCents, toCents } from '../common/money.util';
import { beijingDateRangeFilter, beijingDateTimeStr } from '../common/date.util';
import * as ExcelJS from 'exceljs';
import { errorCode } from '../common/error.util';

/** 创建报销单时允许客户端指定的状态：仅草稿与直接提交，其余审批态只能由审批流推进 */
const CREATABLE_STATUSES: ReadonlyArray<'draft' | 'pending'> = ['draft', 'pending'];

@Injectable()
export class ReimbursementService {
  private readonly logger = new Logger(ReimbursementService.name);

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
        throw new ConflictException({ code: ERROR_CODES.REIMBURSEMENT_TYPE_CODE_EXISTS, message: '报销类型编码已存在' });
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_TYPE_NOT_FOUND, message: '报销类型不存在' });
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_TYPE_NOT_FOUND, message: '报销类型不存在' });
    }
    const usedCount = await this.prisma.reimbursement.count({
      where: { typeId: id },
    });
    if (usedCount > 0) {
      throw new ConflictException({ code: ERROR_CODES.REIMBURSEMENT_TYPE_IN_USE, message: '报销类型已被报销单占用，无法删除' });
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_TYPE_NOT_FOUND, message: '费用类型不存在' });
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_TYPE_NOT_FOUND, message: '费用类型不存在' });
    }
    await this.prisma.expenseType.delete({ where: { id } });
    return { success: true };
  }

  // ===== 创建报销 =====
  /**
   * 报销单号自动生成（对齐老项目）：BX + 14位日期时间(YYYYMMDDHHmmss) + 3位随机数。
   * 时间戳按北京时间生成，UTC 容器下不会偏 8 小时（见 generateAutoCode）。
   */
  private generateReimbursementNo(): string {
    return generateAutoCode('BX');
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_USER_NOT_FOUND, message: '用户不存在' });
    }

    const type = await this.prisma.reimbursementType.findUnique({
      where: { code: params.typeCode },
    });
    if (!type) {
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_TYPE_NOT_FOUND, message: '报销类型不存在' });
    }

    if (!params.items || params.items.length === 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '报销明细不能为空' });
    }
    if (params.totalAmount < 0) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '报销总金额不能为负' });
    }
    // status 是审批态，只能由审批流推进。创建接口仅接受 draft（暂存）/pending（直接提交），
    // 否则客户端注入 'approved' 即可凭空造出「已通过」报销单（无审批实例、无付款单），
    // 绕过整条审批链，且会出现在列表与导出中。
    if (params.status !== undefined && !CREATABLE_STATUSES.includes(params.status)) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '报销单状态非法' });
    }
    for (const item of params.items) {
      if (item.amount < 0) {
        throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: '报销明细金额不能为负' });
      }
    }
    const itemsTotal = sumReimbursementItems(params.items.map((item: any) => item.amount));
    // 容差比较必须落在「分」的整数域：3.02 - 3.01 在 double 下是 0.010000000000000231，
    // 直接用 > 0.01 会把合法输入误判为「合计不一致」。
    if (Math.abs(toCents(itemsTotal) - toCents(params.totalAmount)) > 1) {
      throw new BadRequestException({ code: ERROR_CODES.REIMBURSEMENT_AMOUNT_MISMATCH, message: '明细金额合计与总金额不一致' });
    }

    return this.createWithRetry({
      type,
      user,
      params,
      itemsTotal,
      departmentId: await this.resolveApplicantDepartmentId(params.userId),
    });
  }

  /**
   * 申请人所属部门：报销单须落库 departmentId，否则
   * (1) 部门经理导出（departmentId IN 可见范围）恒为空表；
   * (2) 提交审批时不传部门 → 审批流「部门主管」节点取不到申请部门。
   */
  private async resolveApplicantDepartmentId(userId: number): Promise<number | null> {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
      select: { departmentId: true },
    });
    return employee?.departmentId ?? null;
  }

  /** 写入报销单；单号在并发下命中唯一索引冲突（P2002）时重新生成并重试 */
  private async createWithRetry(ctx: {
    type: any;
    user: any;
    params: any;
    itemsTotal: number;
    departmentId: number | null;
  }) {
    const { type, user, params, itemsTotal, departmentId } = ctx;
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
            departmentId,
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
                  amount: fromCents(toCents(item.amount)),
                };
              }),
            },
            attachments: params.attachments?.length
              ? { create: params.attachments.map((a: any) => ({ fileName: a.fileName, fileUrl: a.fileUrl })) }
              : undefined,
          },
          include: { items: true, attachments: true },
        });
      } catch (err) {
        if (errorCode(err) !== 'P2002') throw err;
        // 单号唯一冲突 → 重新生成单号并重试
      }
    }
    throw new ConflictException({ code: ERROR_CODES.REIMBURSEMENT_NO_CONFLICT, message: '报销单号生成冲突，请重试' });
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
    if (!user) throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_USER_NOT_FOUND, message: '用户不存在' });

    const roleCodes = user.roles.map((ur) => ur.role.code);
    const isAdmin = roleCodes.includes('admin');
    const isDeptManager = roleCodes.includes('dept_manager');

    const instanceIds = await this.approvalClient.listPendingForUser(userId, 'reimbursement');

    const where: any = { approvalInstanceId: { in: instanceIds } };

    if (!isAdmin && isDeptManager) {
      // fail-closed：范围解析为空即 applicantId IN []（恒空），不得整条跳过过滤条件，
      // 否则部门经理在「范围为空」时会看到全公司的待审批报销单。
      where.applicantId = { in: await this.getDepartmentUserIds(userId) };
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

  /**
   * 本人可见部门（本部门 + 子部门）下的用户 ID。
   *
   * 部门来源必须与 DataScopeService 口径一致：用户-部门关联表 + User.departmentId
   * + 本人作为负责人的部门。只读关联表会得到恒空集合（生产链路无写入点），
   * 使部门过滤静默失效；用户归属同理必须按 User.departmentId 取。
   */
  private async getDepartmentUserIds(userId: number): Promise<number[]> {
    const deptIds = new Set<number>();

    const userDepts = await this.prisma.userDepartment.findMany({
      where: { userId },
      select: { departmentId: true },
    });
    userDepts.forEach((d) => deptIds.add(d.departmentId));

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { departmentId: true, employees: { select: { id: true } } },
    });
    if (user?.departmentId) deptIds.add(user.departmentId);

    const employeeId = user?.employees?.[0]?.id;
    if (employeeId) {
      const managed = await this.prisma.department.findMany({
        where: { managerId: employeeId },
        select: { id: true },
      });
      managed.forEach((d) => deptIds.add(d.id));
    }

    if (deptIds.size === 0) return [];

    const allDeptIds = await this.collectDepartmentSubtree(Array.from(deptIds));
    const members = await this.prisma.user.findMany({
      where: { departmentId: { in: allDeptIds } },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  /** 展开给定部门及其所有后代部门 */
  private async collectDepartmentSubtree(rootDeptIds: number[]): Promise<number[]> {
    const allDeptIds = [...rootDeptIds];
    let frontier = rootDeptIds;
    while (frontier.length > 0) {
      const children = await this.prisma.department.findMany({
        where: { parentId: { in: frontier } },
        select: { id: true },
      });
      const ids = children.map((c) => c.id);
      allDeptIds.push(...ids);
      frontier = ids;
    }
    return allDeptIds;
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_NOT_FOUND, message: '报销单不存在' });
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
          // 组型审批人（审批组）同样应能打开自己正在审批的单据，
          // 口径与 ApprovalService.canUserApprove 保持一致。
          if (!canView && node && node.type === 'group' && node.approvalGroupId) {
            const member = await this.prisma.approvalGroupMember.findUnique({
              where: { groupId_userId: { groupId: node.approvalGroupId, userId } },
            });
            if (member) {
              canView = true;
            }
          }
        }
      }

      if (!canView) {
        throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权限查看' });
      }
    }

    const result: any = { ...reim };

    if (reim.approvalInstanceId) {
      const approvalInstance = await this.approvalClient.getInstanceStatus(reim.approvalInstanceId);

      if (approvalInstance && reim.status === 'approving') {
        if (approvalInstance.status === 'approved') {
          const validation = validateStateTransition(reim.status, 'approved');
          if (!validation.valid) {
            throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: validation.message });
          }
          await this.prisma.reimbursement.update({
            where: { id },
            data: { status: 'approved' },
          });
          result.status = 'approved';
        } else if (approvalInstance.status === 'rejected') {
          const validation = validateStateTransition(reim.status, 'rejected');
          if (!validation.valid) {
            throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: validation.message });
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_NOT_FOUND, message: '报销单不存在' });
    }
    if (reim.applicantId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权限操作' });
    }
    if (reim.status !== 'pending' && reim.status !== 'draft') {
      throw new BadRequestException({ code: ERROR_CODES.REIMBURSEMENT_STATUS_INVALID, message: '当前状态不可提交审批' });
    }
    const submitValidation = validateStateTransition(reim.status, 'approving');
    if (!submitValidation.valid) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: submitValidation.message });
    }
    if (reim.approvalInstanceId) {
      throw new BadRequestException({ code: ERROR_CODES.REIMBURSEMENT_ALREADY_SUBMITTED, message: '已在审批中' });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // 必须带上申请部门，否则审批路由引擎的「部门主管」节点取不到申请人部门，
    // 该节点会在 buildApprovalChain 中被静默丢弃，报销绕过部门主管直接进入下一节点。
    const departmentId = await this.resolveApplicantDepartmentId(userId);

    // 并发提交防护：上面的判空（approvalInstanceId）只是读取快照，两个并发请求都会通过。
    // 这里用带 approvalInstanceId:null 条件的原子占位作为 CAS，抢占失败的一方直接返回 4011，
    // 避免同一张单据产生两个审批实例（孤儿实例会永久留在审批人待办里并被反复催办）。
    const claimed = await this.prisma.reimbursement.updateMany({
      where: { id, approvalInstanceId: null, status: { in: ['pending', 'draft'] } },
      data: { status: 'approving' },
    });
    if (claimed.count === 0) {
      throw new ConflictException({
        code: ERROR_CODES.REIMBURSEMENT_ALREADY_SUBMITTED,
        message: '已在审批中',
      });
    }

    let instance: { id: number };
    try {
      instance = await this.approvalClient.startInstance({
        workflowCode: 'reimbursement',
        title: reim.title,
        formData: {
          reimbursementId: reim.id,
          totalAmount: reim.totalAmount.toString(),
          type: reim.typeCode,
        },
        userId,
        userName: user!.realName,
        departmentId: departmentId ?? undefined,
      });
    } catch (err) {
      // 实例创建失败必须撤销占位，否则单据被卡在 approving 且没有审批实例。
      try {
        await this.prisma.reimbursement.updateMany({
          where: { id, approvalInstanceId: null },
          data: { status: reim.status },
        });
      } catch (rollbackErr) {
        // 回滚也失败：单据将卡在 approving，需要人工介入修复
        this.logger.error(
          `rollback failed for reimbursement ${id} after approval.create failed: ${rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)}`,
        );
      }
      throw err;
    }

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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_NOT_FOUND, message: '报销单不存在' });
    }
    if (reim.applicantId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权限操作' });
    }
    if (!['pending', 'approving'].includes(reim.status)) {
      throw new BadRequestException({ code: ERROR_CODES.REIMBURSEMENT_STATUS_INVALID, message: '当前状态不可撤销' });
    }
    const validation = validateStateTransition(reim.status, 'cancelled');
    if (!validation.valid) {
      throw new BadRequestException({ code: ERROR_CODES.PARAM_INVALID, message: validation.message });
    }
    // 已挂在审批实例上的单据必须先撤回实例：只改本地状态会让审批实例永久停在
    // pending —— 审批人待办残留一条已撤销的单据，且「审批超时提醒」每天继续催办。
    if (reim.approvalInstanceId) {
      await this.approvalClient.withdraw({
        instanceId: reim.approvalInstanceId,
        userId,
        reason: '报销申请撤销',
      });
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
      throw new NotFoundException({ code: ERROR_CODES.REIMBURSEMENT_NOT_FOUND, message: '报销单不存在' });
    }
    if (reim.applicantId !== userId) {
      throw new ForbiddenException({ code: ERROR_CODES.DATA_NO_PERMISSION, message: '无权限操作' });
    }
    if (!['draft', 'cancelled', 'rejected'].includes(reim.status)) {
      throw new BadRequestException({ code: ERROR_CODES.REIMBURSEMENT_STATUS_INVALID, message: '当前状态不可删除' });
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
    // 数据范围与显式筛选都进 AND 数组求交集：departmentId 是收窄条件，
    // 直接赋值会覆盖数据范围，造成经理越权导出范围外部门的报销数据。
    const and: any[] = [];

    if (scope.selfEmployeeId) {
      const emp = await this.prisma.employee.findUnique({ where: { id: scope.selfEmployeeId } });
      if (emp) {
        and.push({ applicantId: emp.userId });
      } else {
        and.push({ applicantId: -1 });
      }
    } else if (!scope.all) {
      and.push({ departmentId: { in: scope.ids } });
    }

    if (params.status) where.status = params.status;
    if (params.type) where.typeCode = params.type;
    if (params.departmentId) and.push({ departmentId: params.departmentId });
    if (params.startDate || params.endDate) {
      // createdAt 是真实时刻，日期筛选须按北京日历日的左闭右开区间
      where.createdAt = beijingDateRangeFilter(params.startDate, params.endDate);
    }
    if (and.length > 0) where.AND = and;

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
      { header: '单号', key: 'reimbursementNo', width: 24 },
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
        // 单号是业务单号（BX…），历史数据可能为空，回退到主键避免出现空白单元格
        reimbursementNo: r.reimbursementNo || String(r.id),
        applicantName: r.applicantName,
        department: r.departmentId ? deptMap.get(r.departmentId) || '' : '',
        type: r.type?.name || r.typeCode,
        totalAmount: r.totalAmount.toString(),
        status: statusMap[r.status] || r.status,
        createdAt: beijingDateTimeStr(r.createdAt).slice(0, 10),
        description: r.description || '',
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
