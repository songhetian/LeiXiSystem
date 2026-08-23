'use client';

import { useState, useEffect, useRef } from 'react';
import { Message, Modal, Space, Button, Tag, Form, Input, Checkbox, Typography, Popconfirm, Card, Badge } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { systemApi, SysRole, SysPermission } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { groupPermissionsByModule, moduleAllChecked, moduleSelectedCount, toggleModule } from '../permission-utils';

const FormItem = Form.Item;

export default function SystemRolesPage() {
  const { can } = usePermission();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SysRole[]>([]);
  const [permissions, setPermissions] = useState<SysPermission[]>([]);

  // 新建/编辑角色
  const [roleVisible, setRoleVisible] = useState(false);
  const [roleEditing, setRoleEditing] = useState<SysRole | null>(null);
  const [roleValues, setRoleValues] = useState({ code: '', name: '', description: '' });
  const [roleErrors, setRoleErrors] = useState<{ code?: string; name?: string }>({});
  const [saving, setSaving] = useState(false);
  const codeRef = useRef<any>(null);

  // 分配权限
  const [permVisible, setPermVisible] = useState(false);
  const [permTarget, setPermTarget] = useState<SysRole | null>(null);
  const [permIds, setPermIds] = useState<number[]>([]);

  const fetchRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemApi.listRoles();
      if (res.code === 0 && res.data) setData(res.data);
      else {
        setError(res.message || '获取角色失败');
        Message.error(res.message || '获取角色失败');
      }
    } catch (e: any) {
      setError(e?.message || '获取角色失败');
      notifyError(e, '获取角色失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    const res = await systemApi.listPermissions();
    if (res.code === 0 && res.data) setPermissions(res.data);
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const openCreate = () => {
    setRoleEditing(null);
    setRoleValues({ code: '', name: '', description: '' });
    setRoleErrors({});
    setRoleVisible(true);
  };

  const openEdit = (record: SysRole) => {
    setRoleEditing(record);
    setRoleValues({ code: record.code, name: record.name, description: record.description || '' });
    setRoleErrors({});
    setRoleVisible(true);
  };

  const validateRole = () => {
    const next: { code?: string; name?: string } = {};
    if (!roleValues.code.trim()) next.code = '请输入角色编码';
    if (!roleValues.name.trim()) next.name = '请输入角色名称';
    setRoleErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRoleSave = async () => {
    if (saving) return;
    if (!validateRole()) {
      if (roleErrors.code) codeRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = roleEditing
        ? await systemApi.updateRole(roleEditing.id, { name: roleValues.name, description: roleValues.description })
        : await systemApi.createRole(roleValues);
      if (res.code === 0) {
        Message.success(roleEditing ? '角色已更新' : '角色创建成功');
        setRoleVisible(false);
        fetchRoles();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e: any) {
      notifyError(e, '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: SysRole) => {
    try {
      const res = await systemApi.deleteRole(record.id);
      if (res.code === 0) {
        Message.success('角色已删除');
        fetchRoles();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e: any) {
      notifyError(e, '删除失败');
    }
  };

  const openAssign = (record: SysRole) => {
    setPermTarget(record);
    setPermIds(record.permissions.map((p) => p.permission.id));
    setPermVisible(true);
  };

  const handleAssign = async () => {
    if (!permTarget) return;
    try {
      const res = await systemApi.assignRolePermissions(permTarget.id, permIds);
      if (res.code === 0) {
        Message.success('权限已更新');
        setPermVisible(false);
        fetchRoles();
      } else {
        Message.error(res.message || '分配失败');
      }
    } catch (e: any) {
      notifyError(e, '分配失败');
    }
  };

  const groupedPerms = groupPermissionsByModule(permissions);

  const columns: ProTableColumn[] = [
    { title: '角色编码', dataIndex: 'code', width: 140 },
    { title: '名称', dataIndex: 'name', width: 160 },
    {
      title: '描述',
      dataIndex: 'description',
      render: (value: string) => value || <span style={{ color: 'var(--lx-text-3)' }}>暂无</span>,
    },
    {
      title: '权限数',
      dataIndex: 'permissions',
      width: 100,
      render: (value: { permission: SysPermission }[]) => (
        <Tag color="arcoblue">{`${(value || []).length} 项`}</Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 240,
      render: (_: any, record: SysRole) => (
        <Space>
          <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => openAssign(record)}>
            分配权限
          </Button>
          <Popconfirm
            title="确定删除该角色吗？"
            content="删除后关联该角色的用户将失去对应权限。"
            okText="删除"
            cancelText="取消"
            onOk={() => handleDelete(record)}
          >
            <Button size="small" type="text" status="danger" disabled={!can('system:manage')}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新建角色', type: 'primary', disabled: !can('system:manage'), onClick: openCreate },
  ];

  return (
    <PageContainer title="角色权限">
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={fetchRoles}
        toolbar={toolbar}
        pagination={false}
      />

      {/* 新建/编辑角色 */}
      <Modal
        title={roleEditing ? `编辑角色：${roleEditing.name}` : '新建角色'}
        visible={roleVisible}
        onCancel={() => setRoleVisible(false)}
        onOk={handleRoleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        style={{ width: 460 }}
        maskClosable={false}
      >
        <Form layout="vertical">
          <FormItem
            label="角色编码"
            required
            validateStatus={roleErrors.code ? 'error' : undefined}
            help={roleErrors.code}
          >
            <Input
              ref={codeRef}
              disabled={!!roleEditing}
              value={roleValues.code}
              placeholder="如 hr"
              onChange={(v) => setRoleValues((p) => ({ ...p, code: v }))}
            />
          </FormItem>
          <FormItem
            label="角色名称"
            required
            validateStatus={roleErrors.name ? 'error' : undefined}
            help={roleErrors.name}
          >
            <Input
              value={roleValues.name}
              placeholder="如 人事专员"
              onChange={(v) => setRoleValues((p) => ({ ...p, name: v }))}
            />
          </FormItem>
          <FormItem label="描述">
            <Input.TextArea
              value={roleValues.description}
              placeholder="角色职责说明（可选）"
              autoSize={{ minRows: 2, maxRows: 4 }}
              onChange={(v) => setRoleValues((p) => ({ ...p, description: v }))}
            />
          </FormItem>
        </Form>
      </Modal>

      {/* 分配权限 */}
      <Modal
        title={`分配权限：${permTarget?.name || ''}`}
        visible={permVisible}
        onCancel={() => setPermVisible(false)}
        onOk={handleAssign}
        okText="保存"
        cancelText="取消"
        style={{ width: 640 }}
      >
        <Space style={{ marginBottom: 16 }}>
          <Checkbox
            indeterminate={
              permissions.length > 0 && permIds.length > 0 && permIds.length < permissions.length
            }
            checked={permissions.length > 0 && permIds.length === permissions.length}
            onChange={(checked) => setPermIds(checked ? permissions.map((p) => p.id) : [])}
          >
            全选
          </Checkbox>
          <Typography.Text type="secondary">
            已选 {permIds.length} / {permissions.length} 项
          </Typography.Text>
        </Space>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Object.entries(groupedPerms).map(([module, perms]) => {
            const allChecked = moduleAllChecked(permIds, perms);
            const selectedCount = moduleSelectedCount(permIds, perms);
            return (
              <Card key={module} className="perm-module-card" size="small" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Space size={6}>
                    <Badge count={selectedCount} />
                    <Typography.Text bold>{module}</Typography.Text>
                  </Space>
                  <Checkbox
                    indeterminate={selectedCount > 0 && !allChecked}
                    checked={allChecked}
                    style={{ fontWeight: 400 }}
                    onChange={(checked) => setPermIds((prev) => toggleModule(prev, perms, checked))}
                  >
                    全选
                  </Checkbox>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {perms.map((p) => (
                    <Checkbox key={p.id} value={p.id} checked={permIds.includes(p.id)} onChange={(checked) => {
                      setPermIds((prev) => (checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)));
                    }}>
                      {p.name}
                    </Checkbox>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </Modal>
    </PageContainer>
  );
}