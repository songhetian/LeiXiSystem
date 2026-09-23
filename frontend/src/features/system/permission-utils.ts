import { SysPermission } from '@/services/system';

/** 按模块分组权限点，返回 module -> 权限数组 */
export function groupPermissionsByModule(permissions: SysPermission[]): Record<string, SysPermission[]> {
  return permissions.reduce<Record<string, SysPermission[]>>((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});
}

/** 权限模块英文键 -> 中文展示名（权限点 name 已是中文，仅模块分组键为英文） */
export const MODULE_LABELS: Record<string, string> = {
  employee: '人事管理',
  attendance: '考勤管理',
  vacation: '假期管理',
  performance: '绩效管理',
  finance: '财务管理',
  helpdesk: '工单客服',
  approval: '审批中心',
  payroll: '薪酬管理',
  reimbursement: '报销管理',
  knowledge: '知识库',
  system: '系统管理',
  reports: '业务报表',
  personal: '个人中心',
};

/** 模块名中文化：已知模块映射为中文名，未知则回退原值 */
export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] || module;
}