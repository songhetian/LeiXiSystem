'use client';

import { useState, useRef, useMemo } from 'react';
import { Message, Modal, Space, Button, Tag, Form, Input, Checkbox, Typography, Popconfirm } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import { systemApi, SysRole, SysPermission } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { groupPermissionsByModule, moduleLabel } from '../permission-utils';

const FormItem = Form.Item;

export default function SystemRolesPage() {
  const { can } = usePermission();

  // SWR 缓存：角色主列表 + 权限参考数据，跨页面共享去重
  const { data: rolesRes, loading, error, revalidate } = useCachedData<{
    code: number;
    message?: string;
    data?: SysRole[];
  }>('system:roles', () => systemApi.listRoles(), { staleTime: 30_000 });
  const data = rolesRes?.code === 0 && rolesRes.data ? rolesRes.data : [];

  const { data: permsRes } = useCachedData<{ code: number; data?: SysPermission[] }>(
    'system:permissions',
    () => systemApi.listPermissions(),
    { staleTime: 60_000 },
  );
  const permissions = permsRes?.code === 0 && permsRes.data ? permsRes.data : [];

  // 新建/编辑角色
  const [roleVisible, setRoleVisible] = useState(false);
  const [roleEditing, setRoleEditing] = useState<SysRole | null>(null);
  const [roleValues, setRoleValues] = useState({ code: '', name: '', description: '' });
  const [roleErrors, setRoleErrors] = useState<{ name?: string }>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<any>(null);

  // 分配权限
  const [permVisible, setPermVisible] = useState(false);
  const [permTarget, setPermTarget] = useState<SysRole | null>(null);
  const [permIds, setPermIds] = useState<number[]>([]);

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
    const next: { name?: string } = {};
    if (!roleValues.name.trim()) next.name = '请输入角色名称';
    setRoleErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRoleSave = async () => {
    if (saving) return;
    if (!validateRole()) {
      if (roleErrors.name) nameRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      const res = roleEditing
        ? await systemApi.updateRole(roleEditing.id, { name: roleValues.name, description: roleValues.description })
        : await systemApi.createRole({ name: roleValues.name, description: roleValues.description });
      if (res.code === 0) {
        Message.success(roleEditing ? '角色已更新' : '角色创建成功');
        setRoleVisible(false);
        revalidate();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
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
        revalidate();
      } else {
        Message.error(res.message || '删除失败');
      }
    } catch (e) {
      notifyError(e, '删除失败');
    }
  };

  const openAssign = (record: SysRole) => {
    setPermTarget(record);
    setPermIds(record.permissions.map((p) => p.permission.id));
    setModuleSearch('');
    setPermSearch('');
    setSelectedModule(null); // 打开时先展示全模块浏览/搜索
    setPermVisible(true);
  };

  const handleAssign = async () => {
    if (!permTarget) return;
    try {
      const res = await systemApi.assignRolePermissions(permTarget.id, permIds);
      if (res.code === 0) {
        Message.success('权限已更新');
        setPermVisible(false);
        revalidate();
      } else {
        Message.error(res.message || '分配失败');
      }
    } catch (e) {
      notifyError(e, '分配失败');
    }
  };

  const groupedPerms = useMemo(() => groupPermissionsByModule(permissions), [permissions]);
  const moduleKeys = Object.keys(groupedPerms);
  const allPermIds = permissions.map((p) => p.id);

  // 双栏布局：左模块导航 -> 右权限点；带模块/权限两级搜索
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [moduleSearch, setModuleSearch] = useState('');
  const [permSearch, setPermSearch] = useState('');

  const keyword = moduleSearch.trim();
  const filteredModules = moduleKeys.filter((m) => moduleLabel(m).includes(keyword));
  const currentPerms = selectedModule ? groupedPerms[selectedModule] || [] : [];
  const permKw = permSearch.trim();
  const filteredPerms = currentPerms.filter((p) => !permKw || p.name.includes(permKw));

  const handleModuleSelect = (m: string) => {
    setSelectedModule(m);
    setPermSearch('');
  };

  // 当前模块内权限点的勾选集合判断
  const modulePermIds = filteredPerms.map((p) => p.id);
  const moduleAllChecked = modulePermIds.length > 0 && modulePermIds.every((id) => permIds.includes(id));
  const moduleSomeChecked = modulePermIds.length > 0 && modulePermIds.some((id) => permIds.includes(id));

  const toggleModuleAll = (checked: boolean) => {
    setPermIds((prev) =>
      checked
        ? Array.from(new Set([...prev, ...modulePermIds]))
        : prev.filter((id) => !modulePermIds.includes(id)),
    );
  };

  const togglePerm = (checked: boolean, id: number) => {
    setPermIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((x) => x !== id)));
  };

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
          <Button size="small" type="text" disabled={!can('system:role:manage')} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button size="small" type="text" disabled={!can('system:role:manage')} onClick={() => openAssign(record)}>
            分配权限
          </Button>
          <Popconfirm
            title="确定删除该角色吗？"
            content="删除后关联该角色的用户将失去对应权限。"
            okText="删除"
            cancelText="取消"
            onOk={() => handleDelete(record)}
          >
            <Button size="small" type="text" status="danger" disabled={!can('system:role:manage')}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新建角色', type: 'primary', disabled: !can('system:role:manage'), onClick: openCreate },
  ];

  return (
    <PageContainer >
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
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
          <FormItem label="角色编码">
            <Input
              disabled
              value={roleValues.code}
              placeholder="保存后由系统自动生成"
            />
          </FormItem>
          <FormItem
            label="角色名称"
            required
            validateStatus={roleErrors.name ? 'error' : undefined}
            help={roleErrors.name}
          >
            <Input
              ref={nameRef}
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

      {/* 分配权限：两级权限树（模块中文名 -> 权限点），默认折叠只显示模块清单 */}
      <Modal
        title={`分配权限：${permTarget?.name || ''}`}
        visible={permVisible}
        onCancel={() => setPermVisible(false)}
        onOk={handleAssign}
        okText="保存"
        cancelText="取消"
        style={{ width: 760 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Typography.Text type="secondary">
            已选 <Typography.Text bold>{permIds.length}</Typography.Text> / {permissions.length} 项
          </Typography.Text>
          <Space size={8}>
            <Button size="small" onClick={() => setPermIds(allPermIds)}>全选</Button>
            <Button size="small" onClick={() => setPermIds([])}>清空</Button>
          </Space>
        </div>

        <div style={{ display: 'flex', gap: 12, height: 420 }}>
          {/* 左：模块导航 */}
          <div
            style={{
              width: 224,
              flexShrink: 0,
              border: '1px solid var(--lx-border-1)',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--lx-border-1)' }}>
              <Input
                size="small"
                allowClear
                prefix={<IconSearch style={{ fontSize: 14 }} />}
                placeholder="搜索模块"
                value={moduleSearch}
                onChange={setModuleSearch}
              />
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
              {filteredModules.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--lx-text-3)', fontSize: 13 }}>无匹配模块</div>
              )}
              {filteredModules.map((m) => {
                const perms = groupedPerms[m];
                const selectedCount = perms.filter((p) => permIds.includes(p.id)).length;
                const active = selectedModule === m;
                return (
                  <button
                    type="button"
                    key={m}
                    className="lx-clickable"
                    onClick={() => handleModuleSelect(m)}
                    aria-current={active ? 'true' : undefined}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 14,
                      background: active ? 'var(--lx-primary-50)' : 'transparent',
                      borderTop: 'none',
                      borderRight: 'none',
                      borderBottom: 'none',
                      borderLeft: active ? '3px solid var(--lx-primary-600)' : '3px solid transparent',
                      color: active ? 'var(--lx-primary-700)' : 'var(--lx-text-2)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>{moduleLabel(m)}</span>
                  <Space size={6}>
                    {selectedCount > 0 && (
                      <Tag size="small" color="arcoblue" style={{ margin: 0 }}>
                        已选 {selectedCount}
                      </Tag>
                    )}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {perms.length} 项
                    </Typography.Text>
                  </Space>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右：权限点 */}
          <div
            style={{
              flex: 1,
              border: '1px solid var(--lx-border-1)',
              borderRadius: 6,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {selectedModule ? (
              <>
                <div
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--lx-border-1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Typography.Text bold>{moduleLabel(selectedModule)}</Typography.Text>
                  <Space size={8}>
                    <Input
                      size="small"
                      allowClear
                      style={{ width: 180 }}
                      prefix={<IconSearch style={{ fontSize: 14 }} />}
                      placeholder="搜索权限"
                      value={permSearch}
                      onChange={setPermSearch}
                    />
                    <Checkbox
                      checked={moduleAllChecked}
                      indeterminate={moduleSomeChecked && !moduleAllChecked}
                      onChange={toggleModuleAll}
                    >
                      本模块全选
                    </Checkbox>
                  </Space>
                </div>
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
                  {filteredPerms.length === 0 ? (
                    <div style={{ color: 'var(--lx-text-3)', fontSize: 13 }}>无匹配权限</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px 14px' }}>
                      {filteredPerms.map((p) => (
                        <Checkbox key={p.id} checked={permIds.includes(p.id)} onChange={(c) => togglePerm(c, p.id)}>
                          {p.name}
                        </Checkbox>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lx-text-3)' }}>
                从左侧选择一个模块，查看并勾选其权限；也可在上方搜索模块快速定位
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}