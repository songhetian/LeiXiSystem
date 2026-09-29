import { ApprovalClientImpl } from './approval-client.impl';

/**
 * listPendingForUser 是报销域「待我审批的报销」的唯一数据来源（ADR-0013 跨模块只读接口）。
 *
 * 旧实现只按「节点角色匹配 + 该节点存在 pending 记录」筛实例，没有收敛到
 * instance.currentNodeKey。而建实例时审批链上**所有**节点的记录都是 pending，
 * 于是后置节点的审批人会被提前算成「当前待办人」：列表里出现轮到别人处理的单据，
 * 点同意还会被 currentNodeKey 校验挡回 403。必须与待办列表（buildTodoWhere）同口径，
 * 叠加「实例当前节点 = 本节点」条件。
 */
describe('ApprovalClientImpl · listPendingForUser', () => {
  let prisma: any;
  let impl: ApprovalClientImpl;

  beforeEach(() => {
    prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue([{ role: { code: 'finance' } }]) },
      approvalWorkflow: { findUnique: jest.fn().mockResolvedValue({ id: 3 }) },
      approvalWorkflowNode: {
        findMany: jest.fn().mockResolvedValue([{ id: 1, nodeKey: 'n1' }]),
      },
      approvalInstance: { findMany: jest.fn().mockResolvedValue([{ id: 55 }]) },
    };
    impl = new ApprovalClientImpl({} as any, prisma);
  });

  it('必须收敛到实例当前节点（否则后置节点审批人提前看到待办）', async () => {
    await impl.listPendingForUser(7, 'reimbursement');

    expect(prisma.approvalInstance.findMany).toHaveBeenCalledWith({
      where: {
        status: 'pending',
        workflowCode: 'reimbursement',
        currentNodeKey: { in: ['n1'] },
      },
      select: { id: true },
    });
  });

  it('用户无任何角色时直接返回空，不查实例', async () => {
    prisma.userRole.findMany.mockResolvedValue([]);

    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([]);
    expect(prisma.approvalInstance.findMany).not.toHaveBeenCalled();
  });

  it('审批流不存在时返回空，不查实例', async () => {
    prisma.approvalWorkflow.findUnique.mockResolvedValue(null);

    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([]);
    expect(prisma.approvalInstance.findMany).not.toHaveBeenCalled();
  });
});
