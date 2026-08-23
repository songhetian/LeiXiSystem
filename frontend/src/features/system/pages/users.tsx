'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Space, Button, Tag, Form, Input, Radio, Checkbox, Typography, Popconfirm } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { SearchFieldConfig } from '@/components/SearchForm';
import { systemApi, SysUser, SysRole } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';

const { TextArea } = Input;

export default function SystemUsersPage() {
  const { can } = usePermission();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SysUser[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});
  const [roles, setRoles] = useState<SysRole[]>([]);

  // 新建/编辑 Modal
  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState<SysUser | null>(null);
  const [formValues, setFormValues] = useState({ username: '', name: '', password: '', status: 'active' as string, roleIds: [] as number[] });
  const [formErrors, setFormErrors] = useState<{ username?: string; name?: string; password?: string }>({});
  const [saving, setSaving] = useState(false);

  // 分配角色 Modal
  const [roleVisible, setRoleVisible] = useState(false);
  const [roleTarget, setRoleTarget] = useState<SysUser | null>(null);
  const [roleIds, setRoleIds] = useState<number[]>([]);

  const fetchList = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemApi.listUsers({ page, pageSize, ...params });
      if (res.code === 0 && res.data) {
        setData(res.data.list);
        setPagination({ current: res.data.page, pageSize: res.data.pageSize, total: res.data.total });
      } else {
        setError(res.message || '获取用户列表失败');
        Message.error(res.message || '获取用户列表失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取用户列表失败');
      notifyError(e, '获取用户列表失败');
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
    setFormValues({ username: '', name: '', password: '', status: 'active', roleIds: [] });
    setFormErrors({});
    setEditVisible(true);
  };

  const openEdit = (record: SysUser) => {
    setEditing(record);
    setFormValues({ username: record.username, name: record.name, password: '', status: record.status, roleIds: record.roles.map((r) => r.id) });
    setFormErrors({});
    setEditVisible(true);
  };

  const validateForm = () => {
    const next: { username?: string; name?: string; password?: string } = {};
    if (!editing && !formValues.username.trim()) next.username = '请输入用户名';
    if (!formValues.name.trim()) next.name = '请输入姓名';
    if (!editing && !formValues.password) next.password = '请输入初始密码';
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validateForm()) return;
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
            roleIds: formValues.roleIds,
          });
      if (res.code === 0) {
        Message.success(editing ? '保存成功' : '创建成功');
        setEditVisible(false);
        fetchList(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e: any) {
      notifyError(e, '保存失败');
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
    } catch (e: any) {
      notifyError(e, '分配失败');
    }
  };

  const handleDelete = async (record: SysUser) => {
    try {
      const res = await systemApi.deleteUser(record.id);
      if (res.code === 0) {
        Message.success('用户已删除');
        fetchList(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e: any) {
      notifyError(e, '删除失败');
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
        (value || []).length
          ? (value as { name: string }[]).map((r) => <Tag key={r.name} color="arcoblue" style={{ marginRight: 4 }}>{r.name}</Tag>)
          : <span style={{ color: 'var(--lx-text-3)' }}>未分配</span>,
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 260,
      render: (_: any, record: SysUser) => (
        <Space>
          <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => openEdit(record)}>编辑</Button>
          <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => openAssignRoles(record)}>分配角色</Button>
          <Popconfirm
            title="确定删除该用户吗？"
            content={`删除后「${record.name}」将无法登录系统。`}
            okText="删除"
            cancelText="取消"
            onOk={() => handleDelete(record)}
          >
            <Button size="small" type="text" status="danger" disabled={!can('system:manage')}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新建用户', type: 'primary', disabled: !can('system:manage'), onClick: openCreate },
  ];

  return (
    <PageContainer title="用户管理">
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={() => fetchList(pagination.current, pagination.pageSize, searchParams)}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pagination}
        onPageChange={(page, pageSize) => fetchList(page, pageSize, searchParams)}
      />

      {/* 新建/编辑（含重置密码与角色分配） */}
      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        visible={editVisible}
        onCancel={() => setEditVisible(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        maskClosable={false}
        style={{ width: 480 }}
      >
        <Form layout="vertical">
          <Form.Item label="用户名" required validateStatus={formErrors.username ? 'error' : undefined} help={formErrors.username}>
            <Input
              value={formValues.username}
              disabled={!!editing}
              placeholder="登录账号"
              onChange={(v) => setFormValues((p) => ({ ...p, username: v }))}
            />
          </Form.Item>
          <Form.Item label="姓名" required validateStatus={formErrors.name ? 'error' : undefined} help={formErrors.name}>
            <Input
              value={formValues.name}
              placeholder="真实姓名"
              onChange={(v) => setFormValues((p) => ({ ...p, name: v }))}
            />
          </Form.Item>
          <Form.Item
            label={editing ? '重置密码（留空不修改）' : '初始密码'}
            required={!editing}
            validateStatus={formErrors.password ? 'error' : undefined}
            help={formErrors.password}
          >
            <Input.Password
              value={formValues.password}
              placeholder={editing ? '留空保持原密码' : '请输入初始密码'}
              onChange={(v) => setFormValues((p) => ({ ...p, password: v }))}
            />
          </Form.Item>
          <Form.Item label="状态">
            <Radio.Group
              value={formValues.status}
              onChange={(v) => setFormValues((p) => ({ ...p, status: v }))}
              options={[
                { label: '启用', value: 'active' },
                { label: '停用', value: 'disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item label="分配角色">
            <Checkbox.Group
              value={formValues.roleIds}
              onChange={(val) => setFormValues((p) => ({ ...p, roleIds: (val as number[]) || [] }))}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {roles.map((r) => (
                <Checkbox key={r.id} value={r.id}>
                  {r.name}（{r.code}）
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配角色 */}
      <Modal
        title={`分配角色：${roleTarget?.name || ''}`}
        visible={roleVisible}
        onCancel={() => setRoleVisible(false)}
        onOk={handleAssignRoles}
        okText="保存"
        cancelText="取消"
        style={{ width: 480 }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Checkbox
            indeterminate={roleIds.length > 0 && roleIds.length < roles.length}
            checked={roles.length > 0 && roleIds.length === roles.length}
            onChange={(checked) => setRoleIds(checked ? roles.map((r) => r.id) : [])}
          >
            全选
          </Checkbox>
          <Typography.Text type="secondary">已选 {roleIds.length} / {roles.length} 个角色</Typography.Text>
        </Space>
        <Checkbox.Group
          value={roleIds}
          onChange={(val) => setRoleIds((val as number[]) || [])}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {roles.map((r) => (
            <Checkbox key={r.id} value={r.id}>
              {r.name}
              <span style={{ color: 'var(--lx-text-3)', marginLeft: 8 }}>{r.code}</span>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </Modal>
    </PageContainer>
  );
}