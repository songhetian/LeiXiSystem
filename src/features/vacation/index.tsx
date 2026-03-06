import React, { useState } from 'react';
import { 
  Box, Paper, Group, Title, Text, TextInput, Select, Button, Badge, 
  ActionIcon, Stack, Tabs, rem, SimpleGrid, Divider, ThemeIcon, 
  Tooltip, Progress, ScrollArea, Card
} from '@mantine/core';
import { 
  Calendar, Palmtree, History, Search, Plus, RefreshCw, 
  Clock, ShieldCheck, Filter, Download, User, ArrowRight
} from 'lucide-react';
import { useMyVacation, useAllVacationBalances, useVacationActions } from './api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';

export const VacationCenter = () => {
  const [activeTab, setActiveTab] = useState<string | null>('my');
  const [filters, setFilters] = useState({ department_id: '', search: '', year: '2026', page: 1 });

  const { data: myBalance, isLoading: loadingMy } = useMyVacation();
  const { data: allBalances, isLoading: loadingAll, refetch } = useAllVacationBalances(filters);

  const balanceColumns = [
    { 
      key: 'user', 
      title: '员工信息', 
      render: (r: any) => (
        <Group gap="sm">
          <Avatar radius="md">{r.real_name?.charAt(0)}</Avatar>
          <Box>
            <Text size="xs" fw={900}>{r.real_name}</Text>
            <Text size="xs" c="dimmed">{r.employee_no}</Text>
          </Box>
        </Group>
      )
    },
    { key: 'dept', title: '所属部门', render: (r: any) => <Text size="xs" fw={700}>{r.department_name}</Text> },
    { key: 'annual', title: '年假余额', render: (r: any) => <Badge variant="light" color="blue">{r.annual_leave_total - r.annual_leave_used}天</Badge> },
    { key: 'sick', title: '病假余额', render: (r: any) => <Badge variant="light" color="red">{r.sick_leave_total - r.sick_leave_used}天</Badge> },
    { key: 'comp', title: '调休余额', render: (r: any) => <Badge variant="light" color="emerald">{r.compensatory_leave_total - r.compensatory_leave_used}天</Badge> },
    {
      key: 'actions',
      title: '管理',
      align: 'center' as const,
      render: () => (
        <Button variant="subtle" size="compact-xs" fw={700}>调整额度</Button>
      )
    }
  ];

  return (
    <Box style={{ display: 'flex', height: '100%', gap: rem(24) }}>
      {/* 规约执行：Tab 物理隔离进化 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 200, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="my" leftSection={<User size={16} />} w="100%" fw={700} h={44}>我的余额</Tabs.Tab>
            <Tabs.Tab value="all" leftSection={<ShieldCheck size={16} />} w="100%" fw={700} h={44}>额度审计</Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<History size={16} />} w="100%" fw={700} h={44}>变更记录</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>假期资产中枢 · 巅峰版</Title>
            <Button color="blue" radius="md" size="md" leftSection={<Download size={18} />} fw={900}>
              导出余额快照
            </Button>
          </Group>

          {activeTab === 'my' && (
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
              {[
                { label: '法定年假', total: myBalance?.annual_leave_total, used: myBalance?.annual_leave_used, color: 'blue', icon: Palmtree },
                { label: '带薪病假', total: myBalance?.sick_leave_total, used: myBalance?.sick_leave_used, color: 'red', icon: Activity },
                { label: '加班调休', total: myBalance?.compensatory_leave_total, used: myBalance?.compensatory_leave_used, color: 'emerald', icon: Clock },
              ].map((item) => (
                <Card key={item.label} withBorder radius="lg" p="xl" shadow="sm">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <ThemeIcon color={item.color} variant="light" size="lg" radius="md"><item.icon size={20} /></ThemeIcon>
                      <Text size="xs" fw={900} c="dimmed">{item.label}</Text>
                    </Group>
                    <Box>
                      <Text size={rem(28)} fw={900}>{(item.total || 0) - (item.used || 0)} <Text span size="sm">天</Text></Text>
                      <Text size="xs" c="dimmed">已用: {item.used || 0} / 总计: {item.total || 0}</Text>
                    </Box>
                    <Progress value={((item.total || 0) - (item.used || 0)) / (item.total || 1) * 100} color={item.color} size="sm" radius="xl" />
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          )}

          {activeTab === 'all' && (
            <>
              {/* 规约执行：单行全铺满自适应搜索 */}
              <Group wrap="nowrap" gap="md" mb="xl">
                <Select placeholder="所属部门" data={['全部', '技术部', '客服一部']} style={{ flexGrow: 1 }} size="md" radius="md" />
                <TextInput placeholder="搜索员工姓名 / 工号 / 账号..." leftSection={<Search size={16} />} style={{ flexGrow: 2 }} size="md" radius="md" />
                <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={loadingAll}>
                  <RefreshCw size={20} />
                </ActionIcon>
              </Group>

              <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
                <LXTable columns={balanceColumns} data={allBalances?.data || []} loading={loadingAll} />
              </Paper>
            </>
          )}
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
              {['2026年度', '2025年度', '结转统计'].map((label, idx) => (
                <Button key={label} variant="subtle" color="gray" radius={0} h="100%" px="lg" fw={700} styles={{ root: { borderRight: idx === 2 ? 0 : '1px solid #64748b' } }}>{label}</Button>
              ))}
            </Group>
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>年度对冲审计</Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>设定自动结转规则</Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};

const Activity = ({ size, color }: { size: number, color?: string }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
