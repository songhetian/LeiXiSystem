import React, { useState, useMemo } from 'react';
import { 
  Box, ScrollArea, TextInput, ActionIcon, Group, Text, Avatar, 
  NavLink, Collapse, UnstyledButton, Badge, rem, Divider, Tooltip 
} from '@mantine/core';
import { 
  Search, X, ChevronRight, LogOut, User, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { allMenuItems, MenuItem } from '@/core/config/menu';
import { usePermission } from '@/core/hooks/usePermission';
import { useAuthStore } from '@/core/store/auth';
import { matchPinyin } from '@/core/utils/search';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useQueryClient } from '@tanstack/react-query';

interface SidebarProps {
  opened: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ opened, onToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, clearAuth } = useAuthStore();
  const { hasPermission } = usePermission();
  
  const [search, setSearch] = useState('');
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter(item => {
        if (item.permission) return hasPermission(item.permission);
        if (item.admin) return user?.role === 'admin';
        return true;
      })
      .map(item => ({
        ...item,
        children: item.children ? filterMenuItems(item.children) : undefined
      }))
      .filter(item => !item.children || item.children.length > 0);
  };

  const menuItems = useMemo(() => filterMenuItems(allMenuItems), [user]);

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.id);
    const active = location.pathname.includes(item.id);
    const Icon = item.icon;

    // 规约执行：数据预取，提升跳转效率
    const handlePrefetch = () => {
      if (!hasChildren) {
        if (item.id === 'system-logs') {
          queryClient.prefetchQuery({ queryKey: ['admin', 'logs', { page: 1 }] });
        }
      }
    };

    return (
      <React.Fragment key={item.id}>
        <NavLink
          label={item.label}
          leftSection={Icon && <Icon size={rem(18)} strokeWidth={2.5} />}
          rightSection={hasChildren && <ChevronRight size={rem(14)} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 200ms ease' }} />}
          active={active}
          onMouseEnter={handlePrefetch}
          onClick={() => {
            if (hasChildren) {
              setExpandedMenus(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
            } else {
              navigate(`/app/${item.id}`);
            }
          }}
          variant="light"
          styles={(theme) => ({
            root: { borderRadius: theme.radius.sm, marginBottom: rem(2), paddingLeft: rem(12 + level * 16), fontWeight: 700 }
          })}
        />
        {hasChildren && <Collapse in={isExpanded}>{item.children!.map(child => renderMenuItem(child, level + 1))}</Collapse>}
      </React.Fragment>
    );
  };

  return (
    <Box component="aside" style={{ width: opened ? rem(280) : rem(0), transition: 'width 300ms ease', height: '100vh', display: 'flex', flexDirection: 'column', borderRight: `1px solid var(--mantine-color-gray-2)`, backgroundColor: 'white', overflow: 'hidden', position: 'relative', zIndex: 100 }}>
      <Box p="md" style={{ borderBottom: `1px solid var(--mantine-color-gray-1)` }}>
        <Group justify="space-between" wrap="nowrap">
          <Avatar src="/icons/logo.ico" size={32} radius="sm" />
          <Text fw={900} size="sm">雷犀客服管理系统</Text>
        </Group>
      </Box>
      <ScrollArea flex={1} px="md" pb="md">
        <Box style={{ paddingBottom: rem(20) }}>{menuItems.map(item => renderMenuItem(item))}</Box>
      </ScrollArea>
    </Box>
  );
};
