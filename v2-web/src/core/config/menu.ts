import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  Network, 
  ShieldCheck, 
  KeyRound, 
  FileText, 
  MessageSquare, 
  Bell, 
  Megaphone, 
  Send, 
  Clock, 
  Calendar, 
  Library, 
  Wallet, 
  PlusCircle, 
  History, 
  UserCog, 
  Settings, 
  Monitor, 
  Search, 
  Shield, 
  LogOut,
  GraduationCap,
  Briefcase
} from 'lucide-react';

export interface MenuItem {
  id: string;
  label: string;
  icon?: any;
  permission?: string;
  admin?: boolean;
  children?: MenuItem[];
}

export const allMenuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: '控制面板',
    icon: LayoutDashboard,
    permission: 'system:dashboard:view',
  },
  {
    id: 'admin-dashboard',
    label: '企业看板',
    icon: BarChart3,
    permission: 'system:dashboard:admin',
  },
  {
    id: 'hr',
    label: '人事管理',
    icon: Users,
    children: [
      {
        id: 'hr-employee',
        label: '员工管理',
        icon: Users,
        permission: 'user:employee:view',
        children: [
          { id: 'user-employee', label: '员工列表', icon: Users, permission: 'user:employee:view' },
          { id: 'user-changes', label: '变动记录', icon: History, permission: 'user:employee:view' },
          { id: 'user-approval', label: '员工审核', icon: ShieldCheck, permission: 'user:audit:manage' },
        ]
      },
      {
        id: 'hr-org',
        label: '组织架构',
        icon: Network,
        permission: 'org:department:view',
        children: [
          { id: 'org-department', label: '部门管理', icon: Network, permission: 'org:department:view' },
          { id: 'org-position', label: '职位管理', icon: Briefcase, permission: 'org:position:view' },
        ]
      }
    ]
  },
  {
    id: 'permission',
    label: '权限管理',
    icon: Shield,
    children: [
      { id: 'user-permission', label: '角色管理', icon: Shield, permission: 'system:role:view' },
      { id: 'user-role-management', label: '角色分配', icon: UserCog, permission: 'system:role:manage' },
      { id: 'user-reset-password', label: '重置密码', icon: KeyRound, permission: 'user:security:reset_password' },
      { id: 'system-logs', label: '操作日志', icon: FileText, permission: 'system:log:view' },
    ]
  },
  {
    id: 'collaboration',
    label: '办公协作',
    icon: MessageSquare,
    children: [
      {
        id: 'information',
        label: '信息发布',
        icon: Megaphone,
        children: [
          { id: 'messaging-broadcast', label: '系统广播', icon: Megaphone, permission: 'messaging:broadcast:view' },
          { id: 'broadcast-management', label: '发布广播', icon: Send, permission: 'messaging:broadcast:manage' },
          { id: 'notification-settings', label: '通知设置', icon: Bell, permission: 'messaging:config:manage' },
        ]
      },
      { id: 'messaging-chat', label: '即时通讯', icon: MessageSquare, permission: 'messaging:chat:use' },
      { id: 'messaging-group-management', label: '群组管理', icon: Users, permission: 'messaging:chat:manage' },
      { id: 'employee-memos', label: '部门备忘录', icon: FileText, permission: 'user:memo:manage' },
    ]
  },
  {
    id: 'attendance',
    label: '考勤管理',
    icon: Clock,
    permission: 'attendance:record:view',
    children: [
      { id: 'attendance-home', label: '考勤自助中心', icon: Users, permission: 'attendance:record:view' },
      { id: 'attendance-dept-stats', label: '部门考勤报表', icon: BarChart3, permission: 'attendance:record:view' },
      { id: 'attendance-shift', label: '班次管理', icon: Clock, permission: 'attendance:config:manage' },
      { id: 'attendance-schedule', label: '智能调度中心', icon: Calendar, permission: 'attendance:schedule:manage' },
      { id: 'attendance-approval', label: '考勤审计配置', icon: Shield, permission: 'attendance:approval:manage' },
    ],
  },
  {
    id: 'knowledge',
    label: '知识中枢',
    icon: Library,
    children: [
      { id: 'knowledge-articles', label: '公共知识库', icon: Library, permission: 'knowledge:article:view' },
      { id: 'knowledge-base', label: '知识库管理', icon: Settings, permission: 'knowledge:article:manage' },
      { id: 'my-knowledge', label: '我的知识库', icon: Briefcase },
    ]
  },
  {
    id: 'vacation',
    label: '假期管理',
    icon: Calendar,
    permission: 'vacation:record:view',
    children: [
      { id: 'vacation-details', label: '假期自助中心', icon: Users, permission: 'vacation:record:view' },
      { id: 'compensatory-approval', label: '假期审计管理', icon: Shield, permission: 'vacation:approval:manage' },
    ],
  },
  {
    id: 'finance',
    label: '财务管理',
    icon: Wallet,
    permission: 'reimbursement:record:view',
    children: [
      {
        id: 'finance-reimbursement',
        label: '报销管理',
        icon: Wallet,
        children: [
            { id: 'reimbursement-apply', label: '新建报销', icon: PlusCircle, permission: 'reimbursement:apply:submit' },
            { id: 'reimbursement-list', label: '我的报销', icon: FileText, permission: 'reimbursement:record:view' },
            { id: 'reimbursement-approval', label: '报销审批', icon: ShieldCheck, permission: 'reimbursement:apply:approve' },
            { id: 'approver-management', label: '审批人管理', icon: Users, permission: 'reimbursement:config:settings' },
            { id: 'reimbursement-settings', label: '报销配置', icon: Settings, permission: 'reimbursement:config:settings' },
        ]
      },
      {
        id: 'finance-payroll',
        label: '薪资管理',
        icon: Wallet,
        permission: 'payroll:payslip:manage',
        children: [
            { id: 'payslip-management', label: '工资条管理', icon: FileText, permission: 'payroll:payslip:manage' },
        ]
      },
      {
        id: 'finance-config',
        label: '审批架构',
        icon: Shield,
        permission: 'system:workflow:manage',
        children: [
            { id: 'system-workflow', label: '资产流程定义', icon: Monitor },
            { id: 'approval-workflow-config', label: '报销流程定义', icon: Settings },
            { id: 'role-workflow-config', label: '审批职责授权', icon: UserCog },
        ]
      }
    ]
  },
  {
    id: 'logistics',
    label: '后勤管理',
    icon: Monitor,
    permission: 'finance:asset:view',
    children: [
      {
        id: 'logistics-devices',
        label: '设备管理',
        icon: Monitor,
        children: [
            { id: 'logistics-device-mgmt', label: '设备管理', icon: Monitor, permission: 'finance:asset:manage' },
            { id: 'logistics-device-list', label: '实机明细', icon: Search, permission: 'finance:asset:manage' },
            { id: 'asset-request-audit', label: '申请审批', icon: ShieldCheck, permission: 'finance:asset:audit' },
            { id: 'inventory-management', label: '库存管理', icon: Briefcase, permission: 'finance:procurement:manage' },
        ]
      }
    ]
  },
  {
    id: 'personal',
    label: '个人中心',
    icon: Users,
    children: [
      {
        id: 'personal-info-section',
        label: '个人信息',
        icon: UserCog,
        children: [
          { id: 'personal-info', label: '个人信息', icon: UserCog },
        ]
      },
      {
        id: 'personal-office',
        label: '个人办公',
        icon: Briefcase,
        children: [
          { id: 'my-todo', label: '待办中心', icon: ShieldCheck },
          { id: 'my-schedule', label: '我的排班', icon: Calendar },
          { id: 'my-notifications', label: '我的通知', icon: Bell },
          { id: 'my-payslips', label: '我的薪资', icon: Wallet, permission: 'payroll:payslip:view' },
          { id: 'my-assets', label: '个人资产', icon: Monitor, permission: 'personal:asset:view' },
          { id: 'my-memos', label: '我的备忘录', icon: FileText },
        ]
      },
    ],
  },
];
