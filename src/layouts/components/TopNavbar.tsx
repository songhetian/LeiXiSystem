import React, { useMemo } from 'react';
import { 
  Group, 
  ActionIcon, 
  Text, 
  Box, 
  Breadcrumbs, 
  Anchor, 
  Menu, 
  Avatar, 
  rem, 
  Divider, 
  Tooltip,
  Slider,
  Popover,
  Badge
} from '@mantine/core';
import { 
  Bell, 
  LogOut, 
  User, 
  Settings, 
  Search, 
  ChevronDown, 
  Home,
  Type,
  PanelLeftClose,
  PanelLeftOpen,
  Megaphone,
  X
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { allMenuItems, MenuItem } from '@/core/config/menu';
import { useAuthStore } from '@/core/store/auth';

interface TopNavbarProps {
  sidebarOpened: boolean;
  onToggleSidebar: () => void;
  zoomLevel: number;
  onZoomChange: (value: number) => void;
}

export const TopNavbar = ({ sidebarOpened, onToggleSidebar, zoomLevel, onZoomChange }: TopNavbarProps) => {
  const { user, clearAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // 动态面包屑逻辑
  const breadcrumbs = useMemo(() => {
    const path = location.pathname.split('/').filter(Boolean);
    const activeId = path[path.length - 1];
    
    const findNodes = (items: MenuItem[], targetId: string, parents: { label: string; id: string }[] = []): { label: string; id: string }[] | null => {
      for (const item of items) {
        if (item.id === targetId) return [...parents, { label: item.label, id: item.id }];
        if (item.children) {
          const result = findNodes(item.children, targetId, [...parents, { label: item.label, id: item.id }]);
          if (result) return result;
        }
      }
      return null;
    };

    const nodes = findNodes(allMenuItems, activeId);
    return nodes || [];
  }, [location.pathname]);

  return (
    <Box 
      component="header"
      p="sm"
      style={{ 
        height: rem(64),
        borderBottom: `${rem(1)} solid var(--mantine-color-gray-2)`,
        backgroundColor: 'white',
        display: 'flex',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 90
      }}
    >
      <Group justify="space-between" flex={1} wrap="nowrap">
        <Group gap="lg">
          <ActionIcon 
            variant="subtle" 
            color="gray" 
            onClick={onToggleSidebar}
            size="lg"
          >
            {sidebarOpened ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </ActionIcon>

          <Breadcrumbs separator={<ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />} styles={{ separator: { margin: '0 8px' } }}>
            <Anchor component="button" onClick={() => navigate('/app/dashboard')} size="sm" c="dimmed">
              <Home size={16} />
            </Anchor>
            {breadcrumbs.map((node, index) => (
              <Text key={node.id} size="sm" fw={index === breadcrumbs.length - 1 ? 900 : 500} c={index === breadcrumbs.length - 1 ? 'black' : 'dimmed'}>
                {node.label}
              </Text>
            ))}
          </Breadcrumbs>
        </Group>

        <Group gap="md">
          {/* 这里可以放置实时广播预览，参考 v1 实现 */}
          
          <Group gap="xs">
            {/* Zoom Control */}
            <Popover position="bottom" withArrow shadow="md">
              <Popover.Target>
                <Tooltip label="界面缩放">
                  <ActionIcon variant="subtle" color="gray" size="lg">
                    <Type size={20} />
                  </ActionIcon>
                </Tooltip>
              </Popover.Target>
              <Popover.Dropdown p="md">
                <Box w={200}>
                  <Text size="xs" fw={700} mb="xs">界面缩放: {zoomLevel}%</Text>
                  <Slider 
                    value={zoomLevel} 
                    onChange={onZoomChange} 
                    min={75} 
                    max={100} 
                    step={5}
                    marks={[
                      { value: 75, label: '75%' },
                      { value: 100, label: '100%' }
                    ]}
                  />
                </Box>
              </Popover.Dropdown>
            </Popover>

            {/* Notifications */}
            <Tooltip label="系统通知">
              <ActionIcon variant="subtle" color="gray" size="lg" pos="relative">
                <Bell size={20} />
                <Badge 
                  size="xs" 
                  circle 
                  color="red" 
                  pos="absolute" 
                  top={4} 
                  right={4}
                  style={{ border: '2px solid white' }}
                >
                  3
                </Badge>
              </ActionIcon>
            </Tooltip>

            <Divider orientation="vertical" h={20} />

            <Menu position="bottom-end" shadow="md" width={200} radius="md">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap={8}>
                    <Avatar color="blue" radius="xl" size={32}>
                      {user?.real_name?.charAt(0) || <User size={18} />}
                    </Avatar>
                    <Box visibleFrom="sm">
                      <Text size="sm" fw={900}>{user?.real_name || '用户'}</Text>
                    </Box>
                    <ChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>系统账号</Menu.Label>
                <Menu.Item leftSection={<User size={14} />} onClick={() => navigate('/app/personal-info')}>
                  个人信息
                </Menu.Item>
                <Menu.Item leftSection={<Settings size={14} />} onClick={() => navigate('/app/settings')}>
                  偏好设置
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item 
                  color="red" 
                  leftSection={<LogOut size={14} />}
                  onClick={() => {
                    clearAuth();
                    navigate('/login');
                  }}
                >
                  退出登录
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Group>
    </Box>
  );
};
