import { validateWorkflowNodes } from '@/features/approval/pages/settings';
import type { WorkflowNode } from '@/services/approval';

/**
 * 节点配置弹窗的保存前校验。
 *
 * 背景：后端 routing-engine 的 getCondition 只在「字段 + 运算符」都存在时才把节点
 * 当作有条件，少一个就整条忽略（节点对所有人无条件生效）；而运算符有值、比较值为
 * 空时 Number('') === 0，会变成「大于 0」这种恒真条件。这两种都是静默错误，
 * 只能在前端拦。
 */
function node(patch: Partial<WorkflowNode>): WorkflowNode {
  return { nodeKey: 'n1', name: '审批节点', type: 'role', order: 1, ...patch };
}

describe('validateWorkflowNodes', () => {
  it('无节点时通过（允许清空节点后再配置）', () => {
    expect(validateWorkflowNodes([])).toBeNull();
  });

  it('角色节点必须选择审批角色', () => {
    expect(validateWorkflowNodes([node({ type: 'role' })])).toContain('未选择审批角色');
    expect(validateWorkflowNodes([node({ type: 'role', roleCode: 'hr' })])).toBeNull();
  });

  it('审批组节点必须选择审批组', () => {
    expect(validateWorkflowNodes([node({ type: 'group' })])).toContain('未选择审批组');
    expect(validateWorkflowNodes([node({ type: 'group', approvalGroupId: 5 })])).toBeNull();
  });

  it('指定人员节点必须选择具体审批人', () => {
    expect(validateWorkflowNodes([node({ type: 'user' })])).toContain('未选择审批人');
    expect(validateWorkflowNodes([node({ type: 'user', userId: 7 })])).toBeNull();
  });

  it('部门主管 / 申请人节点不需要额外配置', () => {
    expect(validateWorkflowNodes([node({ type: 'department_manager' })])).toBeNull();
    expect(validateWorkflowNodes([node({ type: 'initiator' })])).toBeNull();
  });

  it('条件只填字段不填运算符时拦下（否则条件被后端整条忽略）', () => {
    const result = validateWorkflowNodes([
      node({ roleCode: 'hr', conditionField: 'days' }),
    ]);
    expect(result).toContain('缺少运算符');
  });

  it('运算符有值但比较值为空时拦下（否则 Number("") 让条件恒真）', () => {
    const result = validateWorkflowNodes([
      node({ roleCode: 'hr', conditionField: 'days', conditionOperator: 'gt', conditionValue: '  ' }),
    ]);
    expect(result).toContain('缺少比较值');
  });

  it('条件三项齐全时通过', () => {
    const result = validateWorkflowNodes([
      node({ roleCode: 'hr', conditionField: 'days', conditionOperator: 'gte', conditionValue: '3' }),
    ]);
    expect(result).toBeNull();
  });

  it('提示里带出是第几个节点，便于在长流程里定位', () => {
    const result = validateWorkflowNodes([
      node({ nodeKey: 'a', name: '一级审批', roleCode: 'hr' }),
      node({ nodeKey: 'b', name: '二级审批', type: 'group' }),
    ]);
    expect(result).toContain('第 2 个节点');
    expect(result).toContain('二级审批');
  });
});
