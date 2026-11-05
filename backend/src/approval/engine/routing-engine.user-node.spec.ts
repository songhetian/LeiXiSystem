import {
  buildApprovalChain,
  resolveApproverList,
  resolveNextApprovers,
  type WorkflowNode,
} from './routing-engine';

/**
 * 「指定人员」节点（type='user'）。
 *
 * 引擎里必须有两处一致：resolveNextApprovers 产出 candidate（决定链上有没有这个节点），
 * resolveApproverList 产出具体的 userId 列表（决定谁收到待办/签名口径）。
 * 只实现前者的典型症状是：流程里看得到节点，但没人收到待办。
 */
function userNode(patch: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 'n1',
    nodeKey: 'n1',
    name: '指定人员审批',
    type: 'user',
    userId: 8,
    order: 1,
    ...patch,
  };
}

describe('routing-engine - 指定人员节点', () => {
  it('产出 userId 型审批人，而不是按角色/审批组展开', () => {
    expect(resolveNextApprovers(userNode(), {})).toEqual({ type: 'user', userId: 8 });
    expect(resolveApproverList([userNode()], 'n1', {})).toEqual([
      { userId: 8, required: true },
    ]);
  });

  it('节点未配置 userId 时不产生审批人（不会变成「所有人可审」）', () => {
    const node = userNode({ userId: undefined });
    expect(resolveNextApprovers(node, {})).toEqual({ type: 'user', userId: undefined });
    expect(resolveApproverList([node], 'n1', {})).toEqual([]);
  });

  it('生效条件不满足时整条跳过', () => {
    const node = userNode({
      conditionField: 'days',
      conditionOperator: 'gt',
      conditionValue: '3',
    });
    expect(resolveApproverList([node], 'n1', { formData: { days: 2 } })).toEqual([]);
    expect(resolveApproverList([node], 'n1', { formData: { days: 5 } })).toEqual([
      { userId: 8, required: true },
    ]);
  });

  it('审批链里保留节点顺序与 nodeKey', () => {
    const chain = buildApprovalChain(
      [
        userNode({ nodeKey: 'n1', id: 'n1', name: '直属上级', order: 1, userId: 8 }),
        userNode({ nodeKey: 'n2', id: 'n2', name: '财务复核', order: 2, userId: 9 }),
      ],
      {},
    );

    expect(chain.map((c) => c.nodeKey)).toEqual(['n1', 'n2']);
    expect(chain.map((c) => c.approvers)).toEqual([[{ userId: 8, required: true }], [{ userId: 9, required: true }]]);
  });
});
