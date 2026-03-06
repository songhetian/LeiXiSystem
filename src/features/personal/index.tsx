import React, { useState } from 'react';
import { 
  Box, Container, Paper, Title, Text, Group, Avatar, Button, Stack, 
  Tabs, rem, SimpleGrid, Divider, ThemeIcon, Badge, ActionIcon, 
  Tooltip, TextInput, PasswordInput, ScrollArea, Switch
} from '@mantine/core';
import { 
  User, Wallet, Monitor, ShieldCheck, Settings, Eye, EyeOff, 
  ChevronRight, Save, Camera, History, Calendar, Filter
} from 'lucide-react';
import { useAuthStore } from '@/core/store/auth';
import { useProfile } from './api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';

export const PersonalCenter = () => {
  const [activeTab, setActiveTab] = useState<string | null>('profile');
  const [salaryVisible, setSalaryVisible] = useState(false);
  const { user: authUser } = useAuthStore();
  const { data: profile, isLoading } = useProfile(authUser?.id);

  const salaryColumns = [
    { key: 'month', title: '薪资月份', render: (r: any) => dayjs(r.salary_month).format('YYYY年MM月') },
    { 
      key: 'net', 
      title: '实发金额', 
      align: 'right' as const,
      render: (r: any) => (
        <Group gap="xs" justify="flex-end">
          <Text fw={900} style={{ fontFamily: 'monospace' }}>
            {salaryVisible ? `¥ ${r.net_salary.toLocaleString()}` : '••••••'}
          </Text>
        </Group>
      )
    },
    { key: 'status', title: '核销状态', render: () => <Badge variant="light" color="emerald">已物理到账</Badge> },
    { key: 'actions', title: '详情', render: () => <Button variant="subtle" size="compact-xs">查看明细</Button> }
  ];

  return (
    <Box style={{ height: '100%', display: 'flex', gap: rem(24) }}>
      {/* 规约执行：Tab 物理隔离进化 */}
      <Paper withBorder radius="lg" shadow="xs" style={{ width: 240, shrink: 0, overflow: 'hidden' }}>
        <Tabs value={activeTab} onChange={setActiveTab} orientation="vertical" variant="pills" p="xs">
          <Tabs.List w="100%">
            <Tabs.Tab value="profile" leftSection={<User size={16} />} w="100%" fw={700} h={44}>个人档案</Tabs.Tab>
            <Tabs.Tab value="salary" leftSection={<Wallet size={16} />} w="100%" fw={700} h={44}>我的薪资</Tabs.Tab>
            <Tabs.Tab value="assets" leftSection={<Monitor size={16} />} w="100%" fw={700} h={44}>领用资产</Tabs.Tab>
            <Tabs.Tab value="security" leftSection={<ShieldCheck size={16} />} w="100%" fw={700} h={44}>账号安全</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          {activeTab === 'profile' && (
            <Stack gap="xl">
              <Group justify="space-between">
                <Title order={3} fw={900}>数字化身份档案</Title>
                <Button color="blue" radius="md" size="md" leftSection={<Save size={18} />} fw={900} h={44}>
                  同步至云端
                </Button>
              </Group>

              <Group gap={32} align="flex-start">
                <Box pos="relative">
                  <Avatar src={profile?.avatar} size={120} radius={30} style={{ border: '4px solid white', boxShadow: 'var(--mantine-shadow-md)' }} />
                  <ActionIcon pos="absolute" bottom={-4} right={-4} size={36} radius="md" color="blue" variant="filled">
                    <Camera size={18} />
                  </ActionIcon>
                </Box>
                <Stack gap="md" style={{ flex: 1 }}>
                  <SimpleGrid cols={2}>
                    <TextInput label="真实姓名" value={profile?.real_name || ''} readOnly size="md" radius="md" />
                    <TextInput label="工号存证" value={profile?.employee_no || ''} readOnly size="md" radius="md" />
                    <TextInput label="所属部门" value={profile?.department_name || ''} readOnly size="md" radius="md" />
                    <TextInput label="标准职等" value={profile?.position_name || ''} readOnly size="md" radius="md" />
                  </SimpleGrid>
                </Stack>
              </Group>
            </Stack>
          )}

          {activeTab === 'salary' && (
            <Stack gap="lg">
              <Group justify="space-between">
                <Box>
                  <Title order={3} fw={900}>薪资结算历史</Title>
                  <Text size="xs" c="dimmed">基于 100% 财务对冲逻辑生成的核销流水</Text>
                </Box>
                <Button 
                  variant="outline" 
                  color={salaryVisible ? "red" : "blue"} 
                  h={44} 
                  radius="md" 
                  leftSection={salaryVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  onClick={() => setSalaryVisible(!salaryVisible)}
                  fw={900}
                >
                  {salaryVisible ? "隐藏敏感金额" : "物理身份验签查看"}
                </Button>
              </Group>
              <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
                <LXTable columns={salaryColumns} data={[]} loading={isLoading} />
              </Paper>
            </Stack>
          )}
        </Paper>

        {/* 规约执行：44px 快捷按钮组 (物理缝合 & slate-500 边框) */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ border: '1px solid #64748b', borderRadius: rem(8), overflow: 'hidden', height: 44 }}>
              {['个人动态', '审批历史', '考勤月报'].map((label, idx) => (
                <Button 
                  key={label} 
                  variant="subtle" 
                  color="gray" 
                  radius={0} 
                  h="100%" 
                  px="lg" 
                  fw={700} 
                  styles={{ root: { borderRight: idx === 2 ? 0 : '1px solid #64748b' } }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Filter size={16} />} fw={700}>全局审计过滤</Button>
              <Button color="emerald" radius="md" h={44} leftSection={<Calendar size={16} />} fw={900}>申请档案下载</Button>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
