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
  Tooltip,
  Modal,
  Textarea,
  SimpleGrid
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
  Filter,
  Plus
} from 'lucide-react';
import { useDepartments, useEmployeeChangeActions, useEmployeeChanges, useEmployees, usePositions } from '../api';
import { LXTable } from '@/components/common/LXTable';
import dayjs from 'dayjs';
import { notifications } from '@mantine/notifications';

const CHANGE_TYPE_MAP: Record<string, { label: string; color: string }> = {
  hire: { label: '入职存证', color: 'emerald' },
  transfer: { label: '部门调岗', color: 'blue' },
  promotion: { label: '职务晋升', color: 'grape' },
  resign: { label: '离职生效', color: 'red' },
  other: { label: '其他变动', color: 'gray' },
};

export const ChangeRecords = () => {
  const [filters, setFilters] = useState({ type: 'all', page: 1 });
  const [editorOpened, setEditorOpened] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    change_type: 'transfer',
    change_date: dayjs().format('YYYY-MM-DD'),
    new_department_id: '',
    new_position_id: '',
    reason: '',
  });
  const { data, isLoading, refetch } = useEmployeeChanges(filters);
  const { data: employees = [] } = useEmployees({});
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions(form.new_department_id);
  const { create } = useEmployeeChangeActions();

  const handleCreateChange = async () => {
    if (!form.employee_id) {
      notifications.show({ title: '校验失败', message: '请选择员工', color: 'red' });
      return;
    }

    try {
      await create.mutateAsync({
        employee_id: Number(form.employee_id),
        change_type: form.change_type as 'transfer' | 'promotion' | 'resign' | 'other',
        change_date: form.change_date,
        new_department_id: form.new_department_id ? Number(form.new_department_id) : undefined,
        new_position_id: form.new_position_id ? Number(form.new_position_id) : undefined,
        reason: form.reason || undefined,
      });
      notifications.show({ title: '新增成功', message: '变动记录已存档', color: 'green' });
      setEditorOpened(false);
      setForm({
        employee_id: '',
        change_type: 'transfer',
        change_date: dayjs().format('YYYY-MM-DD'),
        new_department_id: '',
        new_position_id: '',
        reason: '',
      });
      refetch();
    } catch (error: any) {
      notifications.show({ title: '保存失败', message: error.response?.data?.message || '变动记录保存失败', color: 'red' });
    }
  };

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
          <Button color="blue" radius="md" leftSection={<Plus size={16} />} onClick={() => setEditorOpened(true)}>
            新增变动记录
          </Button>
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

      <Modal
        opened={editorOpened}
        onClose={() => setEditorOpened(false)}
        title={<Text fw={900}>新增变动记录</Text>}
        centered
        size="lg"
      >
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Select
            label="员工"
            data={employees.map((employee: any) => ({
              value: String(employee.id),
              label: `${employee.real_name} (${employee.employee_no})`,
            }))}
            value={form.employee_id}
            onChange={(value) => setForm((prev) => ({ ...prev, employee_id: value || '' }))}
            searchable
            required
          />
          <Select
            label="变动类型"
            data={[
              { label: '部门调岗', value: 'transfer' },
              { label: '职务晋升', value: 'promotion' },
              { label: '离职生效', value: 'resign' },
              { label: '其他变动', value: 'other' },
            ]}
            value={form.change_type}
            onChange={(value) => setForm((prev) => ({ ...prev, change_type: value || 'transfer' }))}
          />
          <TextInput
            label="生效日期"
            type="date"
            value={form.change_date}
            onChange={(e) => setForm((prev) => ({ ...prev, change_date: e.currentTarget.value }))}
          />
          <Select
            label="新部门"
            data={departments.map((department: any) => ({ value: String(department.id), label: department.name }))}
            value={form.new_department_id}
            onChange={(value) => setForm((prev) => ({ ...prev, new_department_id: value || '', new_position_id: '' }))}
            clearable
          />
          <Select
            label="新岗位"
            data={positions.map((position: any) => ({ value: String(position.id), label: position.name }))}
            value={form.new_position_id}
            onChange={(value) => setForm((prev) => ({ ...prev, new_position_id: value || '' }))}
            clearable
          />
          <Box />
        </SimpleGrid>
        <Textarea
          label="变动原因"
          minRows={3}
          mt="md"
          value={form.reason}
          onChange={(e) => setForm((prev) => ({ ...prev, reason: e.currentTarget.value }))}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="outline" color="gray" onClick={() => setEditorOpened(false)}>
            取消
          </Button>
          <Button color="blue" onClick={handleCreateChange} loading={create.isPending}>
            保存记录
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
};
