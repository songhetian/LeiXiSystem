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
  Divider,
  rem,
  ThemeIcon,
  Tooltip
} from '@mantine/core';
import { 
  History, 
  Search, 
  RefreshCw, 
  ArrowRight, 
  User, 
  Briefcase, 
  Network,
  FileText,
  Filter
} from 'lucide-react';
import { useEmployeeChanges } from '../api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';

const CHANGE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  hire: { label: '入职存证', color: 'emerald' },
  transfer: { label: '部门调岗', color: 'blue' },
  promotion: { label: '职务晋升', color: 'grape' },
  resign: { label: '离职生效', color: 'red' },
  other: { label: '其他变动', color: 'gray' },
};

export const ChangeRecords = () => {
  const [filters, setFilters] = useState({ type: 'all', page: 1 });
  const { data, isLoading, refetch } = useEmployeeChanges(filters);

  const columns = [
    {
      key: 'info',
      title: '变动员工',
      render: (r: any) => (
        <Group gap="sm">
          <Avatar color="blue" radius="md" size="sm">{r.real_name?.charAt(0)}</Avatar>
          <Box>
            <Text size="xs" fw={900}>{r.real_name}</Text>
            <Text size="xs" c="dimmed">{r.employee_no}</Text>
          </Box>
        </Group>
      )
    },
    {
      key: 'type',
      title: '变动属性',
      render: (r: any) => {
        const config = CHANGE_TYPE_MAP[r.change_type] || CHANGE_TYPE_MAP.other;
        return <Badge variant="light" color={config.color} radius="sm">{config.label}</Badge>;
      }
    },
    {
      key: 'dept',
      title: '部门变动',
      render: (r: any) => (
        <Group gap="xs">
          <Text size="xs" c="dimmed">{r.old_department_name || '无'}</Text>
          <ArrowRight size={10} color="var(--mantine-color-gray-4)" />
          <Text size="xs" fw={700}>{r.new_department_name || r.old_department_name}</Text>
        </Group>
      )
    },
    {
      key: 'pos',
      title: '职位变动',
      render: (r: any) => (
        <Group gap="xs">
          <Text size="xs" c="dimmed">{r.old_position_name || '无'}</Text>
          <ArrowRight size={10} color="var(--mantine-color-gray-4)" />
          <Text size="xs" fw={700}>{r.new_position_name || r.old_position_name}</Text>
        </Group>
      )
    },
    { key: 'date', title: '生效日期', render: (r: any) => dayjs(r.change_date).format('YYYY-MM-DD') },
    { key: 'reason', title: '变动缘由', render: (r: any) => <Text size="xs" truncate maw={200}>{r.reason || '-'}</Text> },
  ];

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="lg" shadow="xs">
        <Group justify="space-between" mb="md">
          <Group gap="sm">
            <ThemeIcon variant="light" color="grape" size="lg" radius="md">
              <History size={20} />
            </ThemeIcon>
            <Box>
              <Title order={4} fw={900}>人事审计存证</Title>
              <Text size="xs" c="dimmed">基于 100% 物理还原的人事全生命周期变动追踪</Text>
            </Box>
          </Group>
          <ActionIcon variant="light" color="blue" size="lg" onClick={() => refetch()} loading={isLoading}>
            <RefreshCw size={18} />
          </ActionIcon>
        </Group>

        <Divider mb="lg" />

        <Group wrap="nowrap" gap="md">
          <TextInput 
            placeholder="搜索员工姓名 / 工号" 
            leftSection={<Search size={16} />}
            style={{ flexGrow: 1 }}
            size="md"
            radius="md"
          />
          <Select 
            placeholder="变动类型过滤" 
            data={[
              { label: '全部记录', value: 'all' },
              { label: '入职', value: 'hire' },
              { label: '调岗', value: 'transfer' },
              { label: '晋升', value: 'promotion' },
              { label: '离职', value: 'resign' }
            ]}
            value={filters.type}
            onChange={(val) => setFilters(prev => ({ ...prev, type: val || 'all' }))}
            size="md"
            radius="md"
            style={{ width: 200 }}
          />
        </Group>
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
            {['全部变动', '调岗记录', '职级晋升', '离职审计'].map((label, idx) => (
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
                    backgroundColor: label === '全部变动' ? '#f1f5f9' : 'transparent'
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </Group>
          
          <Group gap="md">
            <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>
              更多审计维度
            </Button>
            <Button color="blue" radius="md" h={44} leftSection={<FileText size={16} />} fw={900}>
              导出 PDF 存证报告
            </Button>
          </Group>
        </Group>
      </Paper>

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
    </Stack>
  );
};
