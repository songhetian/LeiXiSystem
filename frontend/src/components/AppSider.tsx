'use client';

import { Layout, Menu, Typography } from '@arco-design/web-react';
import { IconDashboard, IconCalendar, IconIdcard, IconUser, IconFile } from '@arco-design/web-react/icon';

const Sider = Layout.Sider;
const MenuItem = Menu.Item;

export interface MenuItemConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

const defaultMenuItems: MenuItemConfig[] = [
  { key: 'dashboard', label: '工作台', icon: <IconDashboard /> },
  { key: 'attendance', label: '考勤', icon: <IconCalendar /> },
  { key: 'payroll', label: '薪资', icon: <IconIdcard /> },
  { key: 'employee', label: '员工', icon: <IconUser /> },
  { key: 'settings', label: '设置', icon: <IconFile /> },
];

export interface AppSiderProps {
  activeKey?: string;
  onMenuClick?: (key: string) => void;
  menuItems?: MenuItemConfig[];
}

export default function AppSider({
  activeKey = 'dashboard',
  onMenuClick,
  menuItems = defaultMenuItems,
}: AppSiderProps) {
  return (
    <Sider width={220} style={styles.sider}>
      <div style={styles.logo}>
        <Typography.Title heading={6} style={{ margin: 0, color: '#1d2129' }}>
          雷犀客服管理系统
        </Typography.Title>
      </div>
      <Menu
        style={{ width: '100%', borderRight: 'none' }}
        selectedKeys={[activeKey]}
        onClickMenuItem={(key) => onMenuClick?.(key)}
      >
        {menuItems.map((item) => (
          <MenuItem key={item.key}>
            {item.icon ? (
              <span
                style={{ marginRight: 8, display: 'inline-flex', verticalAlign: 'middle' }}
              >
                {item.icon}
              </span>
            ) : null}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </Sider>
  );
}

const styles = {
  sider: {
    width: 220,
    background: '#fff',
    borderRight: '1px solid #e5e6eb',
    height: '100vh',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  logo: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid #f2f3f5',
  },
};
