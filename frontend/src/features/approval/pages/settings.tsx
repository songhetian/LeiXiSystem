'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Message,
  Card,
  Tag,
  InputNumber,
  Empty,
  Divider,
  Typography,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconDelete,
  IconSettings,
  IconEdit,
  IconTag,
  IconUser,
  IconUserGroup,
  IconApps,
} from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { ConfirmButton } from '@/components/ConfirmButton';
import { PermissionGate } from '@/components/PermissionGate';
import { approvalApi, Workflow, WorkflowNode } from '@/services/approval';
import { notifyError } from '@/lib/request';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import {
  BUSINESS_WORKFLOWS,
  BUSINESS_MODULE_LABELS,
  businessModuleOf,
  businessNameOf,
} from '@/lib/workflow-codes';

const { Option } = Select;
const { Text } = Typography;

// 业务编码选项：流程设置页新建的流程只有使用登记的业务编码，
// 才会被对应业务流（请假/加班/报销/入职…）真正使用（ADR-0020）
const BUSINESS_OPTIONS = BUSINESS_WORKFLOWS.map((w) => ({
  label: `${w.name}（${w.code}）`,
  value: w.code,
}));

const NODE_TYPE_OPTIONS = [
  { label: '角色审批', value: 'role', icon: <IconTag />, desc: '指定角色的用户可审批' },
  { label: '审批组', value: 'group', icon: <IconApps />, desc: '从审批组中选择审批人' },
  { label: '部门主管', value: 'department_manager', icon: <IconUserGroup />, desc: '申请人的部门主管审批' },
  { label: '申请人', value: 'initiator', icon: <IconUser />, desc: '申请人本人确认节点' },
];

// 审批流状态（StatusTag 色值规范：gray→default、green→success、red→danger）
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  active: { label: '启用', color: 'success' },
  inactive: { label: '停用', color: 'danger' },
};

function getNodeTypeMeta(type: string) {
  return NODE_TYPE_OPTIONS.find((o) => o.value === type) || NODE_TYPE_OPTIONS[0];
}

export default function ApprovalSettingsPage() {
  const { can } = usePermission();
  const fetchList = useCallback(
    () =>
      approvalApi.listWorkflows().then((res) => {
        if (res.code === 0 && res.data) {
          return res.data;
        }
        throw new Error(res.message || '获取审批流程列表失败');
      }),
    [],
  );
  const { data, loading, error, revalidate: revalidateList } = useCachedData<Workflow[]>(
    'config:approval:workflows',
    fetchList,
  );

  // ===== 审批流列表分页（数据整表返回，前端分页展示） =====
  const [listPage, setListPage] = useState(1);

  // 已被占用的业务编码：seed 会为 13 个登记业务各铺一条流程，若下拉不禁用，
  // 新建时选任何编码都会撞唯一键（6301「审批流编码已存在」），用户只能反复试错。
  const usedCodes = useMemo(
    () => new Set((data ?? []).map((w) => w.code)),
    [data],
  );
  // 列表还没回来（loading/error）时 usedCodes 是空集，此时若允许选择，用户会选中
  // 已占用的编码，提交必撞 6301。所以「编码是否可用」未知时一律禁用下拉。
  const codesReady = !loading && !error && Array.isArray(data);
  const allCodesUsed = codesReady && BUSINESS_OPTIONS.every((m) => usedCodes.has(m.value));

  // ===== 基本信息弹窗 =====
  const [baseModalVisible, setBaseModalVisible] = useState(false);
  const [editingBase, setEditingBase] = useState<Workflow | null>(null);
  const [baseForm] = Form.useForm();
  const [baseSaving, setBaseSaving] = useState(false);

  // ===== 节点配置弹窗 =====
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [activeNodeKey, setActiveNodeKey] = useState<string | null>(null);
  const [nodeSaving, setNodeSaving] = useState(false);

  // ===== 基本信息操作 =====
  const openCreateBase = () => {
    setEditingBase(null);
    baseForm.resetFields();
    baseForm.setFieldsValue({ status: 'draft' });
    setBaseModalVisible(true);
  };

  const openEditBase = (record: Workflow) => {
    setEditingBase(record);
    baseForm.setFieldsValue({
      code: record.code,
      name: record.name,
      status: record.status,
    });
    setBaseModalVisible(true);
  };

  const handleBaseSubmit = async () => {
    try {
      const values = await baseForm.validate();
      setBaseSaving(true);

      // module 由业务编码推导：同一业务归属固定分组，避免手选模块与编码不一致
      const module = businessModuleOf(values.code) ?? 'general';

      let res;
      if (editingBase) {
        res = await approvalApi.updateWorkflow(editingBase.id, {
          name: values.name,
          module,
          status: values.status,
        });
      } else {
        res = await approvalApi.createWorkflow({
          code: values.code,
          name: values.name,
          module,
          status: values.status,
          nodes: [],
        });
      }

      if (res.code === 0) {
        Message.success(editingBase ? '更新成功' : '创建成功');
        setBaseModalVisible(false);
        revalidateList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      notifyError(e, '参数校验失败');
    } finally {
      setBaseSaving(false);
    }
  };

  // ===== 节点配置操作 =====
  const openNodeConfig = async (record: Workflow) => {
    setCurrentWorkflow(record);
    setNodes(record.nodes || []);
    setActiveNodeKey(null);
    setNodeModalVisible(true);
  };

  const addNode = () => {
    const newOrder = nodes.length > 0 ? Math.max(...nodes.map((n) => n.order)) + 1 : 1;
    const newNode: WorkflowNode = {
      nodeKey: `node_${Date.now()}`,
      name: `审批节点 ${newOrder}`,
      type: 'role',
      order: newOrder,
    };
    setNodes([...nodes, newNode]);
    setActiveNodeKey(newNode.nodeKey);
  };

  const updateNode = (nodeKey: string, patch: Partial<WorkflowNode>) => {
    setNodes((prev) =>
      prev.map((n) => (n.nodeKey === nodeKey ? { ...n, ...patch } : n))
    );
  };

  const removeNode = (nodeKey: string) => {
    const updated = nodes.filter((n) => n.nodeKey !== nodeKey);
    setNodes(updated.map((n, i) => ({ ...n, order: i + 1 })));
    if (activeNodeKey === nodeKey) {
      setActiveNodeKey(null);
    }
  };

  const moveNode = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === nodes.length - 1) return;
    const updated = [...nodes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setNodes(updated.map((n, i) => ({ ...n, order: i + 1 })));
  };

  const handleNodeSubmit = async () => {
    if (!currentWorkflow) return;
    try {
      setNodeSaving(true);
      const res = await approvalApi.updateWorkflow(currentWorkflow.id, {
        nodes: nodes.sort((a, b) => a.order - b.order),
      });
      if (res.code === 0) {
        Message.success('节点配置保存成功');
        setNodeModalVisible(false);
        revalidateList();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      notifyError(e, '保存失败');
    } finally {
      setNodeSaving(false);
    }
  };

  const handleDelete = async (record: Workflow) => {
    const res = await approvalApi.deleteWorkflow(record.id);
    if (res.code === 0) {
      Message.success('删除成功');
      revalidateList();
    } else {
      Message.error(res.message || '删除失败');
    }
  };

  const activeNode = nodes.find((n) => n.nodeKey === activeNodeKey) || null;

  const columns: ProTableColumn[] = [
    { title: '流程名称', dataIndex: 'name', width: 200 },
    {
      title: '业务编码',
      dataIndex: 'code',
      width: 220,
      render: (v: string) => `${businessNameOf(v)}（${v}）`,
    },
    {
      title: '业务分组',
      dataIndex: 'module',
      width: 120,
      render: (v: string) => BUSINESS_MODULE_LABELS[v] || v,
    },
    {
      title: '节点数',
      dataIndex: 'nodes',
      width: 80,
      render: (v: WorkflowNode[]) => v?.length || 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} statusMap={STATUS_MAP} />,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 260,
      render: (_: any, record: Workflow) => (
        <PermissionGate code="approval:workflow:manage">
          <Space size="mini">
            <Button
              size="small"
              type="text"
              icon={<IconEdit />}
              onClick={() => openEditBase(record)}
            >
              编辑信息
            </Button>
            <Button
              size="small"
              type="text"
              icon={<IconSettings />}
              onClick={() => openNodeConfig(record)}
            >
              配置节点
            </Button>
            <ConfirmButton
              size="small"
              type="text"
              status="danger"
              title="确认删除"
              content={`确定要删除审批流程「${record.name}」吗？`}
              onConfirm={() => handleDelete(record)}
            >
              删除
            </ConfirmButton>
          </Space>
        </PermissionGate>
      ),
    },
  ];

  return (
    <PageContainer
    >
      <div className="pro-card">
        <div className="pro-toolbar pro-toolbar-wrap">
          <span className="text-sm font-medium text-text-1">审批流列表</span>
          <PermissionGate code="approval:workflow:manage">
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={openCreateBase}
            >
              新建审批流程
            </Button>
          </PermissionGate>
        </div>
        <ProTable
          columns={columns}
          data={data || []}
          rowKey="id"
          loading={loading}
          error={error}
          onRetry={revalidateList}
          pagination={{ current: listPage, pageSize: 20, total: (data || []).length }}
          onPageChange={setListPage}
        />
      </div>

      {/* ===== 基本信息弹窗 ===== */}
      <Modal
        title={editingBase ? '编辑基本信息' : '新建审批流程'}
        visible={baseModalVisible}
        onOk={handleBaseSubmit}
        onCancel={() => setBaseModalVisible(false)}
        confirmLoading={baseSaving}
        okText="保存"
        cancelText="取消"
        maskClosable={false}
        style={{ width: 520 }}
      >
        <Form form={baseForm} layout="vertical">
          <Form.Item label="流程名称" field="name" rules={[{ required: true, message: '请输入流程名称' }]}>
            <Input placeholder="请输入流程名称" />
          </Form.Item>
          <Form.Item
            label="业务编码"
            field="code"
            rules={[{ required: true, message: '请选择业务编码' }]}
            extra={
              editingBase
                ? '业务编码创建后不可修改'
                : allCodesUsed
                  ? '全部业务编码均已有流程，请直接在列表中编辑，或先删除不再使用的流程'
                  : !codesReady
                    ? '正在读取已配置的流程，请稍候…'
                    : '选择业务编码后，该流程才会被对应业务流使用；已配置的业务编码不可重复新建，请直接编辑列表中对应的流程'
            }
          >
            {editingBase ? (
              <Input disabled />
            ) : (
              <Select
                showSearch
                placeholder={allCodesUsed ? '全部业务编码均已有流程' : '请选择业务编码'}
                disabled={!codesReady || allCodesUsed}
              >
                {BUSINESS_OPTIONS.map((m) => (
                  <Option key={m.value} value={m.value} disabled={usedCodes.has(m.value)}>
                    {m.label}
                    {usedCodes.has(m.value) ? '（已配置）' : ''}
                  </Option>
                ))}
              </Select>
            )}
          </Form.Item>
          <Form.Item label="状态" field="status">
            <Select>
              <Option value="draft">草稿</Option>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 节点配置弹窗 ===== */}
      <Modal
        title={
          <Space size="small">
            <IconSettings />
            <span>节点配置 - {currentWorkflow?.name || ''}</span>
            <Tag color="gray">{nodes.length} 个节点</Tag>
          </Space>
        }
        visible={nodeModalVisible}
        onOk={handleNodeSubmit}
        onCancel={() => setNodeModalVisible(false)}
        confirmLoading={nodeSaving}
        okText="保存配置"
        cancelText="取消"
        maskClosable={false}
        style={{ width: 980 }}
      >
        <div className="appr-flow-grid">
          {/* 左侧：节点列表 */}
          <div className="appr-flow-col appr-flow-col--left">
            <div className="appr-flow-col-head">
              <Text bold style={{ fontSize: 13 }}>节点列表</Text>
              <Button
                size="mini"
                type="primary"
                icon={<IconPlus />}
                onClick={addNode}
              />
            </div>
            {nodes.length === 0 ? (
              <Empty description="暂无节点" style={{ marginTop: 40 }} />
            ) : (
              <div className="appr-node-list">
                {nodes.map((node, index) => {
                  const meta = getNodeTypeMeta(node.type);
                  const isActive = activeNodeKey === node.nodeKey;
                  return (
                    <div
                      key={node.nodeKey}
                      className={`appr-node-item${isActive ? ' appr-node-item--active' : ''}`}
                    >
                      {/* 选中该节点用 <button> 承载，保证键盘可达（WCAG SC 2.1.1）；
                          不给整张卡加 role="button"，以免与下方操作按钮形成「可聚焦后代嵌套」 */}
                      <button
                        type="button"
                        className="lx-clickable appr-node-hit"
                        onClick={() => setActiveNodeKey(node.nodeKey)}
                      >
                      <div className="appr-node-row">
                        <span className="appr-node-num">{index + 1}</span>
                        <Text style={{ fontSize: 12, fontWeight: 500 }}>{node.name}</Text>
                      </div>
                      <div className="appr-node-sub">
                        <Text style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>{meta.label}</Text>
                      </div>
                      </button>
                      <div className="appr-node-actions">
                        <Button
                          size="mini"
                          type="text"
                          icon={<IconArrowUp />}
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveNode(index, 'up');
                          }}
                          style={{ padding: '0 4px' }}
                        />
                        <Button
                          size="mini"
                          type="text"
                          icon={<IconArrowDown />}
                          disabled={index === nodes.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveNode(index, 'down');
                          }}
                          style={{ padding: '0 4px' }}
                        />
                        <Button
                          size="mini"
                          type="text"
                          status="danger"
                          icon={<IconDelete />}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNode(node.nodeKey);
                          }}
                          style={{ padding: '0 4px' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 中间：流程预览 */}
          <div className="appr-flow-col">
            <Text bold className="appr-flow-col-title">流程预览</Text>
            <div className="appr-flow-stage">
              <div className="appr-flow-cap appr-flow-cap--start">开始</div>

              {nodes.length === 0 ? (
                <>
                  <div className="appr-flow-arrow">↓</div>
                  <Empty description="点击左侧 + 添加节点" style={{ marginTop: 20 }} />
                </>
              ) : (
                nodes.map((node, index) => {
                  const meta = getNodeTypeMeta(node.type);
                  return (
                    <div
                      key={node.nodeKey}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <div className="appr-flow-arrow">↓</div>
                      <button
                        type="button"
                        className={`lx-clickable appr-flow-node${
                          activeNodeKey === node.nodeKey ? ' appr-flow-node--active' : ''
                        }`}
                        onClick={() => setActiveNodeKey(node.nodeKey)}
                      >
                        <div className="appr-flow-node-head">
                          <span className="appr-flow-node-icon">{meta.icon}</span>
                          <Text bold style={{ fontSize: 12 }}>
                            {node.name}
                          </Text>
                        </div>
                        <Text style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>
                          {meta.label} · 第 {index + 1} 节点
                        </Text>
                      </button>
                    </div>
                  );
                })
              )}

              <div className="appr-flow-arrow">↓</div>
              <div className="appr-flow-cap appr-flow-cap--end">结束</div>
            </div>
          </div>

          {/* 右侧：节点配置 */}
          <div className="appr-flow-col appr-flow-col--right">
            <Text bold className="appr-flow-col-title">
              节点配置
            </Text>
            {!activeNode ? (
              <Empty description="选择左侧节点" style={{ marginTop: 60 }} />
            ) : (
              <div className="appr-flow-form">
                <Form.Item label="节点名称" style={{ marginBottom: 0 }}>
                  <Input
                    value={activeNode.name}
                    onChange={(v) => updateNode(activeNode.nodeKey, { name: v })}
                    size="small"
                  />
                </Form.Item>

                <Form.Item label="审批类型" style={{ marginBottom: 0 }}>
                  <Select
                    value={activeNode.type}
                    onChange={(v) => updateNode(activeNode.nodeKey, { type: v })}
                    size="small"
                    style={{ width: '100%' }}
                  >
                    {NODE_TYPE_OPTIONS.map((opt) => (
                      <Option key={opt.value} value={opt.value}>
                        <Space size="small">
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </Space>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Text style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>
                  {getNodeTypeMeta(activeNode.type).desc}
                </Text>

                {activeNode.type === 'role' && (
                  <Form.Item label="角色编码" style={{ marginBottom: 0 }}>
                    <Input
                      value={activeNode.roleCode || ''}
                      onChange={(v) => updateNode(activeNode.nodeKey, { roleCode: v })}
                      placeholder="如：admin、manager、hr"
                      size="small"
                    />
                  </Form.Item>
                )}

                {activeNode.type === 'group' && (
                  <Form.Item label="审批组 ID" style={{ marginBottom: 0 }}>
                    <InputNumber
                      value={activeNode.approvalGroupId}
                      onChange={(v) =>
                        updateNode(activeNode.nodeKey, { approvalGroupId: v as number })
                      }
                      style={{ width: '100%' }}
                      placeholder="审批组 ID"
                      size="small"
                    />
                  </Form.Item>
                )}

                <Divider style={{ margin: '4px 0' }} />

                <div>
                  <Text style={{ fontSize: 12, color: 'var(--lx-text-3)', fontWeight: 500 }}>
                    高级配置
                  </Text>
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Form.Item label="条件字段（可选）" style={{ marginBottom: 0 }}>
                      <Input
                        value={activeNode.conditionField || ''}
                        onChange={(v) => updateNode(activeNode.nodeKey, { conditionField: v })}
                        placeholder="如：amount、days"
                        size="small"
                      />
                    </Form.Item>
                    <Form.Item label="条件运算符" style={{ marginBottom: 0 }}>
                      <Select
                        value={activeNode.conditionOperator || ''}
                        onChange={(v) => updateNode(activeNode.nodeKey, { conditionOperator: v })}
                        size="small"
                        allowClear
                        placeholder="选择比较方式"
                      >
                        <Option value="gt">{'大于 (>)'}</Option>
                        <Option value="gte">{'大于等于 (>=)'}</Option>
                        <Option value="lt">{'小于 (<)'}</Option>
                        <Option value="lte">{'小于等于 (<=)'}</Option>
                        <Option value="eq">等于 (==)</Option>
                        <Option value="neq">不等于 (!=)</Option>
                      </Select>
                    </Form.Item>
                    <Form.Item label="条件值" style={{ marginBottom: 0 }}>
                      <Input
                        value={activeNode.conditionValue || ''}
                        onChange={(v) => updateNode(activeNode.nodeKey, { conditionValue: v })}
                        placeholder="如：1000、3"
                        size="small"
                      />
                    </Form.Item>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
