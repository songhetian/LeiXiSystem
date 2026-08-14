'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Space, Button, Tag, Form, Input, Checkbox } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { systemApi, SysUser, SysRole } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';

const { TextArea } = Input;

export default function SystemUsersPage() {
  const { can } = usePermission();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SysUser[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});
  const [roles, setRoles] = useState<SysRole[]>([]);

  // 新建/编辑 Modal
  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState<SysUser | null>(null);
  const [formValues, setFormValues] = useState({ username: '', name: '', password: '', status: 'active' });
  const [saving, setSaving] = useState(false);

  // 分配角色 Modal
  const [roleVisible, setRoleVisible] = useState(false);
  const [roleTarget, setRoleTarget] = useState<SysUser | null>(null);
  const [roleIds, setRoleIds] = useState<number[]>([]);

  const fetchList = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const res = await systemApi.listUsers({ page, pageSize, ...params });
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setPagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total });
      } else {
        Message.error(res.message || '获取用户列表失败');
      }
    } catch (e) {
      Message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    const res = await systemApi.listRoles();
    if (res.code === 0 && res.data) setRoles(res.data);
  };

  useEffect(() => {
    fetchList(1, 20, searchParams);
    fetchRoles();
  }, []);

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchList(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchList(1, pagination.pageSize, {});
  };

  const openCreate = () => {
    setEditing(null);
    setFormValues({ username: '', name: '', password: '', status: 'active' });
    setEditVisible(true);
  };

  const openEdit = (record: SysUser) => {
    setEditing(record);
    setFormValues({ username: record.username, name: record.name, password: '', status: record.status });
    setEditVisible(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = editing
        ? await systemApi.updateUser(editing.id, {
            name: formValues.name,
            status: formValues.status,
            password: formValues.password || undefined,
          })
        : await systemApi.createUser({
            username: formValues.username,
            password: formValues.password,
            name: formValues.name,
          });
      if (res.code === 0) {
        Message.success(editing ? '保存成功' : '创建成功');
        setEditVisible(false);
        fetchList(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      Message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const openAssignRoles = (record: SysUser) => {
    setRoleTarget(record);
    setRoleIds(record.roles.map((r) => r.id));
    setRoleVisible(true);
  };

  const handleAssignRoles = async () => {
    if (!roleTarget) return;
    try {
      const res = await systemApi.assignUserRoles(roleTarget.id, roleIds);
      if (res.code === 0) {
        Message.success('角色已更新');
        setRoleVisible(false);
        fetchList(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(res.message || '分配失败');
      }
    } catch (e) {
      Message.error('分配失败');
    }
  };

  const searchFields: SearchFieldConfig[] = [
    { key: 'keyword', label: '关键词', type: 'input', placeholder: '用户名/姓名' },
  ];

  const columns: ProTableColumn[] = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'name', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => <Tag color={value === 'active' ? 'green' : 'gray'}>{value === 'active' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '角色',
      dataIndex: 'roles',
      render: (value: { name: string }[]) =>
        (value || []).map((r) => <Tag key={r.name} style={{ marginRight: 4 }}>{r.name}</Tag>),
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 220,
      render: (_: any, record: SysUser) => (
        <Space>
          <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => openEdit(record)}>编辑</Button>
          <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => openAssignRoles(record)}>分配角色</Button>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新建用户', type: 'primary', disabled: !can('system:manage'), onClick: openCreate },
  ];

  return (
    <AppLayout title="用户管理" activeMenu="system-users">
      <PageContainer title="用户管理">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          searchFields={searchFields}
          onSearch={handleSearch}
          onReset={handleReset}
          toolbar={toolbar}
          pagination={pagination}
          onPageChange={(page, pageSize) => fetchList(page, pageSize, searchParams)}
        />

        {/* 新建/编辑（含重置密码） */}
        <Modal
          title={editing ? '编辑用户' : '新建用户'}
          visible={editVisible}
          onCancel={() => setEditVisible(false)}
          onOk={handleSave}
          confirmLoading={saving}
          style={{ width: 460 }}
        >
          <Form layout="vertical">
            <Form.Item label="用户名">
              <Input
                value={formValues.username}
                disabled={!!editing}
                placeholder="登录账号"
                onChange={(v) => setFormValues((p) => ({ ...p, username: v }))}
              />
            </Form.Item>
            <Form.Item label="姓名">
              <Input
                value={formValues.name}
                placeholder="真实姓名"
                onChange={(v) => setFormValues((p) => ({ ...p, name: v }))}
              />
            </Form.Item>
            <Form.Item label={editing ? '重置密码（留空不修改）' : '初始密码'}>
              <Input.Password
                value={formValues.password}
                placeholder={editing ? '留空保持原密码' : '请输入初始密码'}
                onChange={(v) => setFormValues((p) => ({ ...p, password: v }))}
              />
            </Form.Item>
            <Form.Item label="状态">
              <Checkbox
                checked={formValues.status === 'active'}
                onChange={(checked) => setFormValues((p) => ({ ...p, status: checked ? 'active' : 'disabled' }))}
              >
                启用
              </Checkbox>
            </Form.Item>
          </Form>
        </Modal>

        {/* 分配角色 */}
        <Modal
          title={`分配角色：${roleTarget?.name || ''}`}
          visible={roleVisible}
          onCancel={() => setRoleVisible(false)}
          onOk={handleAssignRoles}
          style={{ width: 420 }}
        >
          <Checkbox.Group value={roleIds} onChange={setRoleIds as any} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roles.map((r) => (
              <Checkbox key={r.id} value={r.id}>
                {r.name}（{r.code}）
              </Checkbox>
            ))}
          </Checkbox.Group>
        </Modal>
      </PageContainer>
    </AppLayout>
  );
}
