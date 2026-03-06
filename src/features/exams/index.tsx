import React, { useState } from 'react';
import { 
  Box, Paper, Group, Title, Text, TextInput, Select, Button, Badge, 
  ActionIcon, Stack, Tabs, rem, SimpleGrid, Divider, ThemeIcon, 
  Tooltip, Progress, ScrollArea, Menu
} from '@mantine/core';
import { 
  FileText, History, Search, Plus, RefreshCw, Eye, 
  CheckCircle2, XCircle, Filter, Calendar, GraduationCap,
  ClipboardCheck, MoreVertical, LayoutGrid
} from 'lucide-react';
import { useExams } from './api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: '待发布', color: 'gray' },
  published: { label: '已发布', color: 'blue' },
  archived: { label: '已归档', color: 'dark' },
};

export const ExamCenter = () => {
  const [activeTab, setActiveTab] = useState<string | null>('exams');
  const [filters, setFilters] = useState({ status: 'all', keyword: '', page: 1 });

  const { data, isLoading, refetch } = useExams(filters);

  const columns = [
    { 
      key: 'title', 
      title: '试卷标题', 
      render: (r: any) => (
        <Group gap="sm">
          <ThemeIcon variant="light" color="blue" size="md" radius="md">
            <FileText size={16} />
          </ThemeIcon>
          <Box>
            <Text size="sm" fw={900}>{r.title}</Text>
            <Text size="xs" c="dimmed">{r.duration} 分钟 · 总分 {r.total_score}</Text>
          </Box>
        </Group>
      )
    },
    { key: 'creator', title: '创建人', render: (r: any) => <Text size="xs" fw={700}>{r.creator_name}</Text> },
    { 
      key: 'status', 
      title: '当前状态', 
      align: 'center' as const,
      render: (r: any) => {
        const config = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
        return <Badge variant="light" color={config.color} radius="sm">{config.label}</Badge>;
      } 
    },
    { key: 'time', title: '最后修改', render: (r: any) => dayjs(r.created_at).format('YYYY-MM-DD') },
    {
      key: 'actions',
      title: '管理',
      align: 'center' as const,
      render: () => (
        <Group gap={4} justify="center">
          <Button variant="subtle" size="compact-xs" fw={700}>编辑题目</Button>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm"><MoreVertical size={16} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<SendIcon size={14} />}>发起考核</Menu.Item>
              <Menu.Item leftSection={<History size={14} />}>历史版本</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<XCircle size={14} />}>物理删除</Menu.Item>
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
            <Tabs.Tab value="exams" leftSection={<FileText size={16} />} w="100%" fw={700} h={44}>试卷管理</Tabs.Tab>
            <Tabs.Tab value="plans" leftSection={<Calendar size={16} />} w="100%" fw={700} h={44}>考核计划</Tabs.Tab>
            <Tabs.Tab value="results" leftSection={<GraduationCap size={16} />} w="100%" fw={700} h={44}>成绩审计</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>考核管控中枢 · 巅峰版</Title>
            <Button color="blue" radius="md" size="md" leftSection={<Plus size={18} />} fw={900}>
              录入新试卷
            </Button>
          </Group>

          {/* 规约执行：单行全铺满自适应搜索 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <Select 
              placeholder="发布状态" 
              data={['all', 'draft', 'published', 'archived']} 
              style={{ flexGrow: 1 }}
              size="md"
              radius="md"
              value={filters.status}
              onChange={(v) => setFilters(p => ({ ...p, status: v || 'all' }))}
            />
            <TextInput 
              placeholder="搜索试卷名称 / 考点关键字..." 
              leftSection={<Search size={16} />}
              style={{ flexGrow: 2 }}
              size="md"
              radius="md"
              value={filters.keyword}
              onChange={(e) => setFilters(p => ({ ...p, keyword: e.currentTarget.value }))}
            />
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
            <LXTable columns={columns} data={data?.data || []} loading={isLoading} pagination={{ current: filters.page, pageSize: 20, total: data?.total || 0, onChange: (p) => setFilters(p2 => ({ ...p2, page: p })) }} />
          </Paper>
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
              {['本周考核', '待阅卷', '错题库', '全部导出'].map((label, idx) => (
                <Button key={label} variant="subtle" color="gray" radius={0} h="100%" px="lg" fw={700} styles={{ root: { borderRight: idx === 3 ? 0 : '1px solid #64748b' } }}>{label}</Button>
              ))}
            </Group>
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>高级审计筛选</Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>设定全局及格线</Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};

const SendIcon = ({ size }: { size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
