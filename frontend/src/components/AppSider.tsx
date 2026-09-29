'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@arco-design/web-react';
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
  IconPoweroff,
  IconDown,
  IconStar,
  IconTags,
  IconCommand,
  IconLocation,
  IconCustomerService,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '@/store/auth';
import { useSystemInfo } from '@/hooks/use-system-info';

export interface MenuItemConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: MenuItemConfig[];
  permission?: string;
  group?: string;
}

const defaultMenuItems: MenuItemConfig[] = [
  { key: 'dashboard', label: '工作台', icon: <IconDashboard />, path: '/', group: '常用' },
  { key: 'attendance-my-schedule', label: '我的排班', icon: <IconCalendar />, path: '/attendance/my-schedule', permission: 'attendance:view', group: '常用' },
  { key: 'broadcasts-public', label: '公告', icon: <IconNotification />, path: '/broadcasts', group: '常用' },
  {
    key: 'employee',
    label: '员工管理',
    icon: <IconUser />,
    permission: 'employee:view',
    group: '人事',
    children: [
      { key: 'employee-list', label: '员工列表', permission: 'employee:view' },
      { key: 'employee-transactions', label: '员工事务', permission: 'employee:view' },
      { key: 'employee-timeline', label: '人员履历', permission: 'employee:view' },
      { key: 'employee-change-logs', label: '员工变动流水', permission: 'employee:view' },
      { key: 'employee-tags', label: '员工标签', permission: 'employee:view' },
    ],
  },
  {
    key: 'attendance',
    label: '考勤管理',
    icon: <IconCalendar />,
    permission: 'attendance:view',
    group: '人事',
    children: [
      { key: 'attendance-punch', label: '打卡', permission: 'attendance:view' },
      {
        key: 'attendance-shift-schedule',
        label: '班次排班',
        permission: 'attendance:view',
        children: [
          { key: 'attendance-shifts', label: '班次管理', permission: 'attendance:view' },
          { key: 'attendance-schedules', label: '排班管理', permission: 'attendance:view' },
        ],
      },
      {
        key: 'attendance-reports',
        label: '考勤报表',
        permission: 'attendance:view',
        children: [
          { key: 'attendance-daily', label: '考勤日报', permission: 'attendance:view' },
          { key: 'attendance-monthly', label: '考勤月报', permission: 'attendance:view' },
          { key: 'attendance-statistics', label: '考勤统计', permission: 'attendance:view' },
        ],
      },
      {
        key: 'attendance-vacation',
        label: '假期与出勤',
        permission: 'attendance:view',
        children: [
          { key: 'attendance-vacation-balance', label: '休假额度', permission: 'attendance:view' },
          { key: 'attendance-vacation-leave', label: '请假记录', permission: 'attendance:view' },
          { key: 'attendance-vacation-type-settings', label: '假期设置', permission: 'vacation:manage' },
          { key: 'attendance-vacation-overtime', label: '加班记录', permission: 'attendance:view' },
          { key: 'attendance-vacation-audit', label: '考勤申请审计', permission: 'attendance:view' },
          { key: 'attendance-punch-makeup', label: '补卡申请', permission: 'attendance:view' },
        ],
      },
      { key: 'attendance-devices', label: '打卡设备', permission: 'attendance:manage' },
      { key: 'attendance-settings', label: '考勤设置', permission: 'attendance:manage' },
      { key: 'attendance-exception-rules', label: '考勤异常', permission: 'attendance:exception:view' },
      { key: 'attendance-deduction-rules', label: '扣款规则', permission: 'attendance:deduction:view' },
      { key: 'attendance-locations', label: '打卡定位', permission: 'attendance:view' },
    ],
  },
  {
    key: 'approval',
    label: '审批中心',
    icon: <IconCheckCircle />,
    permission: 'approval:todo:view',
    group: '流程',
    children: [
      { key: 'approval-todo', label: '待办审批', permission: 'approval:todo:view' },
      { key: 'approval-approved', label: '已办审批', permission: 'approval:todo:view' },
      { key: 'approval-submissions', label: '我的申请', permission: 'approval:submitted:view' },
      { key: 'approval-settings', label: '流程设置', permission: 'approval:workflow:manage' },
      { key: 'approval-approvers', label: '审批人管理', permission: 'approval:manage' },
      { key: 'approval-role-workflow', label: '职责授权', permission: 'approval:workflow:manage' },
    ],
  },
  {
    key: 'payroll',
    label: '薪资管理',
    icon: <IconIdcard />,
    permission: 'payroll:view',
    group: '薪酬',
    children: [
      { key: 'payroll-runs', label: '算薪批次', permission: 'payroll:view' },
      { key: 'my-payslips', label: '我的工资条', permission: 'payroll:view' },
    ],
  },
  {
    key: 'reimbursement',
    label: '报销管理',
    icon: <IconSafe />,
    permission: 'reimbursement:view',
    group: '薪酬',
    children: [
      { key: 'my-reimbursement', label: '我的报销', permission: 'reimbursement:view' },
      { key: 'expense-approval', label: '报销审批', permission: 'reimbursement:approve' },
      { key: 'expense-settings', label: '报销配置', permission: 'reimbursement:manage' },
    ],
  },
  {
    key: 'knowledge',
    label: '知识库',
    icon: <IconBook />,
    permission: 'knowledge:view',
    group: '工具',
    children: [
      { key: 'knowledge', label: '知识列表', permission: 'knowledge:view' },
      { key: 'knowledge-admin', label: '知识库管理', permission: 'knowledge:manage' },
    ],
  },
  {
    key: 'performance',
    label: '绩效 OKR',
    icon: <IconStar />,
    permission: 'performance:view',
    group: '人事',
    children: [
      { key: 'performance-cycles', label: '绩效管理', permission: 'performance:view' },
      { key: 'okr-objectives', label: 'OKR 目标', permission: 'okr:view' },
    ],
  },
  {
    key: 'finance',
    label: '财务预算',
    icon: <IconSafe />,
    permission: 'finance:budget:view',
    group: '薪酬',
    children: [
      { key: 'finance-budgets', label: '财务预算', permission: 'finance:budget:view' },
      { key: 'finance-expense-standards', label: '费用标准', permission: 'finance:expense-standard:view' },
    ],
  },
  { key: 'helpdesk', label: '工单客服', icon: <IconCustomerService />, path: '/helpdesk', permission: 'helpdesk:view', group: '工具' },
  { key: 'notifications', label: '我的通知', icon: <IconNotification />, path: '/notifications', group: '工具' },
  { key: 'notifications-settings', label: '通知设置', icon: <IconNotification />, path: '/notifications/settings', permission: 'system:notification:settings', group: '设置' },
  {
    key: 'system',
    label: '系统管理',
    icon: <IconFile />,
    permission: 'system:user:view',
    group: '设置',
    children: [
      { key: 'system-departments', label: '组织架构', permission: 'department:manage' },
      { key: 'system-positions', label: '岗位管理', permission: 'position:manage' },
      { key: 'system-users', label: '用户管理', permission: 'system:user:manage' },
      { key: 'system-roles', label: '角色权限', permission: 'system:role:manage' },
      { key: 'system-permissions', label: '权限管理', permission: 'system:role:manage' },
      { key: 'system-broadcasts', label: '公告管理', permission: 'system:broadcast:manage' },
      { key: 'system-logs', label: '操作日志', permission: 'system:log:view' },
    ],
  },
  {
    key: 'settings',
    label: '系统设置',
    icon: <IconSettings />,
    path: '/settings',
    permission: 'system:setting:view',
    group: '设置',
  },
];

/* 每个菜单分组的专属主题色（CSS 变量，与全局 Token 一致） */
const GROUP_ACCENT: Record<string, string> = {
  常用: 'var(--lx-primary)',
  人事: 'var(--lx-teal)',
  流程: 'var(--lx-purple)',
  薪酬: 'var(--lx-warning)',
  工具: 'var(--lx-indigo)',
  设置: 'var(--lx-pink)',
};

export interface AppSiderProps {
  activeKey?: string;
  onMenuClick?: (key: string) => void;
  menuItems?: MenuItemConfig[];
  permissions?: string[];
  isMobile?: boolean;
  visible?: boolean;
  onClose?: () => void;
  /** 桌面端折叠为图标窄栏 */
  collapsed?: boolean;
}

function filterMenuItems(items: MenuItemConfig[], permissions?: string[]): MenuItemConfig[] {
  if (!permissions) return items;
  const result: MenuItemConfig[] = [];
  for (const item of items) {
    if (item.permission && !permissions.includes(item.permission)) continue;
    const children = item.children ? filterMenuItems(item.children, permissions) : undefined;
    if (item.children) {
      if (children && children.length > 0) result.push({ ...item, children });
      continue;
    }
    result.push(item);
  }
  return result;
}

/**
 * 找出 activeKey 的所有祖先菜单 key；未命中返回 null。
 *
 * 注意返回类型必须含 null：两个调用方都按 `?? []` 处理「未命中」，
 * 此前签名写成 `string[]` 再 `return null as any`，等于把「未命中」这条路藏起来。
 */
function findAncestorKeys(items: MenuItemConfig[], activeKey: string): string[] | null {
  for (const item of items) {
    if (item.key === activeKey) return [];
    if (item.children) {
      const childResult = findAncestorKeys(item.children, activeKey);
      if (childResult !== null) return [item.key, ...childResult];
    }
  }
  return null;
}

function groupByGroup(items: MenuItemConfig[]): { group: string; items: MenuItemConfig[] }[] {
  const groups = new Map<string, MenuItemConfig[]>();
  for (const item of items) {
    const group = item.group || '其他';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(item);
  }
  return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
}

function AppSider({
  activeKey = 'dashboard',
  onMenuClick,
  menuItems = defaultMenuItems,
  permissions,
  isMobile = false,
  visible = false,
  onClose,
  collapsed = false,
}: AppSiderProps) {
  const { user, logout } = useAuthStore();
  const { info: systemInfo } = useSystemInfo();
  const router = useRouter();
  const [logoutHover, setLogoutHover] = useState(false);

  const visibleItems = useMemo(() => filterMenuItems(menuItems, permissions), [menuItems, permissions]);
  const groupedItems = useMemo(() => groupByGroup(visibleItems), [visibleItems]);
  const derivedOpenKeys = useMemo(() => {
    const result = findAncestorKeys(visibleItems, activeKey);
    return result ?? [];
  }, [activeKey, visibleItems]);

  const [openKeys, setOpenKeys] = useState<string[]>(derivedOpenKeys);

  // activeKey 变化（页签切换 / 快捷键跳转）时，自动展开其祖先菜单，
  // 否则高亮项会被折叠的父级藏住；只增不减，不干扰用户手动折叠操作。
  useEffect(() => {
    const ancestors = findAncestorKeys(visibleItems, activeKey) ?? [];
    if (ancestors.length === 0) return;
    setOpenKeys((prev) => {
      const missing = ancestors.filter((key) => !prev.includes(key));
      return missing.length === 0 ? prev : [...prev, ...missing];
    });
  }, [activeKey, visibleItems]);

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const displayName = user?.name || user?.username || '用户';
  const initials = displayName.charAt(0).toUpperCase();
  const isAdmin = user?.permissions?.some((p: string) => p.startsWith('system:')) ?? false;

  const toggleSubmenu = (key: string) => {
    setOpenKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleItemClick = (item: MenuItemConfig) => {
    if (item.children && item.children.length > 0) {
      // 折叠状态下，点击父菜单直接跳转到第一个子项
      if (collapsed) {
        const firstChild = item.children[0];
        if (firstChild) {
          onMenuClick?.(firstChild.key);
        }
      } else {
        toggleSubmenu(item.key);
      }
    } else {
      onMenuClick?.(item.key);
    }
    if (isMobile) {
      onClose?.();
    }
  };

  const renderMenuItem = (item: MenuItemConfig, level = 0) => {
    const isActive = item.key === activeKey;
    const isOpen = openKeys.includes(item.key);
    const hasChildren = item.children && item.children.length > 0;
    const paddingLeft = 20 + level * 16;
    // 依据所属分组注入主题色，使图标/指示条带上分组的专属色彩
    const accent = GROUP_ACCENT[item.group || ''] || undefined;
    const accentStyle = accent ? { '--item-accent': accent } as CSSProperties : undefined;

    if (hasChildren) {
      return (
        <div key={item.key}>
          <button
            type="button"
            className="side-parent"
            style={{ paddingLeft, ...accentStyle }}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            aria-expanded={!collapsed ? isOpen : undefined}
            onClick={() => (collapsed ? handleItemClick(item) : toggleSubmenu(item.key))}
          >
            {item.icon && <span className="sp-icon">{item.icon}</span>}
            <span className="sp-label">{item.label}</span>
            <span className={`sp-arrow ${!isOpen ? 'collapsed' : ''}`}>
              <IconDown />
            </span>
          </button>
          {!collapsed && (
            <div className={`side-children ${!isOpen ? 'collapsed' : ''}`}>
              {item.children!.map((child) => renderMenuItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        type="button"
        key={item.key}
        className={`side-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft, ...accentStyle }}
        title={collapsed ? item.label : undefined}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => handleItemClick(item)}
      >
        {item.icon && level === 0 && (
          <span className="si-icon">{item.icon}</span>
        )}
        {collapsed && !item.icon && (
          <span className="fold-dot" style={{ background: accent || 'var(--lx-text-3)' }} />
        )}
        <span className="si-label">{item.label}</span>
      </button>
    );
  };

  return (
    <aside
      className={`app-sider ${isMobile ? 'lx-sider-drawer' : ''} ${isMobile && visible ? 'visible' : ''} ${collapsed && !isMobile ? 'collapsed' : ''}`}
    >
      {/* Logo 区域 */}
      <div className="side-logo">
        {systemInfo.logoUrl ? (
          <img src={systemInfo.logoUrl} alt="系统 Logo" className="side-logo-icon side-logo-img" />
        ) : (
          <div className="side-logo-icon">{(systemInfo.name || '雷').charAt(0)}</div>
        )}
        <div className="side-logo-text">
          <div className="side-logo-title">{systemInfo.name}</div>
          <div className="side-logo-sub">人事工作台</div>
        </div>
      </div>

      {/* 菜单区域 */}
      <div className="side-menu">
        {groupedItems.map((group) => (
          <div key={group.group} className="side-group">
            <div className="side-group-title">{group.group}</div>
            {group.items.map((item) => renderMenuItem(item))}
          </div>
        ))}
      </div>

      {/* 底部用户区域 */}
      <div className="side-footer">
        <Avatar size={32} className="header-user-avatar">
          {initials}
        </Avatar>
        <div className="side-user-info">
          <div className="side-user-name">{displayName}</div>
          <span className="side-user-role">
            {isAdmin ? '管理员' : '员工'}
          </span>
        </div>
        <button
          type="button"
          aria-label="退出登录"
          className={`side-logout-btn ${logoutHover ? 'hover' : ''}`}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          onClick={handleLogout}
        >
          <IconPoweroff />
        </button>
      </div>
    </aside>
  );
}

const MemoizedAppSider = memo(AppSider);
export default MemoizedAppSider;