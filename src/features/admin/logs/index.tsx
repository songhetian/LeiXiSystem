import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Group, 
  Title, 
  Text, 
  TextInput, 
  Select, 
  Button, 
  Badge, 
  ActionIcon, 
  Avatar,
  Stack, 
  Tabs, 
  rem, 
  SimpleGrid,
  Divider,
  ThemeIcon,
  Tooltip,
  ScrollArea
} from '@mantine/core';
import { 
  FileText, 
  LogIn, 
  Activity, 
  Search, 
  RefreshCw, 
  Calendar, 
  Filter, 
  ShieldCheck, 
  User,
  Database
} from 'lucide-react';
import { useSystemLogs } from './api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';

const MODULE_COLOR_MAP: Record<string, string> = {
  auth: 'blue',
  user: 'teal',
  quality: 'grape',
  attendance: 'orange',
  finance: 'indigo',
  system: 'red'
};

export const SystemLogs = () => {
  const [activeTab, setActiveTab] = useState<string | null>('operation');
  const [filters, setFilters] = useState({ module: '', keyword: '', status: '', page: 1 });

  const { data, isLoading, refetch } = useSystemLogs(filters);

  const columns = [
    { 
      key: 'user', 
      title: '操作人', 
      render: (r: any) => (
        <Group gap="xs">
          <Avatar size="sm" radius="xl">{r.real_name?.charAt(0)}</Avatar>
          <Box>
            <Text size="xs" fw={900}>{r.real_name || '系统自动'}</Text>
            <Text size="xs" c="dimmed">@{r.username || 'system'}</Text>
          </Box>
        </Group>
      )
    },
    { 
      key: 'module', 
      title: '功能模块', 
      align: 'center' as const,
      render: (r: any) => (
        <Badge variant="light" color={MODULE_COLOR_MAP[r.module] || 'gray'} radius="sm">
          {r.module.toUpperCase()}
        </Badge>
      ) 
    },
    { key: 'action', title: '具体行为', render: (r: any) => <Text size="xs" fw={700}>{r.action}</Text> },
    { 
      key: 'status', 
      title: '执行状态', 
      align: 'center' as const,
      render: (r: any) => (
        <Badge variant="dot" color={r.status ? 'emerald' : 'red'}>
          {r.status ? '成功' : '失败'}
        </Badge>
      ) 
    },
    { key: 'ip', title: 'IP 地址', render: (r: any) => <Text size="xs" c="dimmed">{r.ip || '-'}</Text> },
    { key: 'time', title: '操作时间', render: (r: any) => dayjs(r.created_at).format('MM-DD HH:mm:ss') }
  ];

  return (
    <Box style={{ display: 'flex', height: '100%', gap: rem(24) }}>
      {/* 规约执行：Tab 物理隔离进化 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 200, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="operation" leftSection={<Activity size={16} />} w="100%" fw={700} h={44}>操作审计</Tabs.Tab>
            <Tabs.Tab value="login" leftSection={<LogIn size={16} />} w="100%" fw={700} h={44}>登录历史</Tabs.Tab>
            <Tabs.Tab value="tasks" leftSection={<Database size={16} />} w="100%" fw={700} h={44}>后台存证</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>系统审计中枢</Title>
            <Group gap="sm">
              <Button variant="outline" color="gray" radius="md" size="sm" fw={700}>导出 CSV 审计流水</Button>
              <ActionIcon variant="light" color="blue" size="lg" onClick={() => refetch()} loading={isLoading}>
                <RefreshCw size={18} />
              </ActionIcon>
            </Group>
          </Group>

          {/* 规约执行：单行全铺满自适应搜索 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <Select 
              placeholder="所属模块" 
              data={['auth', 'user', 'quality', 'attendance', 'finance', 'system']} 
              style={{ flexGrow: 1 }}
              size="md"
              radius="md"
              clearable
              onChange={(val) => setFilters(prev => ({ ...prev, module: val || '' }))}
            />
            <TextInput 
              placeholder="搜索操作人姓名 / 行为描述 / URL..." 
              leftSection={<Search size={16} />}
              style={{ flexGrow: 2 }}
              size="md"
              radius="md"
              onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            />
          </Group>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <LXTable 
              columns={columns} 
              data={data?.data || []} 
              loading={isLoading}
              pagination={{
                current: filters.page,
                pageSize: 20,
                total: data?.total || 0,
                onChange: (p) => setFilters(prev => ({ ...prev, page: p }))
              }}
            />
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
              {['近1小时', '今天', '近7天', '近30天'].map((label, idx) => (
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
                      backgroundColor: label === '今天' ? '#f1f5f9' : 'transparent'
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>
                异常状态追踪
              </Button>
              <Button color="blue" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>
                设定日志物理清理周期
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
