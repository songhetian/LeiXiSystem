/**
 * 业务流程编码登记表（ADR-0020）——与后端 `backend/src/approval/workflow-codes.ts` 保持一致。
 *
 * 业务侧发起审批时硬编码 workflowCode，流程设置页新建流程只有使用这些业务编码，
 * 配置才会被对应业务流真正使用；否则会生成无人引用的孤立流程。
 */
export const BUSINESS_WORKFLOWS = [
  { code: 'leave', module: 'attendance', name: '请假审批' },
  { code: 'overtime', module: 'attendance', name: '加班审批' },
  { code: 'punch_makeup', module: 'attendance', name: '补卡审批' },
  { code: 'attendance_appeal', module: 'attendance', name: '考勤申诉审批' },
  { code: 'reimbursement', module: 'reimbursement', name: '报销审批' },
  { code: 'onboarding', module: 'employees', name: '入职审批' },
  { code: 'probation', module: 'employees', name: '转正审批' },
  { code: 'resignation', module: 'employees', name: '离职审批' },
  { code: 'transfer', module: 'employees', name: '调动审批' },
  { code: 'reward_punishment', module: 'employees', name: '奖惩审批' },
  { code: 'cert_request', module: 'employees', name: '证明开具审批' },
  { code: 'procurement', module: 'general', name: '采购审批' },
  { code: 'general', module: 'general', name: '通用审批' },
] as const;

/** 业务分组（模块）中文名，仅用于列表展示与筛选 */
export const BUSINESS_MODULE_LABELS: Record<string, string> = {
  attendance: '考勤',
  reimbursement: '报销',
  employees: '员工事务',
  general: '通用',
};

/** 业务编码 → 分组 module */
export function businessModuleOf(code?: string): string | undefined {
  return BUSINESS_WORKFLOWS.find((w) => w.code === code)?.module;
}

/** 业务编码 → 业务名；非登记编码原样返回 */
export function businessNameOf(code?: string): string {
  if (!code) return '';
  return BUSINESS_WORKFLOWS.find((w) => w.code === code)?.name || code;
}
