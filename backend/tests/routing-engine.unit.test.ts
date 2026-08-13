// S09 · 审批路由引擎 unit test（TDD RED 先行）
import { describe, it, expect } from '@jest/globals';
import {
  resolveNextApprovers,
  buildApprovalChain,
  type WorkflowNode,
  type ApproverCandidate,
  type RoutingContext,
} from '../src/approval/engine/routing-engine';

describe('S09 · 审批路由引擎（纯函数）', () => {
  const nodes: WorkflowNode[] = [
    {
      id: 'n1',
      name: '部门主管审批',
      type: 'role',
      roleCode: 'dept_manager',
      order: 1,
    },
    {
      id: 'n2',
      name: 'HR审批',
      type: 'role',
      roleCode: 'hr',
      order: 2,
    },
    {
      id: 'n3',
      name: '总经理审批',
      type: 'role',
      roleCode: 'gm',
      order: 3,
      condition: { field: 'amount', operator: 'gt', value: 5000 },
    },
  ];

  const ctx: RoutingContext = {
    applicantDepartmentId: 1,
    applicantRoleCodes: ['staff'],
    formData: { amount: 1000, days: 1 },
  };

  describe('resolveNextApprovers（当前节点解析下一审批人）', () => {
    it('应该解析角色类型节点的审批人', () => {
      const result = resolveNextApprovers(nodes[0], ctx);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('role');
      expect(result!.roleCode).toBe('dept_manager');
    });

    it('条件不满足时应跳过该节点', () => {
      const result = resolveNextApprovers(nodes[2], ctx);
      expect(result).toBeNull();
    });

    it('条件满足时应返回审批人', () => {
      const richCtx = { ...ctx, formData: { amount: 8000, days: 5 } };
      const result = resolveNextApprovers(nodes[2], richCtx);
      expect(result).not.toBeNull();
      expect(result?.roleCode).toBe('gm');
    });
  });

  describe('buildApprovalChain（构建完整审批链）', () => {
    it('应按顺序构建审批链，跳过不满足条件的节点', () => {
      const chain = buildApprovalChain(nodes, ctx);
      expect(chain.length).toBe(2);
      expect(chain[0].nodeId).toBe('n1');
      expect(chain[1].nodeId).toBe('n2');
    });

    it('金额大于5000时应包含总经理审批', () => {
      const richCtx = { ...ctx, formData: { amount: 8000, days: 5 } };
      const chain = buildApprovalChain(nodes, richCtx);
      expect(chain.length).toBe(3);
      expect(chain[2].nodeId).toBe('n3');
      expect(chain[2].nodeName).toBe('总经理审批');
    });

    it('空节点列表应返回空链', () => {
      const chain = buildApprovalChain([], ctx);
      expect(chain.length).toBe(0);
    });
  });

  describe('条件运算符支持', () => {
    const baseNode: WorkflowNode = {
      id: 'test',
      name: '测试',
      type: 'role',
      roleCode: 'test',
      order: 1,
    };

    it('gt 运算符：大于', () => {
      const node: WorkflowNode = { ...baseNode, condition: { field: 'days', operator: 'gt', value: 3 } };
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 5 } })).not.toBeNull();
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 3 } })).toBeNull();
    });

    it('gte 运算符：大于等于', () => {
      const node: WorkflowNode = { ...baseNode, condition: { field: 'days', operator: 'gte', value: 3 } };
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 3 } })).not.toBeNull();
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 2 } })).toBeNull();
    });

    it('lt 运算符：小于', () => {
      const node: WorkflowNode = { ...baseNode, condition: { field: 'days', operator: 'lt', value: 3 } };
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 2 } })).not.toBeNull();
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 3 } })).toBeNull();
    });

    it('lte 运算符：小于等于', () => {
      const node: WorkflowNode = { ...baseNode, condition: { field: 'days', operator: 'lte', value: 3 } };
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 3 } })).not.toBeNull();
      expect(resolveNextApprovers(node, { ...ctx, formData: { days: 4 } })).toBeNull();
    });

    it('eq 运算符：等于', () => {
      const node: WorkflowNode = { ...baseNode, condition: { field: 'type', operator: 'eq', value: 'sick' } };
      expect(resolveNextApprovers(node, { ...ctx, formData: { type: 'sick' } })).not.toBeNull();
      expect(resolveNextApprovers(node, { ...ctx, formData: { type: 'annual' } })).toBeNull();
    });

    it('无条件的节点始终通过', () => {
      const node: WorkflowNode = { ...baseNode };
      expect(resolveNextApprovers(node, ctx)).not.toBeNull();
    });
  });
});
