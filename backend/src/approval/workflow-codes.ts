/**
 * 业务流程编码登记表（ADR-0020）。
 *
 * 业务侧发起审批时硬编码 workflowCode（见 vacation.service / punch-makeup.service /
 * reimbursement.service / employee-tx.service），流程设置页新建流程只有使用这里的
 * 业务编码，配置才会真正被对应业务流使用。
 *
 * module 为「业务流程分组」，仅用于列表筛选与角色职责授权的兜底匹配。
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

export type BusinessWorkflowCode = (typeof BUSINESS_WORKFLOWS)[number]['code'];

/** 业务流程编码 → 分组 module；非登记编码返回 undefined（不参与职责授权兜底） */
export function businessModuleOf(code: string): string | undefined {
  return BUSINESS_WORKFLOWS.find((w) => w.code === code)?.module;
}

/** 是否为登记在册的业务流程编码 */
export function isBusinessWorkflowCode(code: string): boolean {
  return businessModuleOf(code) !== undefined;
}
