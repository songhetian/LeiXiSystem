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
  Menu,
  rem,
  Stack,
  Switch,
  Tooltip,
  SimpleGrid,
  Divider,
  Modal,
  PasswordInput
} from '@mantine/core';
import { 
  Search, 
  UserPlus, 
  Download, 
  MoreVertical, 
  Edit, 
  Trash2, 
  ShieldCheck, 
  FilterX,
  History,
  RefreshCw,
  Star
} from 'lucide-react';
import { useEmployees, useDepartments, usePositions, useEmployeeAction, Employee } from './api';
import { LXTable } from '@/components/common/LXTable';
import { getImageUrl } from '@/core/utils/file';
import { openLXConfirm } from '@/core/utils/modals';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

export const EmployeeManagement = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    keyword: '',
    department_id: '',
    position: '',
    status: 'active',
    rating: '',
    date_from: '',
    date_to: ''
  });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editorOpened, setEditorOpened] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    real_name: '',
    username: '',
    email: '',
    phone: '',
    department_id: '',
    position_id: '',
    hire_date: '',
    status: 'active',
    employee_no: '',
    password: '',
  });

  const { data: employees = [], isLoading, refetch } = useEmployees(filters);
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = usePositions(form.department_id || filters.department_id);
  const { create, update, toggleManager, remove } = useEmployeeAction();

  const resetForm = () => {
    setForm({
      real_name: '',
      username: '',
      email: '',
      phone: '',
      department_id: '',
      position_id: '',
      hire_date: '',
      status: 'active',
      employee_no: '',
      password: '',
    });
    setEditingEmployee(null);
  };

  const openCreate = () => {
    resetForm();
    setEditorOpened(true);
  };

  const openEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      real_name: employee.real_name || '',
      username: employee.username || '',
      email: employee.email || '',
      phone: employee.phone || '',
      department_id: employee.department_id ? String(employee.department_id) : '',
      position_id: '',
      hire_date: employee.hire_date ? String(employee.hire_date).slice(0, 10) : '',
      status: employee.status || 'active',
      employee_no: employee.employee_no || '',
      password: '',
    });
    setEditorOpened(true);
  };

  const handleSubmit = async () => {
    if (!form.real_name.trim()) {
      notifications.show({ title: '校验失败', message: '请输入员工姓名', color: 'red' });
      return;
    }

    const payload = {
      real_name: form.real_name,
      username: form.username || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      department_id: form.department_id ? Number(form.department_id) : undefined,
      position_id: form.position_id ? Number(form.position_id) : undefined,
      hire_date: form.hire_date || undefined,
      status: form.status,
      employee_no: form.employee_no || undefined,
      password: form.password || undefined,
    };

    try {
      if (editingEmployee) {
        await update.mutateAsync({ id: editingEmployee.id, data: payload });
        notifications.show({ title: '更新成功', message: '员工档案已更新', color: 'green' });
      } else {
        await create.mutateAsync(payload);
        notifications.show({ title: '新增成功', message: '员工档案已创建', color: 'green' });
      }

      setEditorOpened(false);
      resetForm();
      refetch();
    } catch (error: any) {
      notifications.show({ title: '保存失败', message: error.response?.data?.message || '员工档案保存失败', color: 'red' });
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      keyword: '',
      department_id: '',
      position: '',
      status: '',
      rating: '',
      date_from: '',
      date_to: ''
    });
  };

  const handleToggleManager = async (employee: Employee, checked: boolean) => {
    if (!employee.user_id) return;
    try {
      await toggleManager.mutateAsync({ userId: employee.user_id, isManager: checked });
      notifications.show({ title: '权限变更', message: `已成功${checked ? '授权' : '撤销'}主管身份`, color: 'green' });
    } catch (e) {
      notifications.show({ title: '操作失败', message: '权限校验未通过', color: 'red' });
    }
  };

  // 规约执行：物理替换为巅峰质感确认框
  const handleDelete = (employee: Employee) => {
    openLXConfirm({
      title: '员工档案物理注销',
      message: `确定要抹除员工 ${employee.real_name} 的所有系统存证吗？此操作将同步清理关联的考勤与薪资记录。`,
      confirmLabel: '执行物理注销',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await remove.mutateAsync(employee.id);
          notifications.show({ title: '注销成功', message: '员工数据已从数据库物理移除', color: 'green' });
        } catch (e) {
          notifications.show({ title: '注销失败', message: '后端事务链路异常', color: 'red' });
        }
      },
    });
  };

  const columns = [
    {
      key: 'info',
      title: '员工存证信息',
      render: (record: Employee) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={getImageUrl(record.avatar)} radius="md" size={40}>
            {record.real_name?.charAt(0)}
          </Avatar>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={900} truncate>{record.real_name}</Text>
            <Text size="xs" c="dimmed">{record.employee_no}</Text>
          </Box>
        </Group>
      )
    },
    {
      key: 'username',
      title: '登录标识',
      align: 'center' as const,
      render: (record: Employee) => <Badge variant="light" color="gray" radius="sm">{record.username || '-'}</Badge>
    },
    { key: 'department_name', title: '所属部门', align: 'center' as const },
    { key: 'position_name', title: '标准职等', align: 'center' as const },
    {
      key: 'rating',
      title: '效能评分',
      align: 'center' as const,
      render: (record: Employee) => (
        <Badge color="orange" variant="light" radius="sm" leftSection={<Star size={10} fill="currentColor" />}>
          {record.rating || 0}星
        </Badge>
      )
    },
    {
      key: 'manager',
      title: '主管权限',
      align: 'center' as const,
      render: (record: Employee) => (
        <Switch size="xs" checked={!!record.is_department_manager} onChange={(e) => handleToggleManager(record, e.currentTarget.checked)} color="emerald" />
      )
    },
    {
      key: 'status',
      title: '存续状态',
      align: 'center' as const,
      render: (record: Employee) => {
        const map = { active: { label: '在职', color: 'emerald' }, inactive: { label: '停用', color: 'gray' }, resigned: { label: '离职', color: 'red' }, deleted: { label: '已删除', color: 'dark' } };
        const config = map[record.status as keyof typeof map] || map.active;
        return <Badge color={config.color} variant="dot">{config.label}</Badge>;
      }
    },
    {
      key: 'actions',
      title: '操作中枢',
      align: 'center' as const,
      render: (record: Employee) => (
        <Group gap={4} justify="center">
          <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => openEdit(record)}><Edit size={16} /></ActionIcon>
          <ActionIcon variant="subtle" color="indigo" size="sm"><ShieldCheck size={16} /></ActionIcon>
          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm"><MoreVertical size={16} /></ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<History size={14} />} onClick={() => navigate('/app/user-changes')}>变动履历</Menu.Item>
              <Menu.Divider />
              <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => handleDelete(record)}>物理删除</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      )
    }
  ];

  return (
    <Stack gap="lg">
      <Paper withBorder p="md" radius="lg" shadow="xs">
        <Group justify="space-between" mb="md">
          <Box>
            <Title order={4} fw={900}>组织人才管理</Title>
            <Text size="xs" c="dimmed" fw={700}>基于 100% 物理还原的人事全生命周期管控</Text>
          </Box>
          <Group>
            <Button variant="outline" color="gray" radius="md" leftSection={<Download size={16} />} size="sm">导出数据</Button>
            <Button color="emerald" radius="md" leftSection={<UserPlus size={16} />} size="sm" fw={900} onClick={openCreate}>新增存证</Button>
          </Group>
        </Group>
        <Divider mb="lg" />
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 7 }} spacing="xs">
          <TextInput label="搜索" placeholder="姓名 / 工号" size="xs" value={filters.keyword} onChange={(e) => handleFilterChange('keyword', e.currentTarget.value)} />
          <Select label="部门" placeholder="全部" size="xs" data={departments.map((d: any) => ({ value: String(d.id), label: d.name }))} value={filters.department_id} onChange={(val) => handleFilterChange('department_id', val)} clearable />
          <Select label="职位" placeholder="全部" size="xs" data={positions.map((p: any) => ({ value: p.name, label: p.name }))} value={filters.position} onChange={(val) => handleFilterChange('position', val)} disabled={!filters.department_id} clearable />
          <Select label="状态" placeholder="全部" size="xs" data={[{ label: '🟢 在职', value: 'active' }, { label: '🟡 停用', value: 'inactive' }, { label: '🔴 离职', value: 'resigned' }]} value={filters.status} onChange={(val) => handleFilterChange('status', val)} />
          <TextInput label="入职开始" type="date" size="xs" value={filters.date_from} onChange={(e) => handleFilterChange('date_from', e.currentTarget.value)} />
          <TextInput label="入职结束" type="date" size="xs" value={filters.date_to} onChange={(e) => handleFilterChange('date_to', e.currentTarget.value)} />
          <Group gap={4}>
            <Button variant="light" color="gray" size="xs" onClick={clearFilters} leftSection={<FilterX size={14} />}>重置</Button>
            <ActionIcon variant="light" color="emerald" size="sm" onClick={() => refetch()} loading={isLoading}><RefreshCw size={14} /></ActionIcon>
          </Group>
        </SimpleGrid>
      </Paper>
      <Paper withBorder radius="lg" shadow="xs" style={{ overflow: 'hidden' }}>
        <LXTable columns={columns} data={employees} loading={isLoading} pagination={{ current: currentPage, pageSize: pageSize, total: employees.length, onChange: setCurrentPage }} />
      </Paper>

      <Modal
        opened={editorOpened}
        onClose={() => {
          setEditorOpened(false);
          resetForm();
        }}
        title={<Text fw={900}>{editingEmployee ? '编辑员工档案' : '新增员工档案'}</Text>}
        size="lg"
        centered
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput label="真实姓名" value={form.real_name} onChange={(e) => setForm((prev) => ({ ...prev, real_name: e.currentTarget.value }))} required />
            <TextInput label="登录账号" value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.currentTarget.value }))} />
            <TextInput label="邮箱" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.currentTarget.value }))} />
            <TextInput label="手机号" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.currentTarget.value }))} />
            <Select
              label="所属部门"
              data={departments.map((d: any) => ({ value: String(d.id), label: d.name }))}
              value={form.department_id}
              onChange={(value) => setForm((prev) => ({ ...prev, department_id: value || '', position_id: '' }))}
              clearable
            />
            <Select
              label="岗位"
              data={positions.map((p: any) => ({ value: String(p.id), label: p.name }))}
              value={form.position_id}
              onChange={(value) => setForm((prev) => ({ ...prev, position_id: value || '' }))}
              clearable
            />
            <TextInput label="工号" value={form.employee_no} onChange={(e) => setForm((prev) => ({ ...prev, employee_no: e.currentTarget.value }))} />
            <TextInput label="入职日期" type="date" value={form.hire_date} onChange={(e) => setForm((prev) => ({ ...prev, hire_date: e.currentTarget.value }))} />
            <Select
              label="状态"
              data={[
                { value: 'active', label: '在职' },
                { value: 'inactive', label: '停用' },
                { value: 'resigned', label: '离职' },
              ]}
              value={form.status}
              onChange={(value) => setForm((prev) => ({ ...prev, status: value || 'active' }))}
            />
            {!editingEmployee && (
              <PasswordInput
                label="初始密码"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.currentTarget.value }))}
                placeholder="默认可留空"
              />
            )}
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="outline" color="gray" onClick={() => {
              setEditorOpened(false);
              resetForm();
            }}>
              取消
            </Button>
            <Button color="blue" onClick={handleSubmit} loading={create.isPending || update.isPending}>
              {editingEmployee ? '保存修改' : '创建员工'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
