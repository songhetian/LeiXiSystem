import {
  validateStateTransition,
  assertValidStateTransition,
  ReimbursementStatus,
} from './reimbursement-state-machine';

describe('ReimbursementStateMachine', () => {
  describe('validateStateTransition', () => {
    describe('合法流转', () => {
      const validCases: Array<{ from: ReimbursementStatus; to: ReimbursementStatus; desc: string }> = [
        { from: 'draft', to: 'approving', desc: 'draft → approving（提交审批）' },
        { from: 'draft', to: 'cancelled', desc: 'draft → cancelled（取消）' },
        { from: 'draft', to: 'pending', desc: 'draft → pending' },
        { from: 'pending', to: 'approving', desc: 'pending → approving（提交审批）' },
        { from: 'pending', to: 'cancelled', desc: 'pending → cancelled（取消）' },
        { from: 'pending', to: 'draft', desc: 'pending → draft' },
        { from: 'approving', to: 'approved', desc: 'approving → approved（审批通过）' },
        { from: 'approving', to: 'rejected', desc: 'approving → rejected（审批驳回）' },
        { from: 'approving', to: 'cancelled', desc: 'approving → cancelled（撤回/作废）' },
        { from: 'approving', to: 'draft', desc: 'approving → draft（撤回）' },
        { from: 'approved', to: 'cancelled', desc: 'approved → cancelled（已通过的撤回/作废）' },
        { from: 'approved', to: 'draft', desc: 'approved → draft（已通过的撤回）' },
        { from: 'rejected', to: 'approving', desc: 'rejected → approving（重新提交）' },
        { from: 'cancelled', to: 'approving', desc: 'cancelled → approving（重新提交）' },
      ];

      it.each(validCases)('$desc', ({ from, to }) => {
        const result = validateStateTransition(from, to);
        expect(result.valid).toBe(true);
      });
    });

    describe('幂等性：同一状态允许', () => {
      const statuses: ReimbursementStatus[] = [
        'draft',
        'pending',
        'approving',
        'approved',
        'rejected',
        'cancelled',
      ];

      it.each(statuses)('%s → %s 允许（幂等）', (status) => {
        const result = validateStateTransition(status, status);
        expect(result.valid).toBe(true);
      });
    });

    describe('非法流转', () => {
      const invalidCases: Array<{ from: ReimbursementStatus; to: ReimbursementStatus; desc: string }> = [
        { from: 'draft', to: 'approved', desc: 'draft → approved（跳过审批）' },
        { from: 'draft', to: 'rejected', desc: 'draft → rejected（未提交就驳回）' },
        { from: 'pending', to: 'approved', desc: 'pending → approved（跳过审批）' },
        { from: 'pending', to: 'rejected', desc: 'pending → rejected（未提交就驳回）' },
        { from: 'approving', to: 'pending', desc: 'approving → pending' },
        { from: 'approved', to: 'rejected', desc: 'approved → rejected（已通过再驳回）' },
        { from: 'approved', to: 'approving', desc: 'approved → approving（回流）' },
        { from: 'rejected', to: 'draft', desc: 'rejected → draft' },
        { from: 'rejected', to: 'pending', desc: 'rejected → pending' },
        { from: 'rejected', to: 'approved', desc: 'rejected → approved（跳过审批）' },
        { from: 'rejected', to: 'cancelled', desc: 'rejected → cancelled' },
        { from: 'cancelled', to: 'draft', desc: 'cancelled → draft' },
        { from: 'cancelled', to: 'pending', desc: 'cancelled → pending' },
        { from: 'cancelled', to: 'approved', desc: 'cancelled → approved（跳过审批）' },
        { from: 'cancelled', to: 'rejected', desc: 'cancelled → rejected' },
      ];

      it.each(invalidCases)('$desc', ({ from, to }) => {
        const result = validateStateTransition(from, to);
        expect(result.valid).toBe(false);
        expect(result.message).toBeDefined();
        expect(result.message).toContain('不能从');
      });
    });

    describe('错误消息', () => {
      it('应包含当前状态和目标状态的中文描述', () => {
        const result = validateStateTransition('draft', 'paid' as any);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('草稿');
      });
    });
  });

  describe('assertValidStateTransition', () => {
    it('合法流转不抛出异常', () => {
      expect(() => {
        assertValidStateTransition('draft', 'approving');
      }).not.toThrow();
    });

    it('非法流转抛出异常，包含错误消息和错误码', () => {
      try {
        assertValidStateTransition('draft', 'approved', 4000);
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e.message).toBeDefined();
        expect(e.code).toBe(4000);
      }
    });

    it('默认错误码为 4000', () => {
      try {
        assertValidStateTransition('draft', 'approved');
        fail('应该抛出异常');
      } catch (e: any) {
        expect(e.code).toBe(4000);
      }
    });

    it('同一状态（幂等）不抛出异常', () => {
      expect(() => {
        assertValidStateTransition('approving', 'approving');
      }).not.toThrow();
    });
  });
});
