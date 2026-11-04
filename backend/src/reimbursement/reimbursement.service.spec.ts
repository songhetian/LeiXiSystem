import { ReimbursementService } from './reimbursement.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ERROR_CODES } from '../common/error-codes';
import { messageOf } from '../common/error-messages';

/** 取出 HTTP 异常响应体（含 code），便于断言中央错误码与文案 */
async function catchPayload(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e: any) {
    return e.getResponse?.() ?? e.response ?? e;
  }
  throw new Error('期望抛出异常，但未抛出');
}

function createMockPrisma() {
  return {
    user: { findUnique: jest.fn() },
    employee: { findFirst: jest.fn() },
    reimbursementType: { findUnique: jest.fn() },
    reimbursement: { create: jest.fn() },
  } as any;
}

/** getDetail 需要额外挂上 approvalWorkflowNode / approvalGroupMember 表 */
function createDetailMockPrisma() {
  return {
    ...createMockPrisma(),
    reimbursement: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    approvalWorkflowNode: { findUnique: jest.fn() },
    approvalGroupMember: { findUnique: jest.fn() },
  } as any;
}

describe('ReimbursementService · create', () => {
  let service: ReimbursementService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '张三' });
    prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'travel', name: '差旅' });
    prisma.reimbursement.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
    service = new ReimbursementService(prisma, {} as any, {} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 金额一律先转整数分再写库：1.005 的 double 实为 1.00499999999999989…，
   * 直接交给 MySQL DECIMAL(12,2) 会被截成 1.00，而合计走 toCents 得 1.01，
   * 造成「明细之和 ≠ 总金额」的对账缺口。
   */
  it('明细金额按「分」定点化后写库，避免浮点被截断成 1.00', async () => {
    await service.create({
      userId: 1,
      typeCode: 'travel',
      title: '差旅报销',
      totalAmount: 1.005,
      items: [{ name: '交通', amount: 1.005 }],
    });

    const data = prisma.reimbursement.create.mock.calls[0][0].data;
    expect(data.items.create[0].amount).toBe(1.01);
  });

  it('多笔明细定点化后，明细之和与总金额严格相等（禁浮点漂移）', async () => {
    await service.create({
      userId: 1,
      typeCode: 'travel',
      title: '差旅报销',
      totalAmount: 3.01,
      items: [
        { name: '交通', amount: 1.005 },
        { name: '餐饮', amount: 2.005 },
      ],
    });

    const data = prisma.reimbursement.create.mock.calls[0][0].data;
    const itemsSum = data.items.create.reduce((acc: number, i: any) => acc + i.amount, 0);
    expect(itemsSum).toBeCloseTo(data.totalAmount, 10);
    expect(data.items.create.map((i: any) => i.amount)).toEqual([1.01, 2.01]);
  });

  /**
   * status 是审批态，只能由审批流推进。创建接口若对 status 零校验，客户端
   * 传 'approved' 就会凭空造出一张「已通过」报销单：无 approvalInstanceId、
   * 无付款单，绕过整条审批流，且会出现在列表/导出中。
   */
  it('客户端注入 approved 等审批态时必须拒绝，且不落库', async () => {
    const payload = await catchPayload(() =>
      service.create({
        userId: 1,
        typeCode: 'travel',
        title: '差旅报销',
        totalAmount: 100,
        items: [{ name: '交通', amount: 100 }],
        status: 'approved' as any,
      }),
    );

    expect(payload.code).toBe(ERROR_CODES.PARAM_INVALID);
    expect(messageOf(payload.code)).toBe('参数校验失败');
    expect(prisma.reimbursement.create).not.toHaveBeenCalled();
  });

  it('status 传 draft / pending 时按原值落库（草稿与直接提交仍可用）', async () => {
    await service.create({
      userId: 1,
      typeCode: 'travel',
      title: '差旅报销',
      totalAmount: 100,
      items: [{ name: '交通', amount: 100 }],
      status: 'draft',
    });
    expect(prisma.reimbursement.create.mock.calls[0][0].data.status).toBe('draft');

    prisma.reimbursement.create.mockClear();
    await service.create({
      userId: 1,
      typeCode: 'travel',
      title: '差旅报销',
      totalAmount: 100,
      items: [{ name: '交通', amount: 100 }],
    });
    // 不传 status 时保持既有默认值 pending
    expect(prisma.reimbursement.create.mock.calls[0][0].data.status).toBe('pending');
  });
});

/**
 * 审批节点有两类审批人：role（按角色码）与 group（审批组）。
 * 详情页的可见性判断必须与 ApprovalService.canUserApprove 保持同一口径，
 * 否则「组型审批人」在待办里点开报销单详情会被 403 挡在门外。
 */
describe('ReimbursementService · getDetail 可见性', () => {
  let service: ReimbursementService;
  let prisma: ReturnType<typeof createDetailMockPrisma>;
  let approvalClient: { getInstanceStatus: jest.Mock };

  const instanceNode = (node: any, userRoles: string[] = []) => {
    prisma.reimbursement.findUnique.mockResolvedValue({
      id: 1,
      applicantId: 100,
      status: 'pending',
      approvalInstanceId: 5,
      items: [],
      attachments: [],
      type: null,
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      roles: userRoles.map((code) => ({ role: { code } })),
    });
    approvalClient.getInstanceStatus.mockResolvedValue({
      id: 5,
      workflowId: 9,
      currentNodeKey: 'node-1',
      status: 'pending',
    });
    prisma.approvalWorkflowNode.findUnique.mockResolvedValue(node);
  };

  beforeEach(() => {
    prisma = createDetailMockPrisma();
    approvalClient = { getInstanceStatus: jest.fn() };
    service = new ReimbursementService(prisma, {} as any, approvalClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('组型审批人是当前节点审批人时可查看详情', async () => {
    instanceNode({ type: 'group', approvalGroupId: 3, roleCode: null });
    prisma.approvalGroupMember.findUnique.mockResolvedValue({ id: 11, groupId: 3, userId: 7 });

    const result = await service.getDetail(1, 7);

    expect(result.id).toBe(1);
    expect(prisma.approvalGroupMember.findUnique).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 3, userId: 7 } },
    });
  });

  it('非审批组成员的普通用户仍被拒绝', async () => {
    instanceNode({ type: 'group', approvalGroupId: 3, roleCode: null });
    prisma.approvalGroupMember.findUnique.mockResolvedValue(null);

    await expect(service.getDetail(1, 7)).rejects.toThrow(ForbiddenException);
  });

  it('角色型审批人仍然可查看（回归保护）', async () => {
    instanceNode({ type: 'role', roleCode: 'finance', approvalGroupId: null }, ['finance']);

    const result = await service.getDetail(1, 7);

    expect(result.id).toBe(1);
  });
});

/**
 * 撤销报销单：approving 状态下单据已挂在审批实例上，只改本地状态而不撤回审批实例，
 * 会让审批实例永久停在 pending —— 审批人待办里残留一条已撤销的单据，
 * 且「审批超时提醒」会每天继续催办。
 */
describe('ReimbursementService · cancel', () => {
  let service: ReimbursementService;
  let prisma: any;
  let approvalClient: { withdraw: jest.Mock; getInstanceStatus: jest.Mock };

  beforeEach(() => {
    prisma = {
      reimbursement: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({ id: 1 }) },
    };
    approvalClient = { withdraw: jest.fn().mockResolvedValue(undefined), getInstanceStatus: jest.fn() };
    service = new ReimbursementService(prisma, {} as any, approvalClient as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('approving 状态撤销时必须撤回审批实例（否则审批人待办残留）', async () => {
    prisma.reimbursement.findUnique.mockResolvedValue({
      id: 1,
      applicantId: 7,
      status: 'approving',
      approvalInstanceId: 55,
    });

    await service.cancel(1, 7);

    expect(approvalClient.withdraw).toHaveBeenCalledWith({
      instanceId: 55,
      userId: 7,
      reason: expect.any(String),
    });
    expect(prisma.reimbursement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: 'cancelled', approvalInstanceId: null }),
      }),
    );
  });

  it('pending 状态（未提交审批）撤销时不调用撤回接口', async () => {
    prisma.reimbursement.findUnique.mockResolvedValue({
      id: 2,
      applicantId: 7,
      status: 'pending',
      approvalInstanceId: null,
    });

    await service.cancel(2, 7);

    expect(approvalClient.withdraw).not.toHaveBeenCalled();
    expect(prisma.reimbursement.update).toHaveBeenCalled();
  });

  it('非申请人撤销被拒绝，且不会触碰审批实例', async () => {
    prisma.reimbursement.findUnique.mockResolvedValue({
      id: 3,
      applicantId: 9,
      status: 'approving',
      approvalInstanceId: 66,
    });

    await expect(service.cancel(3, 7)).rejects.toThrow(ForbiddenException);
    expect(approvalClient.withdraw).not.toHaveBeenCalled();
    expect(prisma.reimbursement.update).not.toHaveBeenCalled();
  });
});

/**
 * 导出件的「单号」应是业务单号 reimbursementNo（详情页也按此展示），
 * 而不是自增主键 id；「申请日期」须按北京时间取日历日，
 * 日期筛选须按北京日历日的左闭右开区间过滤 createdAt。
 */
describe('ReimbursementService · exportExcel', () => {
  let service: ReimbursementService;
  let prisma: any;
  let dataScope: { visibleScope: jest.Mock };

  const row = {
    id: 7,
    reimbursementNo: 'BX20260930103000123',
    applicantName: '张三',
    departmentId: 3,
    typeCode: 'travel',
    type: { name: '差旅费' },
    totalAmount: 120.5,
    status: 'approved',
    createdAt: new Date('2026-09-30T17:30:00.000Z'), // 北京时间 2026-10-01 01:30
    description: '出差',
  };

  const loadSheet = async (buffer: Buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    return workbook.worksheets[0];
  };

  beforeEach(() => {
    prisma = {
      reimbursement: { findMany: jest.fn().mockResolvedValue([row]) },
      department: { findMany: jest.fn().mockResolvedValue([{ id: 3, name: '技术部' }]) },
    };
    dataScope = {
      visibleScope: jest.fn().mockResolvedValue({ all: true, ids: [], selfEmployeeId: null }),
    };
    service = new ReimbursementService(prisma, dataScope as any, {} as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('「单号」列导出业务单号 reimbursementNo 而非自增 id', async () => {
    const sheet = await loadSheet(await service.exportExcel(1, {}));

    expect(sheet.getRow(2).getCell(1).value).toBe('BX20260930103000123');
  });

  it('「申请日期」按北京时间取日历日（凌晨记录不落到前一天）', async () => {
    const sheet = await loadSheet(await service.exportExcel(1, {}));

    expect(sheet.getRow(2).getCell(7).value).toBe('2026-10-01');
  });

  it('日期筛选按北京日历日左闭右开区间过滤 createdAt', async () => {
    await service.exportExcel(1, { startDate: '2026-09-30', endDate: '2026-09-30' });

    const where = prisma.reimbursement.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte.toISOString()).toBe('2026-09-29T16:00:00.000Z');
    expect(where.createdAt.lt.toISOString()).toBe('2026-09-30T16:00:00.000Z');
  });

  /**
   * 导出接口的 departmentId 是前端筛选参数，属**收窄**条件：
   * 必须与数据范围求交集，不能覆盖数据范围。旧实现里 `where.departmentId = params.departmentId`
   * 会把经理的部门范围（in [3]）直接替换掉，越权导出范围外部门数据。
   */
  it('非全量范围 + 显式 departmentId：范围过滤与显式筛选取交集，不得被覆盖', async () => {
    dataScope.visibleScope.mockResolvedValue({ all: false, ids: [3], selfEmployeeId: null });

    await service.exportExcel(1, { departmentId: 99 });

    const where = prisma.reimbursement.findMany.mock.calls[0][0].where;
    // 展开顶层 + AND 数组：数据范围（in [3]）与显式部门（99）必须同时存在，取交集；
    // 旧实现里 departmentId 被显式参数覆盖为 99，范围约束丢失 → 越权导出。
    const conditions = [where, ...(where.AND ?? [])];
    expect(conditions).toEqual(
      expect.arrayContaining([{ departmentId: { in: [3] } }, { departmentId: 99 }]),
    );
    expect(where.departmentId).not.toBe(99);
  });
});

/**
 * Reimbursement.departmentId 全仓无写入点 → (1) 经理导出按部门范围过滤（departmentId IN scope.ids）
 * 恒为空表；(2) 提交审批不带 departmentId → routing-engine 的「部门主管」节点取不到
 * 申请人部门，节点被静默丢弃，报销可在无部门主管审批的情况下通过。
 */
describe('ReimbursementService · 申请人部门归属（导出范围 + 审批路由）', () => {
  let service: ReimbursementService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('创建报销时落申请人所在部门（否则经理导出恒为空表）', async () => {
    const prisma: any = createMockPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 1, realName: '张三' });
    prisma.employee.findFirst.mockResolvedValue({ departmentId: 6 });
    prisma.reimbursementType.findUnique.mockResolvedValue({ id: 1, code: 'travel', name: '差旅' });
    prisma.reimbursement.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data }));
    service = new ReimbursementService(prisma, {} as any, {} as any);

    await service.create({
      userId: 1,
      typeCode: 'travel',
      title: '差旅报销',
      totalAmount: 100,
      items: [{ name: '交通', amount: 100 }],
    });

    expect(prisma.reimbursement.create.mock.calls[0][0].data.departmentId).toBe(6);
  });

  it('提交审批时把申请人部门传给审批流（否则「部门主管」节点被静默跳过）', async () => {
    const prisma: any = {
      reimbursement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 5,
          applicantId: 1,
          title: '差旅报销',
          totalAmount: 100,
          typeCode: 'travel',
          status: 'pending',
          approvalInstanceId: null,
        }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 5, ...data })),
        // submit 先做「approvalInstanceId 为空」的原子占位（CAS），成功后才会建审批实例
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 1, realName: '张三' }) },
      employee: { findFirst: jest.fn().mockResolvedValue({ departmentId: 6 }) },
    };
    const approvalClient: any = {
      startInstance: jest.fn().mockResolvedValue({ id: 88, status: 'pending' }),
    };
    service = new ReimbursementService(prisma, {} as any, approvalClient);

    await service.submit(5, 1);

    expect(approvalClient.startInstance).toHaveBeenCalledWith(
      expect.objectContaining({ departmentId: 6 }),
    );
  });
});

/**
 * 提交审批的并发防护。
 *
 * submit 先读单据判断 approvalInstanceId 是否为空，再创建审批实例、回写 approvalInstanceId。
 * 两个并发请求都能通过「判空」检查，于是各自创建一个审批实例：其中一个成为永久 pending 的
 * 孤儿（审批人待办里重复出现、超时催办反复推送），且最后一次回写覆盖前者。
 * 修复：以 approvalInstanceId 为空为条件的原子占位（CAS），只有抢占成功的请求才建实例。
 */
describe('ReimbursementService · submit 并发防护（原子占位）', () => {
  function buildPrisma(reimbursement: any = {}) {
    return {
      reimbursement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 5,
          applicantId: 1,
          title: '差旅报销',
          totalAmount: 100,
          typeCode: 'travel',
          status: 'pending',
          approvalInstanceId: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 5, ...data })),
        ...reimbursement,
      },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 1, realName: '张三' }) },
      employee: { findFirst: jest.fn().mockResolvedValue({ departmentId: 6 }) },
    } as any;
  }

  it('原子占位必须带 approvalInstanceId:null 条件，否则挡不住并发双提交', async () => {
    const prisma = buildPrisma();
    const approvalClient: any = { startInstance: jest.fn().mockResolvedValue({ id: 88, status: 'pending' }) };

    await new ReimbursementService(prisma, {} as any, approvalClient).submit(5, 1);

    expect(prisma.reimbursement.updateMany).toHaveBeenCalledWith({
      where: { id: 5, approvalInstanceId: null, status: { in: ['pending', 'draft'] } },
      data: { status: 'approving' },
    });
  });

  it('占位失败（并发请求已抢先）时必须抛 4011 且不再创建审批实例', async () => {
    const prisma = buildPrisma({ updateMany: jest.fn().mockResolvedValue({ count: 0 }) });
    const approvalClient: any = { startInstance: jest.fn() };

    const payload = await catchPayload(() =>
      new ReimbursementService(prisma, {} as any, approvalClient).submit(5, 1),
    );

    expect(payload.code).toBe(ERROR_CODES.REIMBURSEMENT_ALREADY_SUBMITTED);
    expect(messageOf(payload.code)).toBe('已在审批中');
    expect(approvalClient.startInstance).not.toHaveBeenCalled();
  });

  it('审批实例创建失败时必须回滚占位状态，不得把单据卡在 approving', async () => {
    const prisma = buildPrisma();
    const approvalClient: any = { startInstance: jest.fn().mockRejectedValue(new Error('审批流未配置')) };

    await expect(
      new ReimbursementService(prisma, {} as any, approvalClient).submit(5, 1),
    ).rejects.toThrow('审批流未配置');

    expect(prisma.reimbursement.updateMany).toHaveBeenLastCalledWith({
      where: { id: 5, approvalInstanceId: null },
      data: { status: 'pending' },
    });
  });
});

/**
 * 「待我审批的报销」的数据范围。
 *
 * 旧实现用 `if (deptUserIds.length > 0)` 才把 applicantId 收窄到本部门：
 * 一旦范围解析结果为空（例如用户-部门关联表没有数据），过滤条件被**整条跳过**，
 * 属 fail-open —— 本该「什么都看不到」的部门经理反而看到全公司待审批报销单。
 * 同时部门的解析口径必须与 DataScopeService 一致（关联表 + User.departmentId + 本人负责的部门）。
 */
describe('ReimbursementService · listPending 数据范围（fail-closed）', () => {
  function buildPrisma() {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          realName: '主管',
          departmentId: null,
          roles: [{ role: { code: 'dept_manager' } }],
          employees: [],
        }),
      },
      userDepartment: { findMany: jest.fn().mockResolvedValue([]) },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      reimbursement: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
  }

  it('范围解析为空时不得跳过过滤：applicantId 必须为空集（宁可不显示，不可越权）', async () => {
    const prisma = buildPrisma();
    const approvalClient: any = { listPendingForUser: jest.fn().mockResolvedValue([55]) };

    await new ReimbursementService(prisma, {} as any, approvalClient).listPending(7, 1, 10);

    const where = prisma.reimbursement.findMany.mock.calls[0][0].where;
    expect(where.applicantId).toEqual({ in: [] });
  });

  it('部门用户范围按 User.departmentId 解析（用户-部门关联表为空时也能取到本部门成员）', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      realName: '主管',
      departmentId: 42,
      roles: [{ role: { code: 'dept_manager' } }],
      employees: [],
    });
    prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 21 }]);
    const approvalClient: any = { listPendingForUser: jest.fn().mockResolvedValue([55]) };

    await new ReimbursementService(prisma, {} as any, approvalClient).listPending(7, 1, 10);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { departmentId: { in: [42] } },
      select: { id: true },
    });
    const where = prisma.reimbursement.findMany.mock.calls[0][0].where;
    expect(where.applicantId).toEqual({ in: [21] });
  });
});

/**
 * 审批人通过/驳回：动作必须经 APPROVAL_CLIENT 落到审批实例上（ADR-0013），
 * 报销单状态由 reimbursement.listener 监听审批事件同步，service 不直接写审批表。
 * 未提交（无 approvalInstanceId）的单据不得放行，否则会带着空实例去调审批流。
 */
describe('ReimbursementService · 审批人通过/驳回', () => {
  function buildService(findUnique: jest.Mock, approvalClient: any) {
    return new ReimbursementService(
      { reimbursement: { findUnique } } as any,
      {} as any,
      approvalClient,
    );
  }

  async function catchException(fn: () => Promise<unknown>): Promise<any> {
    try {
      await fn();
    } catch (e) {
      return e;
    }
    throw new Error('期望抛出异常，但未抛出');
  }

  it('通过时调用 approvalClient.approve 并传入报销单的 approvalInstanceId', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 11, status: 'approving', approvalInstanceId: 88 })
      .mockResolvedValueOnce({ id: 11, status: 'approving' });
    const approvalClient = { approve: jest.fn().mockResolvedValue({ status: 'pending' }) };
    const service = buildService(findUnique, approvalClient);

    const result = await service.approveForApprover(11, 7, '', '同意');

    expect(approvalClient.approve).toHaveBeenCalledWith({
      instanceId: 88,
      userId: 7,
      userName: '',
      comment: '同意',
    });
    expect(result).toEqual({ id: 11, status: 'approving' });
  });

  it('无 approvalInstanceId 时返回 409 REIMBURSEMENT_STATUS_INVALID，且不调用审批流', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 11, status: 'pending', approvalInstanceId: null });
    const approvalClient = { approve: jest.fn(), reject: jest.fn() };
    const service = buildService(findUnique, approvalClient);

    const err = await catchException(() => service.approveForApprover(11, 7));

    expect(err.getStatus()).toBe(409);
    expect(err.getResponse().code).toBe(ERROR_CODES.REIMBURSEMENT_STATUS_INVALID);
    expect(approvalClient.approve).not.toHaveBeenCalled();
  });

  it('驳回原因为空（空串 / 纯空格）时返回 400 PARAM_INVALID，且不查询与调用审批流', async () => {
    const findUnique = jest.fn();
    const approvalClient = { approve: jest.fn(), reject: jest.fn() };
    const service = buildService(findUnique, approvalClient);

    const err = await catchException(() => service.rejectForApprover(11, 7, '', '   '));

    expect(err.getStatus()).toBe(400);
    expect(err.getResponse().code).toBe(ERROR_CODES.PARAM_INVALID);
    expect(findUnique).not.toHaveBeenCalled();
    expect(approvalClient.reject).not.toHaveBeenCalled();
  });

  it('驳回原因正常时调用 approvalClient.reject（原因首尾空格被裁剪）', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({ id: 11, status: 'approving', approvalInstanceId: 88 })
      .mockResolvedValueOnce({ id: 11, status: 'rejected' });
    const approvalClient = { approve: jest.fn(), reject: jest.fn().mockResolvedValue(undefined) };
    const service = buildService(findUnique, approvalClient);

    await service.rejectForApprover(11, 7, '', '  发票不齐全  ');

    expect(approvalClient.reject).toHaveBeenCalledWith({
      instanceId: 88,
      userId: 7,
      userName: '',
      comment: '发票不齐全',
    });
  });
});