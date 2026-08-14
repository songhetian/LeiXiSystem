'use client';

import { useState, useEffect, useMemo } from 'react';
import { Layout, Menu, Typography } from '@arco-design/web-react';
import {
  IconDashboard,
  IconCalendar,
  IconIdcard,
  IconUser,
  IconCheckCircle,
  IconSafe,
  IconBook,
  IconFile,
  IconSettings,
} from '@arco-design/web-react/icon';

const Sider = Layout.Sider;
const MenuItem = Menu.Item;
const SubMenu = Menu.SubMenu;

export interface MenuItemConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
  /** 叶子节点路由（点击跳转） */
  path?: string;
  /** 子菜单项 */
  children?: MenuItemConfig[];
}

const defaultMenuItems: MenuItemConfig[] = [
  { key: 'dashboard', label: '工作台', icon: <IconDashboard />, path: '/' },
  { key: 'employee', label: '员工', icon: <IconUser />, path: '/employees' },
  {
    key: 'attendance',
    label: '考勤',
    icon: <IconCalendar />,
    children: [
      { key: 'attendance-shifts', label: '班次管理' },
      { key: 'attendance-schedules', label: '排班管理' },
      { key: 'attendance-daily', label: '考勤日报' },
      { key: 'attendance-vacation', label: '休假管理' },
      { key: 'attendance-devices', label: '打卡设备' },
    ],
  },
  { key: 'approval-todo', label: '审批中心', icon: <IconCheckCircle />, path: '/approval/todo' },
  {
    key: 'payroll',
    label: '薪资',
    icon: <IconIdcard />,
    children: [
      { key: 'payroll-runs', label: '算薪批次' },
      { key: 'my-payslips', label: '我的工资条' },
    ],
  },
  { key: 'my-reimbursement', label: '我的报销', icon: <IconSafe />, path: '/expense/my' },
  { key: 'knowledge', label: '知识库', icon: <IconBook />, path: '/knowledge' },
  {
    key: 'system',
    label: '系统管理',
    icon: <IconFile />,
    children: [{ key: 'system', label: '公告管理' }],
  },
  { key: 'settings', label: '设置', icon: <IconSettings />, path: '/settings' },
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
  // 根据当前选中项推导需要展开的父级菜单
  const derivedOpenKeys = useMemo(
    () =>
      menuItems
        .filter((item) => item.children?.some((c) => c.key === activeKey))
        .map((item) => item.key),
    [activeKey, menuItems],
  );
  const [openKeys, setOpenKeys] = useState<string[]>(derivedOpenKeys);
  useEffect(() => {
    setOpenKeys((prev) => Array.from(new Set([...prev, ...derivedOpenKeys])));
  }, [derivedOpenKeys]);

  const renderItem = (item: MenuItemConfig) => {
    if (item.children && item.children.length > 0) {
      return (
        <SubMenu
          key={item.key}
          title={
            item.icon ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {item.icon}
                {item.label}
              </span>
            ) : (
              item.label
            )
          }
        >
          {item.children.map(renderItem)}
        </SubMenu>
      );
    }
    return (
      <MenuItem key={item.key}>
        {item.icon ? (
          <span style={{ marginRight: 8, display: 'inline-flex', verticalAlign: 'middle' }}>
            {item.icon}
          </span>
        ) : null}
        {item.label}
      </MenuItem>
    );
  };

  return (
    <Sider width={220} style={styles.sider}>
      <div style={styles.logo}>
        <Typography.Title heading={6} style={{ margin: 0, color: '#1d2129' }}>
          雷犀管理系统
        </Typography.Title>
      </div>
      <Menu
        style={{ width: '100%', borderRight: 'none' }}
        selectedKeys={[activeKey]}
        openKeys={openKeys}
        onClickSubMenu={(key) => {
          setOpenKeys((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
          );
        }}
        onClickMenuItem={(key) => onMenuClick?.(key)}
      >
        {menuItems.map(renderItem)}
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
