'use client';

import { Avatar, Dropdown, Menu } from '@arco-design/web-react';
import { IconMore, IconMenu, IconRight, IconSearch, IconMenuFold, IconMenuUnfold, IconSunFill, IconMoonFill, IconDesktop } from '@arco-design/web-react/icon';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import type { ThemeMode } from '@/store/theme';
import { usePaletteStore } from '@/store/palette';
import { breadcrumbFor, parentReturnFor } from '@/config/navigation';
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

function AppHeader({ title = '首页', isMobile = false, onMenuToggle, collapsed = false }: AppHeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);
  const togglePalette = usePaletteStore((s) => s.toggle);

  // 面包屑由 config/navigation 派生（含动态详情页父级链），未知路由取 URL 末段
  const breadcrumbs = breadcrumbFor(pathname);

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

  const themeMenu = (
    <Menu
      selectedKeys={[themeMode]}
      onClickMenuItem={(key) => setThemeMode(key as ThemeMode)}
    >
      <Menu.Item key="system">
        <IconDesktop style={{ marginRight: 8 }} />
        跟随系统
      </Menu.Item>
      <Menu.Item key="light">
        <IconSunFill style={{ marginRight: 8 }} />
        浅色模式
      </Menu.Item>
      <Menu.Item key="dark">
        <IconMoonFill style={{ marginRight: 8 }} />
        深色模式
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
                ? <IconMenuUnfold className="header-icon" />
                : <IconMenuFold className="header-icon" />}
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              className="menu-toggle-btn"
              onClick={onMenuToggle}
              aria-label="菜单"
            >
              <IconMenu className="header-icon" />
            </button>
          )}
          <nav className="breadcrumb">
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const returnPath = parentReturnFor(item);
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
          {/* 智能搜索入口（Ctrl+K 命令面板）：直接改 zustand 开关，
              不再伪造 KeyboardEvent 去触发另一个组件的全局监听 */}
          {!isMobile && (
            <button
              type="button"
              className="header-search-trigger"
              onClick={togglePalette}
              aria-label="搜索"
            >
              <IconSearch className="header-search-icon" />
              <span className="header-search-text">搜索页面、员工...</span>
              <kbd className="header-search-kbd">Ctrl K</kbd>
            </button>
          )}

          <Dropdown droplist={themeMenu} position="br">
            <button type="button" className="header-search-trigger" aria-label="切换主题">
              {themeMode === 'dark'
                ? <IconMoonFill className="header-search-icon" />
                : themeMode === 'system'
                  ? <IconDesktop className="header-search-icon" />
                  : <IconSunFill className="header-search-icon" />}
            </button>
          </Dropdown>

          <NotificationDropdown />

          <div className="header-divider" />

          <Dropdown droplist={dropList} position="br">
            <button
              type="button"
              className="user-info"
              aria-haspopup="menu"
              aria-label={`账号菜单：${userName}`}
            >
              <Avatar size={30} className="header-user-avatar">
                {userInitial}
              </Avatar>
              {!isMobile && (
                <span className="user-name">{userName}</span>
              )}
              {!isMobile && <IconMore className="header-more-icon" />}
            </button>
          </Dropdown>
        </div>
      </header>
    </>
  );
}

const MemoizedAppHeader = memo(AppHeader);
export default MemoizedAppHeader;