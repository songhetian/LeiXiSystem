import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  Building2,
  CalendarDays,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Clock,
  LayoutDashboard,
  Network,
  Receipt,
  ScanFace,
  Settings2,
  ShieldCheck,
  Tags,
  UserCog,
  Users,
  CalendarHeart,
  ListChecks,
  Coins,
  ChartColumn,
  ShieldAlert,
  Repeat,
} from 'lucide-react';

/** 侧边菜单项：每个页面绑定一个页面级权限码（供 RequirePermission 控制可见性） */
export interface MenuItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** 页面级权限码；用户无此权限时菜单项与对应路由均不可见 */
  permission: string;
  /** 侧栏分组标题；同组项在视觉上聚拢 */
  group: string;
}

/** 受控的页面菜单清单（后续模块在此追加） */
export const MENU_ITEMS: MenuItem[] = [
  { path: '/dashboard', label: '工作台', icon: LayoutDashboard, permission: 'dashboard_view', group: '总览' },
  { path: '/users', label: '用户管理', icon: Users, permission: 'user_view', group: '组织架构' },
  { path: '/departments', label: '部门管理', icon: Network, permission: 'dept_view', group: '组织架构' },
  { path: '/roles', label: '角色权限', icon: ShieldCheck, permission: 'role_view', group: '组织架构' },
  { path: '/role-assign', label: '分配角色', icon: UserCog, permission: 'role_assign', group: '组织架构' },
  { path: '/leaves', label: '请假管理', icon: CalendarDays, permission: 'leave_view', group: '考勤业务' },
  { path: '/reimburses', label: '报销管理', icon: Receipt, permission: 'reimburse_view', group: '考勤业务' },
  { path: '/reimburse-categories', label: '报销类别', icon: Tags, permission: 'reimburse_category_view', group: '考勤业务' },
  { path: '/attendance', label: '考勤打卡', icon: Clock, permission: 'attendance_view', group: '考勤业务' },
  { path: '/overtimes', label: '加班管理', icon: Clock, permission: 'overtime_view', group: '考勤业务' },
  { path: '/makeups', label: '补卡管理', icon: ScanFace, permission: 'makeup_view', group: '考勤业务' },
  { path: '/att-exceptions', label: '考勤异常', icon: ShieldAlert, permission: 'att_exception_view', group: '考勤业务' },
  { path: '/salaries', label: '薪资管理', icon: Banknote, permission: 'salary_view', group: '考勤业务' },
  { path: '/shifts', label: '班次管理', icon: CalendarClock, permission: 'shift_view', group: '考勤业务' },
  { path: '/schedules', label: '排班管理', icon: CalendarRange, permission: 'shift_view', group: '考勤业务' },
  { path: '/my-schedule', label: '我的排班', icon: ClipboardList, permission: 'my_schedule_view', group: '考勤业务' },
  { path: '/schedule-templates', label: '排班模板', icon: Repeat, permission: 'schedule_template_view', group: '考勤业务' },
  { path: '/att-setting', label: '考勤设置', icon: Settings2, permission: 'att_setting_view', group: '考勤业务' },
  { path: '/holidays', label: '节假日', icon: CalendarHeart, permission: 'holiday_view', group: '考勤业务' },
  { path: '/leave-types', label: '请假类型', icon: ListChecks, permission: 'leave_type_view', group: '考勤业务' },
  { path: '/leave-quotas', label: '请假额度', icon: Coins, permission: 'quota_view', group: '考勤业务' },
  { path: '/leave-trend', label: '请假趋势', icon: ChartColumn, permission: 'quota_view', group: '考勤业务' },
];

/** 保持分组顺序的分组键列表 */
export const MENU_GROUPS = ['总览', '组织架构', '考勤业务'] as const;

/** 品牌字标（同组件多处复用的图形） */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1C419E',
      }}
    >
      <svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" fill="none" aria-hidden>
        <path
          d="M13.2 2.5 6 13h4.2L8 22l9.4-12.6h-4.6l1.2-6.9H13.2Z"
          fill="rgba(255,255,255,0.96)"
        />
      </svg>
    </span>
  );
}