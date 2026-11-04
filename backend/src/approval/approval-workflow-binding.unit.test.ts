import { ApprovalService } from './approval.service';
import { ERROR_CODES } from '../common/error-codes';

/**
 * 「流程设置页配置的流程是否真正应用到对应业务流」回归测试（ADR-0020）。
 *
 * 历史缺陷：startInstance 无条件用「角色职责授权」绑定的流程覆盖入参 workflowCode，
 * 不校验业务类型 —— 某角色绑定请假流程后，该角色提交报销会被塞进请假审批链。
 *
 * 契约：
 * 1. 业务已配置流程 → 永远使用业务配置的流程（职责授权不得覆盖）。
 * 2. 业务未配置流程 → 允许用角色绑定的流程兜底，但必须与请求业务同 module。
 * 3. 业务未配置且绑定流程跨 module → 仍应报「审批流不存在」。
 */
describe('ApprovalService.startInstance — 业务流程绑定（ADR-0020）', () => {
  let service: ApprovalService;
  let prisma: any;
  let roleWorkflowService: any;
  let created: any;

  const node = (id: number, nodeKey: string, roleCode: string) => ({
    id,
    nodeKey,
    name: `${roleCode} 审批`,
    type: 'role',
    roleCode,
    order: 1,
    conditionField: null,
    conditionOperator: null,
    conditionValue: null,
  });

  /** 数据库里已配置的流程：按 code 索引 */
  let workflowsByCode: Record<string, any>;

  function setup(configured: Record<string, any>, bound: any) {
    workflowsByCode = configured;
    created = null;
    // 职责授权服务的契约：传了 module 就只返回同 module 的绑定流程
    roleWorkflowService = {
      resolveWorkflowForUser: jest.fn().mockImplementation(async (_userId: number, opts: any = {}) =>
        bound && (!opts.module || opts.module === bound.module) ? bound : null,
      ),
    };

    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 7, realName: '张三' }) },
      approvalWorkflow: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          const wf = workflowsByCode[where.code];
          return wf ? wf : null;
        }),
      },
      department: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (cb: any) =>
        cb({
          approvalInstance: {
            create: jest.fn().mockImplementation(async ({ data }: any) => {
              created = data;
              return { id: 1, ...data };
            }),
          },
        }),
      ),
    };

    service = new ApprovalService(
      prisma,
      { notifyApproversForNode: jest.fn() } as any,
      { emit: jest.fn() } as any,
      { isEnabled: false, get: jest.fn(), set: jest.fn() } as any,
      roleWorkflowService,
    );
  }

  const call = (workflowCode = 'reimbursement') =>
    service.startInstance({
      workflowCode,
      title: '差旅报销',
      userId: 7,
      userName: '张三',
      departmentId: 3,
      formData: { amount: 1200 },
    });

  it('业务已配置流程时，角色绑定的其它业务流程不得覆盖它', async () => {
    setup(
      {
        reimbursement: {
          id: 1,
          code: 'reimbursement',
          module: 'reimbursement',
          status: 'active',
          deletedAt: null,
          nodes: [node(11, 'n1', 'finance')],
        },
        leave: {
          id: 2,
          code: 'leave',
          module: 'attendance',
          status: 'active',
          deletedAt: null,
          nodes: [node(21, 'n1', 'manager')],
        },
      },
      { id: 2, code: 'leave', module: 'attendance' },
    );

    await call();

    expect(created.workflowCode).toBe('reimbursement');
    expect(created.workflowId).toBe(1);
  });

  it('业务未配置流程时，同 module 的角色绑定流程可兜底', async () => {
    setup(
      {
        leave: {
          id: 2,
          code: 'leave',
          module: 'attendance',
          status: 'active',
          deletedAt: null,
          nodes: [node(21, 'n1', 'manager')],
        },
      },
      { id: 2, code: 'leave', module: 'attendance' },
    );

    // overtime 未配置，职责授权绑定的是同属 attendance 分组的请假流程
    await call('overtime');

    // 审批链取自兜底流程，但业务编码必须保留请求业务：审批通过后
    // approval.approved 事件按 workflowCode 分派回调，写成 'leave' 会让
    // 加班单进请假回调，查不到 leaveRecord 后静默 return（单据永久 approving）。
    expect(created.workflowCode).toBe('overtime');
    expect(created.workflowId).toBe(2);
  });

  it('业务未配置且绑定流程跨 module 时不得兜底，仍报审批流不存在', async () => {
    setup(
      {
        leave: {
          id: 2,
          code: 'leave',
          module: 'attendance',
          status: 'active',
          deletedAt: null,
          nodes: [node(21, 'n1', 'manager')],
        },
      },
      { id: 2, code: 'leave', module: 'attendance' },
    );

    // procurement 属 general 分组，不能被考勤分组的绑定流程顶替
    await expect(call('procurement')).rejects.toMatchObject({
      response: { code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_FOUND },
    });
    expect(created).toBeNull();
  });

  it('非登记的业务编码拼错时不得兜底，直接报审批流不存在', async () => {
    setup(
      {
        leave: {
          id: 2,
          code: 'leave',
          module: 'attendance',
          status: 'active',
          deletedAt: null,
          nodes: [node(21, 'n1', 'manager')],
        },
      },
      { id: 2, code: 'leave', module: 'attendance' },
    );

    // 'reimbursment' 拼错：不在登记表 → 没有 module → 不得退化成「不限制 module」
    await expect(call('reimbursment')).rejects.toMatchObject({
      response: { code: ERROR_CODES.APPROVAL_WORKFLOW_NOT_FOUND },
    });
    expect(created).toBeNull();
  });
});
