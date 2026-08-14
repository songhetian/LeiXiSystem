'use client';

import { useState, useEffect } from 'react';
import { Message, Modal, Space, Button, Tag, Form, Input, Checkbox, Divider, Typography } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { systemApi, SysRole, SysPermission } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';

export default function SystemRolesPage() {
  const { can } = usePermission();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SysRole[]>([]);
  const [permissions, setPermissions] = useState<SysPermission[]>([]);

  // 新建角色
  const [createVisible, setCreateVisible] = useState(false);
  const [createValues, setCreateValues] = useState({ code: '', name: '', description: '' });
  const [creating, setCreating] = useState(false);

  // 分配权限
  const [permVisible, setPermVisible] = useState(false);
  const [permTarget, setPermTarget] = useState<SysRole | null>(null);
  const [permIds, setPermIds] = useState<number[]>([]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await systemApi.listRoles();
      if (res.code === 0 && res.data) setData(res.data);
      else Message.error(res.message || '获取角色失败');
    } catch (e) {
      Message.error('获取角色失败');
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

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await systemApi.createRole(createValues);
      if (res.code === 0) {
        Message.success('角色创建成功');
        setCreateVisible(false);
        fetchRoles();
      } else {
        Message.error(res.message || '创建失败');
      }
    } catch (e) {
      Message.error('创建失败');
    } finally {
      setCreating(false);
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
    } catch (e) {
      Message.error('分配失败');
    }
  };

  // 按模块分组权限点
  const groupedPerms = permissions.reduce<Record<string, SysPermission[]>>((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});

  const columns: ProTableColumn[] = [
    { title: '角色编码', dataIndex: 'code', width: 140 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '描述', dataIndex: 'description', width: 200 },
    {
      title: '权限数',
      dataIndex: 'permissions',
      width: 100,
      render: (value: { permission: SysPermission }[]) => `${(value || []).length} 项`,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: (_: any, record: SysRole) => (
        <Button size="small" type="text" disabled={!can('system:manage')} onClick={() => openAssign(record)}>
          分配权限
        </Button>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新建角色', type: 'primary', disabled: !can('system:manage'), onClick: () => setCreateVisible(true) },
  ];

  return (
    <AppLayout title="角色权限" activeMenu="system-roles">
      <PageContainer title="角色权限">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
          toolbar={toolbar}
          pagination={false}
        />

        <Modal
          title="新建角色"
          visible={createVisible}
          onCancel={() => setCreateVisible(false)}
          onOk={handleCreate}
          confirmLoading={creating}
          style={{ width: 440 }}
        >
          <Form layout="vertical">
            <Form.Item label="角色编码">
              <Input value={createValues.code} placeholder="如 hr" onChange={(v) => setCreateValues((p) => ({ ...p, code: v }))} />
            </Form.Item>
            <Form.Item label="名称">
              <Input value={createValues.name} placeholder="如 人事专员" onChange={(v) => setCreateValues((p) => ({ ...p, name: v }))} />
            </Form.Item>
            <Form.Item label="描述">
              <Input.TextArea value={createValues.description} onChange={(v) => setCreateValues((p) => ({ ...p, description: v }))} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={`分配权限：${permTarget?.name || ''}`}
          visible={permVisible}
          onCancel={() => setPermVisible(false)}
          onOk={handleAssign}
          style={{ width: 560 }}
        >
          {Object.entries(groupedPerms).map(([module, perms]) => (
            <div key={module}>
              <Divider orientation="left">{module}</Divider>
              <Checkbox.Group value={permIds} onChange={setPermIds as any} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {perms.map((p) => (
                  <Checkbox key={p.id} value={p.id}>
                    {p.name}（{p.code}）
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </div>
          ))}
        </Modal>
      </PageContainer>
    </AppLayout>
  );
}
