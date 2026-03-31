import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Collapse,
  Group,
  NavLink,
  ScrollArea,
  Text,
  TextInput,
  rem,
} from '@mantine/core';
import { ChevronRight, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { allMenuItems, MenuItem } from '@/core/config/menu';
import { usePermission } from '@/core/hooks/usePermission';
import { useAuthStore } from '@/core/store/auth';
import { matchPinyin } from '@/core/utils/search';

interface SidebarProps {
  opened: boolean;
}

export const Sidebar = ({ opened }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  const [search, setSearch] = useState('');
  const [activePrimaryId, setActivePrimaryId] = useState<string | null>(null);

  const filterMenuItems = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter((item) => {
        if (item.permission) return hasPermission(item.permission);
        if (item.admin) return user?.role === 'admin';
        return true;
      })
      .map((item) => ({
        ...item,
        children: item.children ? filterMenuItems(item.children) : undefined,
      }))
      .filter((item) => !item.children || item.children.length > 0);
  };

  const menuItems = useMemo(() => filterMenuItems(allMenuItems), [user]);

  const activeRootId = useMemo(() => {
    const path = location.pathname.split('/').filter(Boolean);
    const activeId = path[path.length - 1];

    const findRoot = (
      items: MenuItem[],
      targetId: string,
      rootId?: string,
    ): string | null => {
      for (const item of items) {
        const nextRootId = rootId || item.id;
        if (item.id === targetId) return nextRootId;
        if (item.children) {
          const result = findRoot(item.children, targetId, nextRootId);
          if (result) return result;
        }
      }
      return null;
    };

    return findRoot(menuItems, activeId) || menuItems[0]?.id || null;
  }, [location.pathname, menuItems]);

  useEffect(() => {
    setActivePrimaryId(activeRootId);
  }, [activeRootId]);

  const primaryItems = menuItems;
  const activePrimary = primaryItems.find((item) => item.id === activePrimaryId) || primaryItems[0];

  const findFirstLeaf = (item?: MenuItem): MenuItem | null => {
    if (!item) return null;
    if (!item.children?.length) return item;
    for (const child of item.children) {
      const leaf = findFirstLeaf(child);
      if (leaf) return leaf;
    }
    return null;
  };

  const handlePrefetch = (item: MenuItem, hasChildren: boolean) => {
    if (!hasChildren && item.id === 'system-logs') {
      queryClient.prefetchQuery({ queryKey: ['admin', 'logs', { page: 1 }] });
    }
  };

  const branchMatchesSearch = (item: MenuItem): boolean => {
    if (!search) return true;
    if (matchPinyin(item.label, search)) return true;
    return item.children?.some((child) => branchMatchesSearch(child)) ?? false;
  };

  const renderMenuBranch = (item: MenuItem, level = 0) => {
    if (!branchMatchesSearch(item)) return null;

    const hasChildren = Boolean(item.children?.length);
    const active = location.pathname.includes(item.id);
    const Icon = item.icon;
    const expanded = level === 0 ? search.trim().length > 0 || activePrimary?.id === item.id : true;

    return (
      <React.Fragment key={item.id}>
        <NavLink
          label={item.label}
          leftSection={Icon ? <Icon size={rem(level === 0 ? 18 : 16)} strokeWidth={2.5} /> : undefined}
          rightSection={
            hasChildren ? (
              <ChevronRight
                size={rem(14)}
                style={{
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              />
            ) : undefined
          }
          active={active}
          onMouseEnter={() => handlePrefetch(item, hasChildren)}
          onClick={() => {
            if (level === 0) {
              if (hasChildren) {
                setActivePrimaryId((currentId) => (currentId === item.id ? null : item.id));
              } else {
                setActivePrimaryId(item.id);
              }
            }

            if (hasChildren) {
              if (level > 0 || activePrimary?.id !== item.id) {
                const firstLeaf = findFirstLeaf(item);
                if (firstLeaf) navigate(`/app/${firstLeaf.id}`);
              }
            } else {
              navigate(`/app/${item.id}`);
            }
          }}
          variant={active ? 'filled' : 'light'}
          styles={(theme) => ({
            root: {
              borderRadius: theme.radius.lg,
              marginBottom: rem(6),
              paddingLeft: rem(12 + level * 16),
              minHeight: rem(level === 0 ? 46 : 42),
              fontWeight: active ? 700 : level === 0 ? 800 : 600,
            },
            label: {
              fontSize: level === 0 ? rem(13) : rem(12),
            },
          })}
        />
        {hasChildren && (
          <Collapse in={expanded}>
            <Box pl={rem(level === 0 ? 8 : 10)} mt={rem(6)} mb={rem(8)}>
              {item.children!.map((child) => renderMenuBranch(child, level + 1))}
            </Box>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box
      component="aside"
      style={{
        width: opened ? rem(296) : rem(0),
        transition: 'width 220ms ease',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #dde3ea',
        backgroundColor: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 100,
      }}
    >
      <Box px="md" py="md" style={{ borderBottom: '1px solid #edf1f5' }}>
        <Group gap="sm" wrap="nowrap">
          <Avatar src="/logo.ico" size={42} radius="md" />
          <Box style={{ minWidth: 0 }}>
            <Text fw={800} size="sm">雷犀客服系统</Text>
            <Text size="xs" c="dimmed">
              {activePrimary?.label || '功能导航'}
            </Text>
          </Box>
        </Group>
      </Box>

      <Box px="md" pt="md">
        <TextInput
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder="搜索菜单"
          leftSection={<Search size={14} />}
          radius="xl"
          size="sm"
        />
      </Box>

      <ScrollArea flex={1} px="md" pb="md" pt="sm">
        <Box style={{ paddingBottom: rem(20) }}>
          {primaryItems.map((item) => renderMenuBranch(item, 0))}
        </Box>
      </ScrollArea>
    </Box>
  );
};
