export type ReimbursementStatus =
  | 'draft'
  | 'pending'
  | 'approving'
  | 'approved'
  | 'rejected'
  | 'cancelled';

const validTransitions: Record<ReimbursementStatus, ReimbursementStatus[]> = {
  draft: ['approving', 'cancelled', 'pending'],
  pending: ['approving', 'cancelled', 'draft'],
  approving: ['approved', 'rejected', 'cancelled', 'draft'],
  approved: ['paid' as any, 'cancelled', 'draft'],
  rejected: ['approving'],
  cancelled: ['approving'],
};

const statusLabels: Record<ReimbursementStatus, string> = {
  draft: '草稿',
  pending: '待提交',
  approving: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已取消',
};

export function validateStateTransition(
  currentState: ReimbursementStatus,
  targetState: ReimbursementStatus,
): { valid: boolean; message?: string } {
  if (currentState === targetState) {
    return { valid: true };
  }

  const allowed = validTransitions[currentState];
  if (!allowed) {
    return {
      valid: false,
      message: `未知的当前状态：${currentState}`,
    };
  }

  if (!allowed.includes(targetState)) {
    const currentLabel = statusLabels[currentState] || currentState;
    const targetLabel = statusLabels[targetState] || targetState;
    return {
      valid: false,
      message: `不能从「${currentLabel}」状态直接变为「${targetLabel}」状态`,
    };
  }

  return { valid: true };
}

export function assertValidStateTransition(
  currentState: ReimbursementStatus,
  targetState: ReimbursementStatus,
  errorCode: number = 4000,
): void {
  const result = validateStateTransition(currentState, targetState);
  if (!result.valid) {
    const error = new Error(result.message);
    (error as any).code = errorCode;
    throw error;
  }
}
