'use client';

import { Avatar, Dropdown, Menu, Input } from '@arco-design/web-react';
import { IconMore, IconMenu, IconRight, IconSearch, IconMenuFold, IconMenuUnfold } from '@arco-design/web-react/icon';
import { useAuthStore } from '@/store/auth';
import { useRouter, usePathname } from 'next/navigation';
import { NotificationDropdown } from './NotificationDropdown';
import { memo } from 'react';

export interface AppHeaderProps {
  title?: string;
  isMobile?: boolean;
  onMenuToggle?: () => void;
  /** 桌面端侧边栏折叠状态 */
  collapsed?: boolean;
}

// 面包屑父级（第一层）可点击跳转到对应分组首页
const PARENT_RETURN_PATH: Record<string, string> = {
  首页: '/',
  员工管理: '/employees',
  考勤管理: '/attendance/daily',
  审批中心: '/approval/todo',
  薪资管理: '/payroll/runs',
  报销管理: '/expense/my',
  系统管理: '/system/users',
  知识库: '/knowledge',
  系统设置: '/settings',
};

const BREADCRUMB_MAP: Record<string, string[]> = {
  '/': ['首页'],
  '/employees': ['员工管理', '员工列表'],
  '/employees/transactions': ['员工管理', '员工事务'],
  '/employees/timeline': ['员工管理', '人员履历'],
  '/attendance/shifts': ['考勤管理', '班次管理'],
  '/attendance/schedules': ['考勤管理', '排班管理'],
  '/attendance/daily': ['考勤管理', '考勤日报'],
  '/attendance/monthly': ['考勤管理', '考勤月报'],
  '/attendance/vacation/balance': ['考勤管理', '休假额度'],
  '/attendance/vacation/leave': ['考勤管理', '请假记录'],
  '/attendance/vacation/overtime': ['考勤管理', '加班记录'],
  '/attendance/punch-makeup': ['考勤管理', '补卡申请'],
  '/attendance/devices': ['考勤管理', '打卡设备'],
  '/attendance/settings': ['考勤管理', '考勤设置'],
  '/approval/todo': ['审批中心', '待办审批'],
  '/approval/approved': ['审批中心', '已办审批'],
  '/approval/submissions': ['审批中心', '我的申请'],
  '/approval/settings': ['审批中心', '流程设置'],
  '/payroll/runs': ['薪资管理', '算薪批次'],
  '/payroll/my-payslips': ['薪资管理', '我的工资条'],
  '/expense/my': ['报销管理', '我的报销'],
  '/expense/approval': ['报销管理', '报销审批'],
  '/knowledge': ['知识库'],
  '/knowledge/admin': ['知识库管理'],
  '/notifications': ['我的通知'],
  '/system/departments': ['系统管理', '组织架构'],
  '/system/broadcasts': ['系统管理', '公告管理'],
  '/system/users': ['系统管理', '用户管理'],
  '/system/roles': ['系统管理', '角色权限'],
  '/system/logs': ['系统管理', '操作日志'],
  '/settings': ['系统设置'],
  '/profile': ['个人资料'],
};

function AppHeader({ title = '首页', isMobile = false, onMenuToggle, collapsed = false }: AppHeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const breadcrumbs = BREADCRUMB_MAP[pathname] || [title];

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const handleProfile = () => {
    router.push('/profile');
  };

  const dropList = (
    <Menu key="0">
      <Menu.Item key="profile" onClick={handleProfile}>
        个人资料
      </Menu.Item>
      <Menu.Item key="logout" onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  const userName = user?.name || user?.username || '用户';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          {!isMobile && (
            <button
              type="button"
              className="menu-toggle-btn"
              onClick={onMenuToggle}
              aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
            >
              {collapsed
                ? <IconMenuUnfold style={{ fontSize: 18, color: 'var(--lx-text-2)' }} />
                : <IconMenuFold style={{ fontSize: 18, color: 'var(--lx-text-2)' }} />}
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              className="menu-toggle-btn"
              onClick={onMenuToggle}
              aria-label="菜单"
            >
              <IconMenu style={{ fontSize: 18, color: 'var(--lx-text-2)' }} />
            </button>
          )}
          <nav className="breadcrumb">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const returnPath = PARENT_RETURN_PATH[item];
              const clickable = !isLast && !!returnPath;
              return (
                <span key={index} className="breadcrumb-item">
                    {index > 0 && <IconRight className="breadcrumb-sep" />}
                    {clickable ? (
                      <button
                        type="button"
                        className="breadcrumb-link"
                        onClick={() => router.push(returnPath)}
                        title="返回上一级"
                      >
                        {item}
                      </button>
                    ) : (
                      <span
                        className={isLast ? 'breadcrumb-current' : ''}
                      >
                        {item}
                      </span>
                    )}
                  </span>
              );
            })}
          </nav>
        </div>

        <div className="header-right">
          {/* 智能搜索入口（Ctrl+K 命令面板） */}
          {!isMobile && (
            <button
              type="button"
              className="header-search-trigger"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
                document.dispatchEvent(event);
              }}
              aria-label="搜索"
            >
              <IconSearch style={{ fontSize: 14, color: 'var(--lx-text-3)' }} />
              <span className="header-search-text">搜索页面...</span>
              <kbd className="header-search-kbd">Ctrl K</kbd>
            </button>
          )}

          <NotificationDropdown />

          <div className="header-divider" />

          <Dropdown droplist={dropList} position="br">
            <div className="user-info">
              <Avatar size={30} style={{ background: 'linear-gradient(135deg, #2455D9, #3a6ee8)', color: '#fff', fontWeight: 600, boxShadow: '0 2px 8px rgba(36, 85, 217, 0.25)' }}>
                {userInitial}
              </Avatar>
              {!isMobile && (
                <span className="user-name">{userName}</span>
              )}
              {!isMobile && <IconMore style={{ fontSize: 12, color: 'var(--lx-text-3)' }} />}
            </div>
          </Dropdown>
        </div>
      </header>
    </>
  );
}

const MemoizedAppHeader = memo(AppHeader);
export default MemoizedAppHeader;