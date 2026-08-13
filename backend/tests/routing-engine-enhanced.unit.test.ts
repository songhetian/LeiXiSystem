// S09 · 审批路由引擎增强：审批组 + 会签/或签 单元测试（TDD RED 先行）
import { describe, it, expect } from '@jest/globals';
import { buildApprovalChain, resolveApproverList, type WorkflowNode, type Approver } from '../src/approval/engine/routing-engine';

describe('S09 · 审批路由引擎增强（审批组 + 会签/或签）', () => {
  describe('审批组', () => {
    it('group 类型节点 → 从审批组取所有成员作为审批人', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        { id: 2, nodeKey: 'n1', name: '财务组审批', type: 'group', approvalGroupId: 101, order: 1, signType: 'any' },
      ];
      const groups: Record<number, number[]> = {
        101: [10, 11, 12],
      };
      const approvers = resolveApproverList(nodes, 'n1', { groups });
      expect(approvers).toHaveLength(3);
      expect(approvers.map(a => a.userId)).toEqual([10, 11, 12]);
    });

    it('审批组为空 → 返回空数组', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        { id: 2, nodeKey: 'n1', name: '空组审批', type: 'group', approvalGroupId: 999, order: 1, signType: 'any' },
      ];
      const groups: Record<number, number[]> = { 999: [] };
      const approvers = resolveApproverList(nodes, 'n1', { groups });
      expect(approvers).toHaveLength(0);
    });
  });

  describe('会签（signType = all）', () => {
    it('会签节点：所有人都需要审批 → 返回全部审批人', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        { id: 2, nodeKey: 'n1', name: '会签节点', type: 'role', roleCode: 'manager', order: 1, signType: 'all' },
      ];
      const approvers = resolveApproverList(nodes, 'n1', {
        roleUsers: { manager: [20, 21, 22] },
      });
      expect(approvers).toHaveLength(3);
      expect(approvers.every(a => a.required === true)).toBe(true);
    });

    it('会签 + 审批组 → 组内全部成员都要审批', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        { id: 2, nodeKey: 'n1', name: '组内会签', type: 'group', approvalGroupId: 201, order: 1, signType: 'all' },
      ];
      const groups: Record<number, number[]> = { 201: [30, 31] };
      const approvers = resolveApproverList(nodes, 'n1', { groups });
      expect(approvers).toHaveLength(2);
      expect(approvers.every(a => a.required === true)).toBe(true);
    });
  });

  describe('或签（signType = any）', () => {
    it('或签节点：任一审批人通过即可 → 返回审批人列表，required=false', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        { id: 2, nodeKey: 'n1', name: '或签节点', type: 'role', roleCode: 'hr', order: 1, signType: 'any' },
      ];
      const approvers = resolveApproverList(nodes, 'n1', {
        roleUsers: { hr: [40, 41] },
      });
      expect(approvers.length).toBeGreaterThanOrEqual(1);
      expect(approvers.every(a => a.required === false)).toBe(true);
    });

    it('默认 signType 为 or（兼容旧数据）', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        { id: 2, nodeKey: 'n1', name: '普通节点', type: 'role', roleCode: 'manager', order: 1 },
      ];
      const approvers = resolveApproverList(nodes, 'n1', {
        roleUsers: { manager: [50] },
      });
      expect(approvers).toHaveLength(1);
      expect(approvers[0].required).toBe(true);
    });
  });

  describe('buildApprovalChain 完整链路', () => {
    it('多级审批：或签 + 会签组合', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        { id: 2, nodeKey: 'n1', name: '主管或签', type: 'role', roleCode: 'manager', order: 1, signType: 'any' },
        { id: 3, nodeKey: 'n2', name: '财务会签', type: 'group', approvalGroupId: 301, order: 2, signType: 'all' },
        { id: 4, nodeKey: 'end', name: '结束', type: 'end', order: 3 },
      ];
      const chain = buildApprovalChain(nodes, {
        roleUsers: { manager: [60, 61] },
        groups: { 301: [70, 71, 72] },
      });
      expect(chain).toHaveLength(2);
      expect(chain[0].nodeKey).toBe('n1');
      expect(chain[0].approvers!.length).toBeGreaterThanOrEqual(1);
      expect(chain[0].signType).toBe('any');
      expect(chain[1].nodeKey).toBe('n2');
      expect(chain[1].approvers!).toHaveLength(3);
      expect(chain[1].signType).toBe('all');
    });

    it('条件节点：金额条件判断正确', () => {
      const nodes: WorkflowNode[] = [
        { id: 1, nodeKey: 'start', name: '发起', type: 'start', order: 0 },
        {
          id: 2, nodeKey: 'n1', name: '大额审批', type: 'role', roleCode: 'director',
          order: 1, signType: 'any',
          conditionField: 'amount', conditionOperator: 'gt', conditionValue: '1000',
        },
        { id: 3, nodeKey: 'n2', name: '普通审批', type: 'role', roleCode: 'manager', order: 2, signType: 'any' },
      ];
      const chainLarge = buildApprovalChain(nodes, {
        roleUsers: { director: [80], manager: [81] },
        formData: { amount: 2000 },
      });
      expect(chainLarge).toHaveLength(2);
      expect(chainLarge[0].nodeKey).toBe('n1');
      expect(chainLarge[1].nodeKey).toBe('n2');

      const chainSmall = buildApprovalChain(nodes, {
        roleUsers: { director: [80], manager: [81] },
        formData: { amount: 500 },
      });
      expect(chainSmall).toHaveLength(1);
      expect(chainSmall[0].nodeKey).toBe('n2');
    });
  });
});
