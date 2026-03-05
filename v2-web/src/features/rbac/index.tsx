import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Group, 
  Title, 
  Text, 
  TextInput, 
  Button, 
  Badge, 
  ActionIcon, 
  Stack, 
  Tabs, 
  rem, 
  SimpleGrid,
  Divider,
  ThemeIcon,
  Tooltip,
  Table,
  ScrollArea,
  Switch
} from '@mantine/core';
import { 
  Shield, 
  Key, 
  History, 
  Search, 
  Plus, 
  RefreshCw, 
  Edit, 
  Trash2, 
  Lock,
  Network,
  Filter
} from 'lucide-react';
import { useRoles, useRBACActions } from './api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';

export const RBACSystem = () => {
  const [activeTab, setActiveTab] = useState<string | null>('roles');
  const { data: roles = [], isLoading, refetch } = useRoles();

  const roleColumns = [
    { 
      key: 'name', 
      title: '角色名称', 
      render: (r: any) => (
        <Group gap="sm">
          <ThemeIcon variant="light" color={r.is_system ? 'blue' : 'gray'} size="md" radius="md">
            <Shield size={16} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={900}>{r.name}</Text>
            {r.is_system && <Badge size="xs" variant="filled">系统内置</Badge>}
          </Box>
        </Group>
      )
    },
    { 
      key: 'level', 
      title: '权重等级', 
      align: 'center' as const,
      render: (r: any) => (
        <Badge variant="outline" color={r.level <= 1 ? 'red' : 'blue'}>Lvl {r.level}</Badge>
      ) 
    },
    { key: 'description', title: '职能描述', render: (r: any) => <Text size="xs" c="dimmed">{r.description || '暂无描述'}</Text> },
    { key: 'created_at', title: '创建日期', render: (r: any) => dayjs(r.created_at).format('YYYY-MM-DD') },
    {
      key: 'actions',
      title: '操作管理',
      align: 'center' as const,
      render: (r: any) => (
        <Group gap={4} justify="center">
          <Tooltip label="编辑权限">
            <ActionIcon variant="subtle" color="blue" size="sm"><Key size={16} /></ActionIcon>
          </Tooltip>
          <Tooltip label="属性设置">
            <ActionIcon variant="subtle" color="gray" size="sm"><Edit size={16} /></ActionIcon>
          </Tooltip>
          {!r.is_system && (
            <ActionIcon variant="subtle" color="red" size="sm"><Trash2 size={16} /></ActionIcon>
          )}
        </Group>
      )
    }
  ];

  return (
    <Box style={{ display: 'flex', height: '100%', gap: rem(24) }}>
      {/* 规约执行：Tab 物理隔离进化 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 200, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="roles" leftSection={<Shield size={16} />} w="100%" fw={700} h={44}>角色架构</Tabs.Tab>
            <Tabs.Tab value="permissions" leftSection={<Key size={16} />} w="100%" fw={700} h={44}>权限地图</Tabs.Tab>
            <Tabs.Tab value="audit" leftSection={<History size={16} />} w="100%" fw={700} h={44}>授权审计</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>权限管控中枢</Title>
            <Button color="blue" radius="md" size="md" leftSection={<Plus size={18} />} fw={900}>
              新增业务角色
            </Button>
          </Group>

          {/* 规约执行：单行全铺满自适应搜索 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <TextInput 
              placeholder="搜索角色名称 / 职能描述..." 
              leftSection={<Search size={16} />}
              style={{ flexGrow: 1 }}
              size="md"
              radius="md"
            />
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <LXTable columns={roleColumns} data={roles} loading={isLoading} />
          </Paper>
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ 
              border: '1px solid #64748b', 
              borderRadius: rem(8),
              overflow: 'hidden',
              height: 44 
            }}>
              {['核心管理', '业务执行', '财务审计', '系统维护'].map((label, idx) => (
                <Button 
                  key={label}
                  variant="subtle" 
                  color="gray" 
                  radius={0} 
                  h="100%" 
                  px="lg"
                  fw={700}
                  styles={{
                    root: {
                      borderRight: idx === 3 ? 0 : '1px solid #64748b',
                      backgroundColor: label === '核心管理' ? '#f1f5f9' : 'transparent'
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>
                高级属性过滤
              </Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Lock size={16} />} fw={900}>
                强制全员权限重载
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
