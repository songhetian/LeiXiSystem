'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@arco-design/web-react';
import {
  IconDown,
  IconPoweroff,
} from '@arco-design/web-react/icon';
import { useAuthStore } from '@/store/auth';
import { useSystemInfo } from '@/hooks/use-system-info';
import { useApprovalTodoCount } from '@/hooks/use-menu-badges';
import { NAV_TREE, toneOfGroup, type NavNode } from '@/config/navigation';

export interface MenuItemConfig extends NavNode {}

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
  menuItems = NAV_TREE,
  permissions,
  isMobile = false,
  visible = false,
  onClose,
  collapsed = false,
}: AppSiderProps) {
  const { user, logout } = useAuthStore();
  const { info: systemInfo } = useSystemInfo();
  const router = useRouter();
  const todoCount = useApprovalTodoCount();

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
      // 兜底直跳：叶子菜单优先用自身 path 导航，避免 AppLayout 的 MENU_ROUTES
      // 漏登记 key 时点击无响应（曾发生：attendance-my-schedule 漏映射）。
      // onMenuClick 仍保留，供页签/KeepAlive 等上层逻辑使用。
      if (item.path) {
        router.push(item.path);
      }
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
    // 待办审批角标：待办数 > 0 时展示（无权限时 hook 恒为 0）
    const badge = item.key === 'approval-todo' && todoCount > 0 ? todoCount : null;

    if (hasChildren) {
      return (
        <div key={item.key}>
          <button
            type="button"
            className="side-parent"
            style={{ paddingLeft }}
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
        style={{ paddingLeft }}
        title={collapsed ? item.label : undefined}
        aria-label={badge ? `${item.label}（${badge} 条待办）` : item.label}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => handleItemClick(item)}
      >
        {item.icon && level === 0 && (
          <span className="si-icon">{item.icon}</span>
        )}
        <span className="si-label">{item.label}</span>
        {badge !== null && <span className="side-badge">{badge > 99 ? '99+' : badge}</span>}
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
            {/* 分组点用业务域色（一色一义，见 navigation.tsx GROUP_TONE）：
                把"颜色"放在这一处小面积上，菜单项本身保持中性，不整片染色 */}
            <div
              className="side-group-title"
              style={{ '--group-tone': toneOfGroup(group.group).fg } as React.CSSProperties}
            >
              {group.group}
            </div>
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
          className="side-logout-btn"
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