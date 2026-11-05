'use client';

import type { ReactNode } from 'react';
import {
  IconDashboard,
  IconCalendar,
  IconUser,
  IconCheckCircle,
  IconIdcard,
  IconSafe,
  IconBook,
  IconFile,
  IconNotification,
  IconSettings,
  IconStar,
  IconTags,
  IconLocation,
  IconCustomerService,
} from '@arco-design/web-react/icon';

/**
 * 全站导航真值源。
 *
 * 此前 AppSider / AppLayout / (dashboard)/layout / PageTabs / AppHeader /
 * CommandPalette 各自维护一份「路径 ↔ 菜单」映射（六份注册表），新增页面要改
 * 六处，漏一处就出现「侧栏有、跳不动」「页签标题是 URL 片段」这类问题。
 * 本文件是唯一的结构化定义，其余外壳组件从这里派生。
 */
export interface NavNode {
  /** 菜单 key：侧栏高亮、折叠态跳转、命令面板 id 都用它 */
  key: string;
  label: string;
  icon?: ReactNode;
  /** 叶子（或无子层的单节点）路径 */
  path?: string;
  /** 访问所需权限点；未声明视为登录即可见 */
  permission?: string;
  /** 侧栏分组名（顶层节点） */
  group?: string;
  /** 命令面板分组名；子树根节点设置后，其所有叶子沿用（默认继承顶层 group） */
  paletteGroup?: string;
  /** 命令面板搜索关键词（额外匹配词，空格分隔） */
  keywords?: string;
  children?: NavNode[];
}

/** 侧栏导航树（顺序即展示顺序） */
export const NAV_TREE: NavNode[] = [
  { key: 'dashboard', label: '工作台', icon: <IconDashboard />, path: '/', group: '常用' },
  { key: 'attendance-my-schedule', label: '我的排班', icon: <IconCalendar />, path: '/attendance/my-schedule', permission: 'attendance:view', group: '常用', keywords: '排班 我的 schedule my' },
  { key: 'broadcasts-public', label: '公告', icon: <IconNotification />, path: '/broadcasts', group: '常用', paletteGroup: '工具', keywords: '公告 发布 通知 broadcast announcement' },
  {
    key: 'employee',
    label: '员工管理',
    icon: <IconUser />,
    permission: 'employee:view',
    group: '人事',
    children: [
      { key: 'employee-list', label: '员工列表', path: '/employees', permission: 'employee:view', keywords: '员工 人员 staff' },
      { key: 'employee-transactions', label: '员工事务', path: '/employees/transactions', permission: 'employee:view', keywords: '入职 离职 调动' },
      // 人员履历数据来自调岗调薪时间线端点（employee-tx GET /timeline），后端要求 transfer:view
      { key: 'employee-timeline', label: '人员履历', path: '/employees/timeline', permission: 'transfer:view', keywords: '履历 入职 离职 调动 晋升' },
      { key: 'employee-change-logs', label: '员工变动流水', path: '/employees/change-logs', permission: 'employee:view', keywords: '变动 流水 日志 change' },
      { key: 'employee-tags', label: '员工标签', path: '/employees/tags', permission: 'employee:view', keywords: '标签 tag' },
    ],
  },
  {
    key: 'attendance',
    label: '考勤管理',
    icon: <IconCalendar />,
    permission: 'attendance:view',
    group: '人事',
    paletteGroup: '考勤',
    children: [
      { key: 'attendance-punch', label: '打卡', path: '/attendance/punch', permission: 'attendance:view', keywords: '签到 打卡 clock' },
      {
        key: 'attendance-shift-schedule',
        label: '班次排班',
        permission: 'attendance:view',
        children: [
          { key: 'attendance-shifts', label: '班次管理', path: '/attendance/shifts', permission: 'attendance:view', keywords: '班次 shift' },
          { key: 'attendance-schedules', label: '排班管理', path: '/attendance/schedules', permission: 'attendance:view', keywords: '排班 schedule' },
        ],
      },
      {
        key: 'attendance-reports',
        label: '考勤报表',
        permission: 'attendance:view',
        children: [
          { key: 'attendance-daily', label: '考勤日报', path: '/attendance/daily', permission: 'attendance:view', keywords: '日报 daily' },
          { key: 'attendance-monthly', label: '考勤月报', path: '/attendance/monthly', permission: 'attendance:view', keywords: '月报 monthly' },
          { key: 'attendance-statistics', label: '考勤统计', path: '/attendance/statistics', permission: 'attendance:view', keywords: '统计 应休 已休 加班 statistics' },
        ],
      },
      {
        key: 'attendance-vacation',
        label: '假期与出勤',
        permission: 'attendance:view',
        children: [
          { key: 'attendance-vacation-balance', label: '休假额度', path: '/attendance/vacation/balance', permission: 'attendance:view', keywords: '休假 额度 年假 balance' },
          { key: 'attendance-vacation-leave', label: '请假记录', path: '/attendance/vacation/leave', permission: 'attendance:view', keywords: '请假 休假 leave' },
          { key: 'attendance-vacation-type-settings', label: '假期设置', path: '/attendance/vacation/settings', permission: 'vacation:manage', keywords: '假期 设置 类型' },
          { key: 'attendance-vacation-overtime', label: '加班记录', path: '/attendance/vacation/overtime', permission: 'attendance:view', keywords: '加班 overtime' },
          { key: 'attendance-vacation-audit', label: '考勤申请审计', path: '/attendance/vacation/audit', permission: 'attendance:view', keywords: '审计 审批 audit' },
          { key: 'attendance-punch-makeup', label: '补卡申请', path: '/attendance/punch-makeup', permission: 'attendance:view', keywords: '补卡 补签 makeup' },
        ],
      },
      { key: 'attendance-devices', label: '打卡设备', path: '/attendance/devices', permission: 'attendance:manage', keywords: '设备 打卡机 device' },
      { key: 'attendance-settings', label: '考勤设置', path: '/attendance/settings', permission: 'attendance:manage', keywords: '考勤 设置 attendance settings' },
      { key: 'attendance-exception-rules', label: '考勤异常', path: '/attendance/exception-rules', permission: 'attendance:exception:view', keywords: '异常 exception' },
      { key: 'attendance-deduction-rules', label: '扣款规则', path: '/attendance/deduction-rules', permission: 'attendance:deduction:view', keywords: '扣款 deduction' },
      // 打卡定位列表端点（GET /attendance-locations）要求 employee:view，写操作才要求 attendance:location:manage
      { key: 'attendance-locations', label: '打卡定位', path: '/attendance/locations', permission: 'employee:view', keywords: '打卡 定位 location' },
    ],
  },
  {
    key: 'approval',
    label: '审批中心',
    icon: <IconCheckCircle />,
    permission: 'approval:todo:view',
    group: '流程',
    paletteGroup: '审批',
    children: [
      { key: 'approval-todo', label: '待办审批', path: '/approval/todo', permission: 'approval:todo:view', keywords: '审批 待办 todo' },
      { key: 'approval-approved', label: '已办审批', path: '/approval/approved', permission: 'approval:todo:view', keywords: '已办 approved' },
      { key: 'approval-submissions', label: '我的申请', path: '/approval/submissions', permission: 'approval:submitted:view', keywords: '申请 submissions' },
      { key: 'approval-settings', label: '流程设置', path: '/approval/settings', permission: 'approval:workflow:manage', keywords: '流程 工作流 workflow' },
      { key: 'approval-approvers', label: '审批人管理', path: '/approval/approvers', permission: 'approval:manage', keywords: '审批人 管理人 approver' },
      { key: 'approval-role-workflow', label: '职责授权', path: '/approval/role-workflow', permission: 'approval:workflow:manage', keywords: '职责 授权 授权角色 role' },
    ],
  },
  {
    key: 'payroll',
    label: '薪资管理',
    icon: <IconIdcard />,
    permission: 'payroll:view',
    group: '薪酬',
    children: [
      { key: 'payroll-runs', label: '算薪批次', path: '/payroll/runs', permission: 'payroll:view', keywords: '算薪 payroll' },
      { key: 'payroll-payslips', label: '工资条管理', path: '/payroll/payslips', permission: 'payroll:view', keywords: '工资条 台账 payslip' },
      { key: 'my-payslips', label: '我的工资条', path: '/payroll/my-payslips', permission: 'payroll:view', keywords: '工资条 payslip' },
    ],
  },
  {
    key: 'reimbursement',
    label: '报销管理',
    icon: <IconSafe />,
    permission: 'reimbursement:view',
    group: '薪酬',
    children: [
      { key: 'my-reimbursement', label: '我的报销', path: '/expense/my', permission: 'reimbursement:view', keywords: '报销 expense' },
      { key: 'expense-approval', label: '报销审批', path: '/expense/approval', permission: 'reimbursement:approve', keywords: '报销审批' },
      { key: 'expense-settings', label: '报销配置', path: '/expense/settings', permission: 'reimbursement:manage', keywords: '报销 配置 标准 settings' },
    ],
  },
  {
    key: 'knowledge',
    label: '知识库',
    icon: <IconBook />,
    permission: 'knowledge:view',
    group: '工具',
    children: [
      { key: 'knowledge', label: '知识列表', path: '/knowledge', permission: 'knowledge:view', keywords: '知识 knowledge' },
      { key: 'knowledge-admin', label: '知识库管理', path: '/knowledge/admin', permission: 'knowledge:manage', keywords: '知识库 管理 admin' },
    ],
  },
  {
    key: 'performance',
    label: '绩效 OKR',
    icon: <IconStar />,
    permission: 'performance:view',
    group: '人事',
    children: [
      { key: 'performance-cycles', label: '绩效管理', path: '/performance/cycles', permission: 'performance:view', keywords: '绩效 performance 周期' },
      { key: 'okr-objectives', label: 'OKR 目标', path: '/okr', permission: 'okr:view', keywords: 'okr 目标' },
    ],
  },
  {
    key: 'finance',
    label: '财务预算',
    icon: <IconSafe />,
    permission: 'finance:budget:view',
    group: '薪酬',
    children: [
      { key: 'finance-budgets', label: '财务预算', path: '/finance/budgets', permission: 'finance:budget:view', keywords: '预算 budget' },
      { key: 'finance-expense-standards', label: '费用标准', path: '/finance/expense-standards', permission: 'finance:expense-standard:view', keywords: '费用 标准 expense' },
    ],
  },
  { key: 'helpdesk', label: '工单客服', icon: <IconCustomerService />, path: '/helpdesk', permission: 'helpdesk:view', group: '工具', keywords: '工单 ticket 客服 helpdesk' },
  { key: 'notifications', label: '我的通知', icon: <IconNotification />, path: '/notifications', group: '工具', keywords: '通知 notification' },
  { key: 'notifications-settings', label: '通知设置', icon: <IconNotification />, path: '/notifications/settings', permission: 'system:notification:settings', group: '设置', keywords: '通知设置 推送 配置 角色 settings' },
  {
    key: 'system',
    label: '系统管理',
    icon: <IconFile />,
    permission: 'system:user:view',
    group: '设置',
    paletteGroup: '系统',
    children: [
      { key: 'system-departments', label: '组织架构', path: '/system/departments', permission: 'department:manage', keywords: '部门 department' },
      { key: 'system-positions', label: '岗位管理', path: '/system/positions', permission: 'position:manage', keywords: '岗位 position' },
      { key: 'system-users', label: '用户管理', path: '/system/users', permission: 'system:user:manage', keywords: '用户 user' },
      { key: 'system-roles', label: '角色权限', path: '/system/roles', permission: 'system:role:manage', keywords: '角色 role' },
      // 权限管理为纯只读页（listPermissions/listRoles 均挂 system:role:view），无写端点
      { key: 'system-permissions', label: '权限管理', path: '/system/permissions', permission: 'system:role:view', keywords: '权限 permission' },
      { key: 'system-broadcasts', label: '公告管理', path: '/system/broadcasts', permission: 'system:broadcast:manage', keywords: '公告 管理 broadcast' },
      { key: 'system-logs', label: '操作日志', path: '/system/logs', permission: 'system:log:view', keywords: '日志 log' },
    ],
  },
  { key: 'settings', label: '系统设置', icon: <IconSettings />, path: '/settings', permission: 'system:setting:view', group: '设置' },
];

/**
 * 隐藏 pseudo 节点：/profile 不在侧栏展示（从右上角头像菜单进入），
 * 但页签标题 / 面包屑仍需要正确文案。
 */
const PROFILE_NODE: NavNode = { key: 'profile', label: '个人资料', path: '/profile' };

// ---------- 派生映射（一次性预计算） ----------

const pathKeyMap = new Map<string, string>(); // path → menu key（叶子）
const pathLabelMap = new Map<string, string>(); // path → 页面标题
const keyNodeMap = new Map<string, NavNode>(); // key → 节点

function collect(nodes: NavNode[]) {
  for (const node of nodes) {
    keyNodeMap.set(node.key, node);
    if (node.path) {
      pathKeyMap.set(node.path, node.key);
      pathLabelMap.set(node.path, node.label);
    }
    if (node.children) collect(node.children);
  }
}
collect(NAV_TREE);
collect([PROFILE_NODE]);

/** 节点及其子树中第一个带 path 的叶子路径（折叠态点父级直跳用） */
function firstPathOf(node: NavNode): string | undefined {
  if (node.path) return node.path;
  for (const child of node.children ?? []) {
    const path = firstPathOf(child);
    if (path) return path;
  }
  return undefined;
}

/** 菜单 key → 跳转路径（枝干节点取其子树第一个叶子） */
export function menuPathFor(key: string): string | undefined {
  const node = keyNodeMap.get(key);
  return node ? firstPathOf(node) : undefined;
}

/** 动态详情路由 → 所属菜单 key（无叶子 path 前缀可兜底时使用） */
const DYNAMIC_MENU_PREFIX: Array<readonly [string, string]> = [
  ['/approval/instances/', 'approval-todo'],
  ['/knowledge/preview/', 'knowledge'],
];

/**
 * path → 所属菜单 key（侧栏高亮）。
 * 顺序：精确命中 → 动态前缀表 → 最长叶子前缀兜底（新详情页自动跟随其列表页）。
 */
export function menuKeyFor(path: string): string | undefined {
  const exact = pathKeyMap.get(path);
  if (exact) return exact;
  for (const [prefix, key] of DYNAMIC_MENU_PREFIX) {
    if (path.startsWith(prefix)) return key;
  }
  let best: { key: string; length: number } | null = null;
  for (const [leaf, key] of pathKeyMap) {
    if (path.startsWith(leaf + '/') && (!best || leaf.length > best.length)) {
      best = { key, length: leaf.length };
    }
  }
  return best?.key;
}

/** 动态详情页的页签标题（顺序匹配，前缀互不重叠） */
const DYNAMIC_TITLE: Array<readonly [RegExp, string]> = [
  [/^\/employees\/[^/]+$/, '员工详情'],
  [/^\/approval\/instances\/[^/]+$/, '审批详情'],
  [/^\/approval\/settings\/[^/]+$/, '流程设置详情'],
  [/^\/knowledge\/preview\/[^/]+$/, '知识预览'],
];

/** path → 页签标题（动态详情页取约定的中文标题，未登记取 URL 末段兜底） */
export function tabTitleFor(path: string): string {
  const label = pathLabelMap.get(path);
  if (label) return label;
  for (const [pattern, title] of DYNAMIC_TITLE) {
    if (pattern.test(path)) return title;
  }
  return path.split('/').filter(Boolean).pop() || '页面';
}

/** path → label 链（根到叶，用于面包屑）；未命中返回 null */
function findLabelChain(nodes: NavNode[], path: string): string[] | null {
  for (const node of nodes) {
    if (node.path && node.path === path) return [node.label];
    if (node.children) {
      const childChain = findLabelChain(node.children, path);
      if (childChain) return [node.label, ...childChain];
    }
  }
  return null;
}

/** key → label 链（根到叶，含自身）；未命中返回 null */
function findKeyChain(nodes: NavNode[], key: string): string[] | null {
  for (const node of nodes) {
    if (node.key === key) return [node.label];
    if (node.children) {
      const childChain = findKeyChain(node.children, key);
      if (childChain) return [node.label, ...childChain];
    }
  }
  return null;
}

/**
 * path → 面包屑 label 链。
 * 动态详情页返回「父级链 + 动态标题」，如 /employees/1 →
 * ['员工管理', '员工列表', '员工详情']。
 */
export function breadcrumbFor(path: string): string[] {
  const chain = findLabelChain(NAV_TREE, path);
  if (chain) return chain;
  if (path === PROFILE_NODE.path) return [PROFILE_NODE.label];
  const title = tabTitleFor(path);
  const parentKey = menuKeyFor(path);
  const parentChain = parentKey ? findKeyChain(NAV_TREE, parentKey) : null;
  if (parentChain && parentChain.length > 0) return [...parentChain, title];
  return [title];
}

// 面包屑第一层（父级分组）的返回路径；默认取该枝干第一个叶子，以下为特例
const BRANCH_RETURN_OVERRIDE: Record<string, string> = {
  考勤管理: '/attendance/daily',
  系统设置: '/settings',
};

/** 面包屑父级 label → 可点击返回的路径；不可点（无对应枝干）返回 undefined */
export function parentReturnFor(label: string): string | undefined {
  const override = BRANCH_RETURN_OVERRIDE[label];
  if (override) return override;
  const branch = NAV_TREE.find((n) => n.label === label && (n.children?.length || n.path));
  return branch ? firstPathOf(branch) : undefined;
}

// ---------- 命令面板命令（由导航树派生 + 权限过滤） ----------

export interface PaletteCommand {
  id: string;
  label: string;
  sublabel?: string;
  path: string;
  icon: ReactNode;
  group: string;
  /** 额外搜索关键词（label/group 之外） */
  keywords?: string;
}

/** 沿树收集叶子，group 依次取：节点自身的 paletteGroup → 自身 group → 祖先分组。
 *  缺了 `node.group` 这一档会导致**顶层叶子节点**（工作台、我的排班…）拿到空字符串，
 *  命令面板第一组的标题就是空白的（只剩一个分组点）。 */
function collectCommands(
  nodes: NavNode[],
  inheritedGroup: string,
  permissions: string[] | undefined,
  out: PaletteCommand[],
) {
  for (const node of nodes) {
    const group = node.paletteGroup ?? node.group ?? inheritedGroup;
    if (node.children) {
      collectCommands(node.children, group, permissions, out);
      continue;
    }
    if (!node.path) continue;
    if (node.permission && permissions && !permissions.includes(node.permission)) continue;
    out.push({
      id: node.key,
      label: node.label,
      path: node.path,
      icon: node.icon ?? <IconFile />,
      group,
      keywords: node.keywords,
    });
  }
}

/**
 * 导航树 → 命令面板条目（全叶子）。
 * permissions 为 undefined 时不做权限过滤（测试/未登录 mock 场景）；
 * 传入数组则按 permission 点过滤。
 */
export function paletteCommandsFor(permissions?: string[]): PaletteCommand[] {
  const out: PaletteCommand[] = [];
  collectCommands(NAV_TREE, '', permissions, out);
  return out;
}

// ---------- 业务域强调色 ----------

/**
 * 业务域 → 强调色。**一色一义**，全站只此一份：
 *
 *   常用 = 蓝（品牌）  人事 = 青  流程 = 紫  薪酬 = 橙  工具 = 靛  设置 = 中性
 *
 * 侧栏分组点、快捷入口图标、命令面板条目图标都从这里取。之所以共用一套而不是
 * 各页面各挑一个好看的颜色：颜色在这里是**分类编码**，用户记住"橙色是钱"之后，
 * 薪资/报销/预算在哪都认得出；九个入口九种色只会变成装饰。
 *
 * fg 取「文字态」（深一档，18px 图标叠在 8% 同色底上可达 4.5:1），
 * bg 是同色低透明度底，不做彩色描边、不做渐变。
 */
export interface DomainTone {
  fg: string;
  bg: string;
}

export const GROUP_TONE: Record<string, DomainTone> = {
  常用: { fg: 'var(--lx-primary)', bg: 'var(--lx-primary-bg)' },
  人事: { fg: 'var(--lx-teal-text)', bg: 'var(--lx-teal-bg)' },
  流程: { fg: 'var(--lx-purple-text)', bg: 'var(--lx-purple-bg)' },
  薪酬: { fg: 'var(--lx-coral-text)', bg: 'var(--lx-coral-bg)' },
  工具: { fg: 'var(--lx-indigo-text)', bg: 'var(--lx-indigo-bg)' },
  设置: { fg: 'var(--lx-neutral-text)', bg: 'var(--lx-neutral-tag-bg)' },
};

/** 未登记的分组一律回落中性，不发明新色相 */
const NEUTRAL_TONE = GROUP_TONE['设置'];

export function toneOfGroup(group?: string): DomainTone {
  return (group && GROUP_TONE[group]) || NEUTRAL_TONE;
}

/** 路径 → 所属顶层分组（叶子继承父级 group），用于按入口路径取域色 */
const PATH_TO_GROUP = new Map<string, string>();
(function indexPathToGroup(nodes: NavNode[], inherited?: string) {
  for (const node of nodes) {
    const group = node.group ?? inherited;
    if (node.path && group && !PATH_TO_GROUP.has(node.path)) PATH_TO_GROUP.set(node.path, group);
    if (node.children) indexPathToGroup(node.children, group);
  }
})(NAV_TREE, undefined);

export function toneOfPath(path?: string): DomainTone {
  return toneOfGroup(path ? PATH_TO_GROUP.get(path) : undefined);
}

/** 导航树关键词（供测试与调用方校验派生完整性） */
export const NAV_KEYWORDS: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  const walk = (nodes: NavNode[]) => {
    for (const node of nodes) {
      if (node.path && node.keywords) map[node.key] = node.keywords;
      if (node.children) walk(node.children);
    }
  };
  walk(NAV_TREE);
  return map;
})();
