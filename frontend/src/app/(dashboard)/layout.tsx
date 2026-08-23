'use client';

import { usePathname } from 'next/navigation';
import AppLayout from '@/components/AppLayout';

const PATH_TO_MENU: Record<string, string> = {
  '/': 'dashboard',
  '/employees': 'employee-list',
  '/employees/transactions': 'employee-transactions',
  '/employees/tags': 'employee-tags',
  '/employees/timeline': 'employee-timeline',
  '/attendance/punch': 'attendance-punch',
  '/attendance/shifts': 'attendance-shifts',
  '/attendance/schedules': 'attendance-schedules',
  '/attendance/my-schedule': 'attendance-my-schedule',
  '/attendance/daily': 'attendance-daily',
  '/attendance/monthly': 'attendance-monthly',
  '/attendance/vacation/balance': 'attendance-vacation-balance',
  '/attendance/vacation/leave': 'attendance-vacation-leave',
  '/attendance/vacation/overtime': 'attendance-vacation-overtime',
  '/attendance/punch-makeup': 'attendance-punch-makeup',
  '/attendance/devices': 'attendance-devices',
  '/attendance/settings': 'attendance-settings',
  '/attendance/exception-rules': 'attendance-exception-rules',
  '/attendance/deduction-rules': 'attendance-deduction-rules',
  '/attendance/locations': 'attendance-locations',
  '/approval/todo': 'approval-todo',
  '/approval/approved': 'approval-approved',
  '/approval/submissions': 'approval-submissions',
  '/approval/settings': 'approval-settings',
  '/payroll/runs': 'payroll-runs',
  '/payroll/my-payslips': 'my-payslips',
  '/expense/my': 'my-reimbursement',
  '/expense/approval': 'expense-approval',
  '/knowledge': 'knowledge',
  '/knowledge/admin': 'knowledge-admin',
  '/performance/cycles': 'performance-cycles',
  '/okr': 'okr-objectives',
  '/finance/budgets': 'finance-budgets',
  '/finance/expense-standards': 'finance-expense-standards',
  '/helpdesk': 'helpdesk',
  '/notifications': 'notifications',
  '/system/departments': 'system-departments',
  '/system/broadcasts': 'system-broadcasts',
  '/system/users': 'system-users',
  '/system/roles': 'system-roles',
  '/system/logs': 'system-logs',
  '/settings': 'settings',
  '/profile': 'profile',
};

const PATH_TO_TITLE: Record<string, string> = {
  '/': '工作台',
  '/employees': '员工列表',
  '/employees/transactions': '员工事务',
  '/employees/tags': '员工标签',
  '/employees/timeline': '人员履历',
  '/attendance/punch': '打卡',
  '/attendance/shifts': '班次管理',
  '/attendance/schedules': '排班管理',
  '/attendance/my-schedule': '我的排班',
  '/attendance/daily': '考勤日报',
  '/attendance/monthly': '考勤月报',
  '/attendance/vacation/balance': '休假额度',
  '/attendance/vacation/leave': '请假记录',
  '/attendance/vacation/overtime': '加班记录',
  '/attendance/punch-makeup': '补卡申请',
  '/attendance/devices': '打卡设备',
  '/attendance/settings': '考勤设置',
  '/attendance/exception-rules': '考勤异常',
  '/attendance/deduction-rules': '扣款规则',
  '/attendance/locations': '打卡定位',
  '/approval/todo': '待办审批',
  '/approval/approved': '已办审批',
  '/approval/submissions': '我的申请',
  '/approval/settings': '流程设置',
  '/payroll/runs': '算薪批次',
  '/payroll/my-payslips': '我的工资条',
  '/expense/my': '我的报销',
  '/expense/approval': '报销审批',
  '/knowledge': '知识库',
  '/knowledge/admin': '知识库管理',
  '/performance/cycles': '绩效管理',
  '/okr': 'OKR 目标',
  '/finance/budgets': '财务预算',
  '/finance/expense-standards': '费用标准',
  '/helpdesk': '工单客服',
  '/notifications': '我的通知',
  '/system/departments': '组织架构',
  '/system/broadcasts': '公告管理',
  '/system/users': '用户管理',
  '/system/roles': '角色权限',
  '/system/logs': '操作日志',
  '/settings': '系统设置',
  '/profile': '个人中心',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeMenu = PATH_TO_MENU[pathname] || 'dashboard';
  const title = PATH_TO_TITLE[pathname] || '';

  return (
    <AppLayout title={title} activeMenu={activeMenu}>
      {children}
    </AppLayout>
  );
}
