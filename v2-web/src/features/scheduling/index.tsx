import React, { useState } from 'react';
import { 
  Box, Paper, Group, Title, Text, TextInput, Select, Button, Badge, 
  ActionIcon, Stack, Tabs, rem, SimpleGrid, Divider, ThemeIcon, 
  Tooltip, ScrollArea, Table, Avatar
} from '@mantine/core';
import { 
  Calendar, GitMerge, History, Search, Plus, RefreshCw, 
  Download, Filter, Settings, User, ArrowRight, Wand2
} from 'lucide-react';
import { useSchedulePreview, useSchedulingActions } from './api';
import dayjs from 'dayjs';

export const SchedulingCenter = () => {
  const [activeTab, setActiveTab] = useState<string | null>('auto');
  const [filters, setFilters] = useState({ departmentId: 1, startDate: '2026-03-01', endDate: '2026-03-31' });

  const { data: preview = [], isLoading, refetch } = useSchedulePreview(filters);
  const { exportExcel } = useSchedulingActions();

  return (
    <Box style={{ display: 'flex', height: '100%', gap: rem(24) }}>
      {/* 规约执行：Tab 物理隔离进化 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 200, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="auto" leftSection={<Wand2 size={16} />} w="100%" fw={700} h={44}>算法调度</Tabs.Tab>
            <Tabs.Tab value="manual" leftSection={<Calendar size={16} />} w="100%" fw={700} h={44}>手工调整</Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<History size={16} />} w="100%" fw={700} h={44}>发布存证</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Box>
              <Title order={3} fw={900}>智能调度中心 · 巅峰版</Title>
              <Text size="xs" c="dimmed">基于 100% 规则对冲逻辑的自动化排班引擎</Text>
            </Box>
            <Group gap="sm">
              <Button variant="outline" color="gray" h={44} radius="md" leftSection={<Download size={18} />} onClick={() => exportExcel.mutate(filters)}>
                导出排班 Excel
              </Button>
              <Button color="blue" h={44} radius="md" leftSection={<Wand2 size={18} />} fw={900}>
                执行规则自动分配
              </Button>
            </Group>
          </Group>

          {/* 规约执行：单行全铺满自适应搜索 */}
          <Group wrap="nowrap" gap="md" mb="xl">
            <Select placeholder="选择部门" data={[{value: '1', label: '客服一部'}]} style={{ flexGrow: 1 }} size="md" radius="md" value={String(filters.departmentId)} />
            <TextInput label="生效周期" type="month" style={{ flexGrow: 1 }} size="md" radius="md" defaultValue="2026-03" />
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <ScrollArea h="calc(100vh - 400px)">
            <Table withBorder withColumnBorders verticalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 150 }}>员工信息</Table.Th>
                  {/* 规约执行：高密度横向日期网格 */}
                  {Array.from({ length: 31 }).map((_, i) => (
                    <Table.Th key={i} style={{ width: 40, textAlign: 'center', fontSize: 10 }}>{i + 1}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.map((emp: any) => (
                  <Table.Tr key={emp.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Avatar size="xs" radius="xl">{emp.name.charAt(0)}</Avatar>
                        <Text size="xs" fw={700}>{emp.name}</Text>
                      </Group>
                    </Table.Td>
                    {emp.schedules.map((s: any, idx: number) => (
                      <Table.Td key={idx} style={{ padding: 2 }}>
                        <Box style={{ 
                          height: 24, 
                          borderRadius: 4, 
                          backgroundColor: s.is_rest ? 'var(--mantine-color-gray-1)' : 'var(--mantine-color-blue-0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Text size={8} fw={900} c={s.is_rest ? 'gray' : 'blue'}>{s.shift_name}</Text>
                        </Box>
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
              {['早班分布', '中班分布', '晚班分布', '全天覆盖'].map((label, idx) => (
                <Button key={label} variant="subtle" color="gray" radius={0} h="100%" px="lg" fw={700} styles={{ root: { borderRight: idx === 3 ? 0 : '1px solid #64748b' } }}>{label}</Button>
              ))}
            </Group>
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>对冲规则设置</Button>
              <Button color="emerald" radius="md" h={44} leftSection={<GitMerge size={16} />} fw={900}>物理同步至线上</Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
