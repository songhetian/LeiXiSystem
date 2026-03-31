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
  Avatar, 
  ActionIcon, 
  Stack, 
  Tabs, 
  rem, 
  SimpleGrid,
  Divider,
  ThemeIcon,
  Tooltip,
  Menu
} from '@mantine/core';
import { 
  Search, 
  Monitor, 
  ClipboardCheck, 
  Settings, 
  Plus, 
  Download, 
  RefreshCw, 
  MoreVertical, 
  History, 
  AlertCircle,
  Calendar,
  LayoutGrid,
  Filter
} from 'lucide-react';
import { useAssetInstances, useAssetCategories, useAssetActions } from './api';
import { LXTable } from '@/components/common/LXTable';
import { getImageUrl } from '@/core/utils/file';
import dayjs from 'dayjs';

export const DeviceList = () => {
  const [activeTab, setActiveTab] = useState<string | null>('instances');
  const [filters, setFilters] = useState({
    device_status: '',
    keyword: '',
  });

  const { data: instances = [], isLoading, refetch } = useAssetInstances(filters);
  const { data: categories = [] } = useAssetCategories();

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const instanceColumns = [
    {
      key: 'asset_no',
      title: '资产编号',
      render: (record: any) => (
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" size="sm">
            <Monitor size={14} />
          </ThemeIcon>
          <Text size="sm" fw={900}>{record.asset_no}</Text>
        </Group>
      )
    },
    {
      key: 'model',
      title: '设备型号',
      render: (record: any) => (
        <Stack gap={0}>
          <Text size="sm" fw={700}>{record.model_name}</Text>
          <Text size="xs" c="dimmed">{record.form_name}</Text>
        </Stack>
      )
    },
    {
      key: 'user',
      title: '当前使用人',
      render: (record: any) => (
        record.user_name ? (
          <Group gap="sm">
            <Avatar src={getImageUrl(record.user_avatar)} size="sm" radius="xl">
              {record.user_name.charAt(0)}
            </Avatar>
            <Stack gap={0}>
              <Text size="xs" fw={900}>{record.user_name}</Text>
              <Text size="xs" c="dimmed">{record.department_name}</Text>
            </Stack>
          </Group>
        ) : (
          <Badge variant="dot" color="gray">待分配</Badge>
        )
      )
    },
    {
      key: 'device_status',
      title: '状态',
      align: 'center' as const,
      render: (record: any) => {
        const map: any = {
          idle: { label: '闲置', color: 'blue' },
          in_use: { label: '使用中', color: 'emerald' },
          repairing: { label: '维修中', color: 'orange' },
          scrapped: { label: '已报废', color: 'red' }
        };
        const config = map[record.device_status] || { label: record.device_status, color: 'gray' };
        return <Badge color={config.color} variant="light" radius="sm">{config.label}</Badge>;
      }
    },
    {
      key: 'actions',
      title: '操作',
      align: 'center' as const,
      render: (record: any) => (
        <Group gap={4} justify="center">
          <Tooltip label="配置详情">
            <ActionIcon variant="subtle" color="blue" size="sm"><Settings size={16} /></ActionIcon>
          </Tooltip>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm"><MoreVertical size={16} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<History size={14} />}>资产履历</Menu.Item>
              <Menu.Item leftSection={<AlertCircle size={14} />}>报修登记</Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
            <Tabs.Tab value="overview" leftSection={<LayoutGrid size={16} />} w="100%" fw={700} h={44}>资产看板</Tabs.Tab>
            <Tabs.Tab value="instances" leftSection={<Monitor size={16} />} w="100%" fw={700} h={44}>实机明细</Tabs.Tab>
            <Tabs.Tab value="requests" leftSection={<ClipboardCheck size={16} />} w="100%" fw={700} h={44}>申请审批</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>资产后勤管理 · 巅峰重构</Title>
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" leftSection={<Download size={18} />} size="md" fw={700}>导出明细</Button>
              <Button color="blue" radius="md" leftSection={<Plus size={18} />} size="md" fw={900}>
                新增入库
              </Button>
            </Group>
          </Group>

          {/* 规约执行：单行全铺满自适应搜索 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <Select 
              placeholder="资产状态" 
              data={['idle', 'in_use', 'repairing', 'scrapped']} 
              style={{ flexGrow: 1 }}
              size="md"
              radius="md"
              value={filters.device_status}
              onChange={(val) => handleFilterChange('device_status', val)}
              clearable
            />
            <TextInput 
              placeholder="搜索资产编号 / 序列号 / 使用人姓名" 
              leftSection={<Search size={16} />}
              style={{ flexGrow: 2 }}
              size="md"
              radius="md"
              value={filters.keyword}
              onChange={(e) => handleFilterChange('keyword', e.currentTarget.value)}
            />
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <LXTable 
              columns={instanceColumns} 
              data={instances} 
              loading={isLoading} 
            />
          </Paper>
        </Paper>

        {/* 规约执行：44px 快捷日期组 (物理缝合) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ 
              border: '1px solid #64748b', // 严格锁定 slate-500
              borderRadius: rem(8),
              overflow: 'hidden',
              height: 44 
            }}>
              {['今日新增', '本周领用', '本月报废', '保修期内'].map((label, idx) => (
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
                      backgroundColor: label === '保修期内' ? 'transparent' : 'transparent'
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
              <Button color="emerald" radius="md" h={44} leftSection={<History size={16} />} fw={900}>
                查询物理生命周期
              </Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
