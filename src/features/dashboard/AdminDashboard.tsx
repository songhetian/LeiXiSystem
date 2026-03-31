import React, { useState } from 'react';
import { 
  Box, Paper, Group, Title, Text, SimpleGrid, Tabs, rem, Stack, 
  ThemeIcon, Badge, ActionIcon, Button
} from '@mantine/core';
import { 
  BarChart3, LayoutDashboard, Activity, Users, Wallet, Clock, 
  RefreshCw, TrendingUp, ArrowUpRight, Filter, Calendar
} from 'lucide-react';
import { useDashboardStats, useRealtimeAttendance } from './api';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';

export const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [timeRange, setTimeRange] = useState('今天');
  const { data: stats, isLoading, refetch } = useDashboardStats();

  const OverviewCards = () => (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
      {[
        { label: '企业在职人数', value: stats?.overview.totalUsers, icon: Users, color: 'blue' },
        { label: '今日打卡活跃', value: stats?.overview.todayClocks, icon: Clock, color: 'emerald' },
        { label: '月度报销核销', value: `¥${stats?.overview.monthReimbursement.toLocaleString()}`, icon: Wallet, color: 'indigo' },
        { label: '待处理入职', value: stats?.overview.pendingUsers, icon: Activity, color: 'orange' },
      ].map((item) => (
        <Paper key={item.label} withBorder p="md" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xs">
            <Text size="xs" c="dimmed" fw={900} style={{ textTransform: 'uppercase' }}>{item.label}</Text>
            <ThemeIcon color={item.color} variant="light" radius="md">
              <item.icon size={16} />
            </ThemeIcon>
          </Group>
          <Group align="flex-end" gap={4}>
            <Text size="xl" fw={900}>{item.value || 0}</Text>
            <Badge size="xs" color="emerald" variant="light" leftSection={<ArrowUpRight size={10} />}>
              +2.4%
            </Badge>
          </Group>
        </Paper>
      ))}
    </SimpleGrid>
  );

  return (
    <Box>
      <Stack gap="lg">
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Box>
              <Title order={3} fw={800}>企业看板</Title>
              <Text size="sm" c="dimmed">查看组织运行、考勤与报销概览。</Text>
            </Box>
            <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetch()} loading={isLoading}>
              <RefreshCw size={20} />
            </ActionIcon>
          </Group>

          <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="xl" mb="xl">
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<LayoutDashboard size={16} />}>概览</Tabs.Tab>
              <Tabs.Tab value="departments" leftSection={<Users size={16} />}>组织分布</Tabs.Tab>
              <Tabs.Tab value="finance" leftSection={<TrendingUp size={16} />}>财务趋势</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          {activeTab === 'overview' && (
            <Stack gap="xl">
              <OverviewCards />
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                <Paper withBorder p="md" radius="lg">
                  <Text fw={900} size="sm" mb="lg">部门人员分布 (实机分布)</Text>
                  <Box h={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats?.deptDistribution || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                        <YAxis axisLine={false} tickLine={false} fontSize={12} />
                        <Tooltip cursor={{ fill: 'var(--mantine-color-gray-0)' }} contentStyle={{ borderRadius: rem(8), border: 'none', boxShadow: 'var(--mantine-shadow-md)' }} />
                        <Bar dataKey="value" fill="var(--mantine-color-blue-6)" radius={[4, 4, 0, 0]} barSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
                <Paper withBorder p="md" radius="lg">
                  <Text fw={900} size="sm" mb="lg">报销类目权重 (月度统计)</Text>
                  <Box h={300}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats?.reimbursementByType || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </SimpleGrid>
            </Stack>
          )}
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合 & slate-500 边框) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
              {['今天', '近7天', '近30天', '本季度', '年度汇总'].map((label, idx) => (
                <Button 
                  key={label} 
                  variant="subtle" 
                  color="gray" 
                  radius={0} 
                  h="100%" 
                  px="lg" 
                  fw={700} 
                  onClick={() => setTimeRange(label)}
                  styles={{ 
                    root: { 
                      borderRight: idx === 4 ? 0 : '1px solid #64748b',
                      backgroundColor: timeRange === label ? '#f1f5f9' : 'transparent',
                      color: timeRange === label ? '#1e293b' : '#64748b'
                    } 
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>高级维度审计</Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>导出数据快照</Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
