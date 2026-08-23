'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useThrottle } from '@/hooks/use-throttle';
import { useRouter, usePathname } from 'next/navigation';
import {
  IconClose,
  IconMore,
  IconLeft,
  IconRight,
  IconRefresh,
  IconDelete,
  IconBranch,
} from '@arco-design/web-react/icon';
import { useTabsStore, type TabItem } from '@/store/tabs';

// 页面标题映射（用于页签名称）
const TABS_TITLE: Record<string, string> = {
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
  '/profile': '个人资料',
};

// 固定不可关闭的页签
const CLOSEABLE = ['/', '/profile'];

interface MenuState {
  x: number;
  y: number;
  tab: TabItem;
}

export default function PageTabs() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const tabs = useTabsStore((s) => s.tabs);
  const addTab = useTabsStore((s) => s.addTab);
  const removeTab = useTabsStore((s) => s.removeTab);
  const closeOthers = useTabsStore((s) => s.closeOthers);
  const closeAll = useTabsStore((s) => s.closeAll);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [scrollable, setScrollable] = useState({ left: false, right: false });

  // 路由变化时自动登记页签
  useEffect(() => {
    const label = TABS_TITLE[pathname] || pathname.split('/').filter(Boolean).pop() || '页面';
    addTab(pathname, label);
  }, [pathname, addTab]);

  // ---- 横向滚动 ----
  const updateScrollable = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollable({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  // 节流版：绑定到 scroll/resize，抑制高频 setState
  const throttledUpdate = useThrottle(updateScrollable, 100);

  useEffect(() => {
    updateScrollable();
  }, [tabs, updateScrollable]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 高频滚动/缩放使用节流，避免每次 scroll 事件都 setState 触发 re-render
    el.addEventListener('scroll', throttledUpdate, { passive: true });
    window.addEventListener('resize', throttledUpdate);
    return () => {
      el.removeEventListener('scroll', throttledUpdate);
      window.removeEventListener('resize', throttledUpdate);
    };
  }, [throttledUpdate]);

  const scrollBy = useCallback((dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  }, []);

  // ---- 右键 / 菜单 ----
  const openMenu = useCallback((e: React.MouseEvent, tab: TabItem) => {
    e.preventDefault();
    e.stopPropagation();
    // 菜单位于页签栏正下方，并限制在视窗内避免被截断/遮挡
    const bar = (e.currentTarget as HTMLElement).closest('.page-tabs');
    const barRect = bar?.getBoundingClientRect();
    const MENU_W = 160;
    const MENU_H = 150;
    const margin = 6;
    const topBase = barRect ? barRect.bottom : 56;
    const x = Math.max(margin, Math.min(e.clientX, window.innerWidth - MENU_W - margin));
    const y = Math.max(topBase + 4, Math.min(e.clientY, window.innerHeight - MENU_H - margin));
    setMenu({ x, y, tab });
  }, []);

  const openMoreMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenu({
      x: Math.min(rect.right, window.innerWidth - 160),
      y: rect.bottom + 4,
      tab: tabs.find((t) => t.path === pathname) ?? tabs[tabs.length - 1],
    });
  }, [tabs, pathname]);

  // 点击空白处 / 滚动时关闭菜单
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu]);

  const handleClose = useCallback(
    (tab: TabItem) => {
      if (CLOSEABLE.includes(tab.path)) return;
      removeTab(tab.path);
      if (tab.path === pathname) {
        const rest = tabs.filter((t) => t.path !== tab.path);
        router.push(rest[rest.length - 1]?.path || '/');
      }
    },
    [removeTab, router, pathname, tabs],
  );

  const handleRefresh = useCallback(() => {
    if (!menu) return;
    const tab = menu.tab;
    const current = tab.path === pathname;
    if (!current) router.push(tab.path);
    // 强制刷新：重新读取路由
    router.replace(tab.path + (tab.path.includes('?') ? '&_t=' : '?_t=') + Date.now());
    setMenu(null);
  }, [menu, pathname, router]);

  const handleCloseOthers = useCallback(() => {
    if (!menu) return;
    const tab = menu.tab;
    closeOthers(tab.path);
    if (tab.path !== pathname) router.push(tab.path);
    setMenu(null);
  }, [menu, closeOthers, router, pathname]);

  const handleCloseAll = useCallback(() => {
    closeAll();
    setMenu(null);
    if (pathname !== '/') router.push('/');
  }, [closeAll, router, pathname]);

  const closeMenu = useCallback(() => {
    // 防止按钮点击冒泡触发 window-click 关闭后又被处理
    requestAnimationFrame(() => setMenu(null));
  }, []);

  return (
    <div className="page-tabs" onContextMenu={(e) => e.preventDefault()}>
      {scrollable.left && (
        <button className="page-tabs-nav-btn" onClick={() => scrollBy(-1)} aria-label="向左滚动">
          <IconLeft style={{ fontSize: 13 }} />
        </button>
      )}
      <div className="page-tabs-scroll" ref={scrollRef}>
        {tabs.map((tab) => {
          const active = tab.path === pathname;
          const closable = !CLOSEABLE.includes(tab.path);
          return (
            <div
              key={tab.path}
              className="page-tab-wrap"
              onContextMenu={(e) => openMenu(e, tab)}
              title={tab.label}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={`page-tab ${active ? 'active' : ''} ${closable ? 'has-close' : ''}`}
                onClick={() => {
                  if (!active) router.push(tab.path);
                }}
              >
                <span className="page-tab-dot" />
                <span className="page-tab-label">{tab.label}</span>
              </button>
              {closable && (
                <button
                  type="button"
                  className="page-tab-close"
                  aria-label="关闭"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose(tab);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <IconClose style={{ fontSize: 10 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {scrollable.right && (
        <button className="page-tabs-nav-btn" onClick={() => scrollBy(1)} aria-label="向右滚动">
          <IconRight style={{ fontSize: 13 }} />
        </button>
      )}
      <div className="page-tabs-actions">
        <button
          type="button"
          className="page-tabs-more-btn"
          aria-label="更多操作"
          title="更多操作（右键页签也可关闭）"
          onClick={openMoreMenu}
        >
          <IconMore style={{ fontSize: 14 }} />
        </button>
      </div>

      {menu && (
        <>
          <div className="page-tabs-menu-mask" onClick={closeMenu} />
          <div
            className="page-tabs-menu"
            ref={menuRef}
            style={{ left: menu.x, top: menu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="page-tabs-menu-title">
              <IconBranch style={{ fontSize: 12 }} />
              {menu.tab.label}
            </div>
            <button className="page-tabs-menu-item" onClick={handleRefresh}>
              <IconRefresh /> 刷新当前页
            </button>
            <button
              className="page-tabs-menu-item"
              disabled={CLOSEABLE.includes(menu.tab.path)}
              onClick={handleCloseOthers}
            >
              <IconBranch /> 关闭其他
            </button>
            <button className="page-tabs-menu-item" onClick={handleCloseAll}>
              <IconDelete /> 关闭所有
            </button>
          </div>
        </>
      )}
    </div>
  );
}