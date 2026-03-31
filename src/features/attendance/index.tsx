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
  Stack, 
  Tabs, 
  rem, 
  SimpleGrid,
  Divider,
  Alert,
  Progress,
  Modal,
  Switch
} from '@mantine/core';
import { 
  Clock, 
  BarChart3, 
  Settings, 
  MapPin, 
  Download, 
  Calendar, 
  Filter, 
  Plus,
  CheckCircle2,
  Info,
  RefreshCw
} from 'lucide-react';
import { useMyAttendance, useAttendanceActions, useShifts, useShiftActions } from './api';
import { useJobStatus } from '../quality/hooks/useJobStatus'; 
import { LXTable } from '@/components/common/LXTable';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

export const AttendanceSystem = () => {
  const [activeTab, setActiveTab] = useState<string | null>('home');
  const [exportJobId, setActiveJobId] = useState<string | null>(null);
  const [currentDateRange, setCurrentDateRange] = useState('本月');

  const { data: records = [], isLoading: loadingRecords, refetch: refetchRecords } = useMyAttendance();
  const { data: shifts = [], isLoading: loadingShifts } = useShifts();
  const { clock, triggerExport } = useAttendanceActions();

  // 监听报表 Job 进度
  const exportStatus = useJobStatus(exportJobId, (result) => {
    notifications.show({
      title: '报表生成成功',
      message: `已完成 ${result.summary.totalEmployees} 位员工的考勤对冲计算`,
      color: 'green',
      icon: <CheckCircle2 size={18} />
    });
    setActiveJobId(null);
  });

  const handleExport = async () => {
    try {
      const res = await triggerExport.mutateAsync({
        dateRange: [dayjs().startOf('month').toISOString(), dayjs().toISOString()]
      });
      if (res.jobId) setActiveJobId(res.jobId);
    } catch (e) {
      notifications.show({ title: '导出失败', message: '后台队列连接异常', color: 'red' });
    }
  };

  const columns = [
    { key: 'attendance_date', title: '打卡日期', render: (r: any) => dayjs(r.attendance_date).format('YYYY-MM-DD') },
    { key: 'check_in_time', title: '签到时间', render: (r: any) => r.check_in_time ? dayjs(r.check_in_time).format('HH:mm:ss') : '-' },
    { key: 'check_out_time', title: '签退时间', render: (r: any) => r.check_out_time ? dayjs(r.check_out_time).format('HH:mm:ss') : '-' },
    { 
      key: 'status', 
      title: '考勤判定', 
      render: (r: any) => (
        <Badge variant="light" color={r.status === 'normal' ? 'emerald' : 'red'}>
          {r.status === 'normal' ? '正常' : '异常'}
        </Badge>
      ) 
    }
  ];

  const shiftColumns = [
    { key: 'name', title: '班次名称', render: (r: any) => <Text fw={900}>{r.name}</Text> },
    { 
      key: 'time', 
      title: '工作时间', 
      render: (r: any) => (
        <Group gap="xs">
          <Badge variant="light" color="blue" radius="sm">{r.start_time}</Badge>
          <Text size="xs" fw={700}>至</Text>
          <Badge variant="light" color="blue" radius="sm">{r.end_time}</Badge>
        </Group>
      ) 
    },
    { key: 'work_hours', title: '标准工时', render: (r: any) => <Text fw={700}>{r.work_hours} 小时</Text> },
    { 
      key: 'status', 
      title: '状态', 
      render: (r: any) => (
        <Switch checked={r.is_active} size="xs" color="emerald" readOnly />
      ) 
    },
    {
      key: 'actions',
      title: '操作',
      render: () => (
        <Group gap="xs">
          <Button variant="subtle" size="compact-xs" fw={700}>编辑</Button>
          <Button variant="subtle" size="compact-xs" color="red" fw={700}>物理注销</Button>
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
            <Tabs.Tab value="home" leftSection={<Clock size={16} />} w="100%" fw={700} h={44}>自助中心</Tabs.Tab>
            <Tabs.Tab value="stats" leftSection={<BarChart3 size={16} />} w="100%" fw={700} h={44}>部门统计</Tabs.Tab>
            <Tabs.Tab value="shifts" leftSection={<Settings size={16} />} w="100%" fw={700} h={44}>班次管理</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </Paper>

      <Stack gap="lg" style={{ flex: 1 }}>
        <Paper withBorder p="xl" radius="lg" shadow="xs">
          <Group justify="space-between" mb="xl">
            <Title order={3} fw={900}>考勤管理 · 巅峰重构版</Title>
            <Group gap="md">
              <Button color="blue" radius="md" size="md" leftSection={<MapPin size={18} />} onClick={() => clock.mutate({ type: 'check_in' })} loading={clock.isPending}>
                极速打卡
              </Button>
              <Button variant="outline" color="gray" radius="md" size="md" onClick={() => clock.mutate({ type: 'check_out' })} loading={clock.isPending}>
                结束外勤
              </Button>
            </Group>
          </Group>

          {activeTab === 'home' && (
            <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
              <LXTable columns={columns} data={records} loading={loadingRecords} />
            </Paper>
          )}

          {activeTab === 'stats' && (
            <Stack>
              <Alert color="indigo" icon={<Info size={16} />} radius="md">
                部门报表导出已实现异步化解耦，任务将托管至 <Text span fw={900}>Redis Queue</Text> 执行。
              </Alert>
              
              <Group wrap="nowrap" gap="md" mb="xl">
                <Select placeholder="选择目标部门" data={['全公司', '技术中台', '运营中心']} style={{ flexGrow: 1 }} size="md" radius="md" />
                <Button color="emerald" radius="md" size="md" leftSection={<Download size={18} />} onClick={handleExport} loading={!!exportJobId}>
                  触发异步计算导出
                </Button>
              </Group>

              {exportJobId && (
                <Stack p="xl" style={{ border: '1px solid #e2e8f0', borderRadius: rem(12) }}>
                  <Group justify="space-between">
                    <Text size="sm" fw={900}>对冲算法执行中...</Text>
                    <Text size="sm" fw={900} c="blue">{exportStatus?.progress || 0}%</Text>
                  </Group>
                  <Progress value={exportStatus?.progress || 0} animated color="blue" size="xl" radius="xl" />
                </Stack>
              )}
            </Stack>
          )}

          {activeTab === 'shifts' && (
            <Stack gap="md">
              <Group justify="space-between">
                <Box>
                  <Text size="sm" fw={900}>全量班次配置</Text>
                  <Text size="xs" c="dimmed">基于 Redis 高性能缓存的班次调度引擎</Text>
                </Box>
                <Button color="blue" radius="md" size="sm" leftSection={<Plus size={16} />} fw={900}>
                  定义新班次规则
                </Button>
              </Group>
              <Paper withBorder radius="lg" style={{ overflow: 'hidden' }}>
                <LXTable columns={shiftColumns} data={shifts} loading={loadingShifts} />
              </Paper>
            </Stack>
          )}
        </Paper>

        {/* 规约执行：快捷日期组 (44px, slate-500 边框) 物理缝合 */}
        <Paper withBorder p="xs" radius="lg" shadow="sm">
          <Group justify="space-between">
            <Group gap={0} style={{ 
              border: '1px solid #64748b', 
              borderRadius: rem(8),
              overflow: 'hidden',
              height: 44 
            }}>
              {['今天', '昨天', '本周', '本月', '上月'].map((label, idx) => (
                <Button 
                  key={label}
                  variant="subtle" 
                  color="gray" 
                  radius={0} 
                  h="100%" 
                  px="lg"
                  fw={700}
                  onClick={() => {
                    setCurrentDateRange(label);
                    if (activeTab === 'home') refetchRecords();
                  }}
                  styles={{
                    root: {
                      borderRight: idx === 4 ? 0 : '1px solid #64748b',
                      backgroundColor: currentDateRange === label ? '#f1f5f9' : 'transparent',
                      color: currentDateRange === label ? '#1e293b' : '#64748b'
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Group>
            
            <Group gap="md">
              <Button variant="outline" color="gray" radius="md" h={44} leftSection={<Calendar size={16} />} fw={700}>
                自定义周期
              </Button>
              <ActionIcon variant="light" color="blue" size={44} radius="md" onClick={() => refetchRecords()} loading={loadingRecords}>
                <RefreshCw size={20} />
              </ActionIcon>
            </Group>
          </Group>
        </Paper>
      </Stack>
    </Box>
  );
};
