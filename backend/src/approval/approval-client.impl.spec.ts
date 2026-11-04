import { ApprovalClientImpl } from './approval-client.impl';

/**
 * listPendingForUser 是报销域「待我审批的报销」的唯一数据来源（ADR-0013 跨模块只读接口）。
 *
 * 两条硬要求：
 * 1) 必须收敛到 instance.currentNodeKey。建实例时审批链上**所有**节点的记录都是 pending，
 *    只按节点角色匹配会把后置节点的审批人提前算成当前待办人（列表里出现轮到别人处理的
 *    单据，点同意还会被 currentNodeKey 校验挡回 403）。
 * 2) 节点必须按**实例自己的 workflowId** 解析，不能用业务码反查流程定义。业务未配置流程、
 *    走角色兜底时 instance.workflowCode 是业务码而 workflowId 指向兜底流程（如 leave），
 *    按 code 查 reimbursement 会查不到流程，待办恒为空。
 */
describe('ApprovalClientImpl · listPendingForUser', () => {
  let prisma: any;
  let impl: ApprovalClientImpl;

  beforeEach(() => {
    prisma = {
      userRole: { findMany: jest.fn().mockResolvedValue([{ role: { code: 'finance' } }]) },
      approvalWorkflowNode: {
        findMany: jest.fn().mockResolvedValue([{ workflowId: 3, id: 1, nodeKey: 'n1' }]),
      },
      approvalInstance: {
        findMany: jest.fn().mockResolvedValue([{ id: 55, workflowId: 3, currentNodeKey: 'n1' }]),
      },
    };
    impl = new ApprovalClientImpl({} as any, prisma);
  });

  it('按实例 workflowId + currentNodeKey 收敛，且不再按业务码查流程定义', async () => {
    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([55]);

    expect(prisma.approvalInstance.findMany).toHaveBeenCalledWith({
      where: { status: 'pending', workflowCode: 'reimbursement' },
      select: { id: true, workflowId: true, currentNodeKey: true },
    });
    expect(prisma.approvalWorkflowNode.findMany).toHaveBeenCalledWith({
      where: { workflowId: { in: [3] }, type: 'role', roleCode: { in: ['finance'] } },
      select: { workflowId: true, id: true, nodeKey: true },
    });
  });

  it('业务未配置流程（实例指向兜底流程）时仍能查到待办', async () => {
    // workflowId=9 是兜底流程 leave 的 id，业务码仍是 reimbursement
    prisma.approvalInstance.findMany.mockResolvedValue([
      { id: 77, workflowId: 9, currentNodeKey: 'n1' },
    ]);
    prisma.approvalWorkflowNode.findMany.mockResolvedValue([{ workflowId: 9, id: 2, nodeKey: 'n1' }]);

    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([77]);
  });

  it('实例当前节点不是本人角色节点时被过滤掉', async () => {
    prisma.approvalInstance.findMany.mockResolvedValue([
      { id: 55, workflowId: 3, currentNodeKey: 'n2' },
    ]);

    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([]);
  });

  it('同名 nodeKey 不会跨流程串号', async () => {
    prisma.approvalInstance.findMany.mockResolvedValue([
      { id: 56, workflowId: 4, currentNodeKey: 'n1' },
    ]);

    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([]);
  });

  it('用户无任何角色时直接返回空，不查实例', async () => {
    prisma.userRole.findMany.mockResolvedValue([]);

    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([]);
    expect(prisma.approvalInstance.findMany).not.toHaveBeenCalled();
  });

  it('没有在途实例时不查节点表', async () => {
    prisma.approvalInstance.findMany.mockResolvedValue([]);

    await expect(impl.listPendingForUser(7, 'reimbursement')).resolves.toEqual([]);
    expect(prisma.approvalWorkflowNode.findMany).not.toHaveBeenCalled();
  });
});
