'use client';

import { Layout, Avatar, Dropdown } from '@arco-design/web-react';
import { IconUser, IconMore } from '@arco-design/web-react/icon';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';

const Header = Layout.Header;

export interface AppHeaderProps {
  title?: string;
}

export default function AppHeader({ title = '首页' }: AppHeaderProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const dropList = [
    <Menu key="0">
      <Menu.Item key="logout" onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>,
  ];

  return (
    <Header style={styles.header}>
      <div style={styles.title}>{title}</div>
      <div style={styles.userArea}>
        <Dropdown droplist={dropList} position="br">
          <div style={styles.userInfo}>
            <Avatar size={32} style={{ backgroundColor: '#165dff' }}>
              <IconUser />
            </Avatar>
            <span style={{ marginLeft: 8, fontSize: 14 }}>{user?.name || '用户'}</span>
            <IconMore style={{ marginLeft: 4, fontSize: 12 }} />
          </div>
        </Dropdown>
      </div>
    </Header>
  );
}

import { Menu } from '@arco-design/web-react';

const styles = {
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e6eb',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
  } as React.CSSProperties,
  title: {
    fontSize: 16,
    fontWeight: 500,
    color: '#1d2129',
  },
  userArea: {
    display: 'flex',
    alignItems: 'center',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 4,
  },
};
