'use client';

import { Layout, Menu, Typography } from '@arco-design/web-react';
import { IconDashboard, IconCalendar, IconMoneyCircle, IconUser, IconFile } from '@arco-design/web-react/icon';

const Sider = Layout.Sider;
const MenuItem = Menu.Item;

export interface MenuItemConfig {
  key: string;
  label: string;
}

const defaultMenuItems: MenuItemConfig[] = [
  { key: 'dashboard', label: '工作台' },
  { key: 'attendance', label: '考勤' },
  { key: 'payroll', label: '薪资' },
  { key: 'employee', label: '员工' },
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
          <MenuItem key={item.key}>{item.label}</MenuItem>
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
