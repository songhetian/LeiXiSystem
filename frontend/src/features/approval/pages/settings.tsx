'use client';

import { useState, useEffect } from 'react';
import {
  Table,
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
import DataState from '@/components/DataState';
import { ConfirmButton } from '@/components/ConfirmButton';
import { approvalApi, Workflow, WorkflowNode } from '@/services/approval';
import { notifyError } from '@/lib/request';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

const { Option } = Select;
const { Text } = Typography;

const MODULE_OPTIONS = [
  { label: '报销', value: 'reimbursement' },
  { label: '请假', value: 'leave' },
  { label: '加班', value: 'overtime' },
  { label: '采购', value: 'procurement' },
  { label: '通用', value: 'general' },
];

const NODE_TYPE_OPTIONS = [
  { label: '角色审批', value: 'role', icon: <IconTag />, desc: '指定角色的用户可审批' },
  { label: '审批组', value: 'group', icon: <IconApps />, desc: '从审批组中选择审批人' },
  { label: '部门主管', value: 'department_manager', icon: <IconUserGroup />, desc: '申请人的部门主管审批' },
  { label: '申请人', value: 'initiator', icon: <IconUser />, desc: '申请人本人确认节点' },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'gray' },
  active: { label: '启用', color: 'green' },
  inactive: { label: '停用', color: 'red' },
};

function getNodeTypeMeta(type: string) {
  return NODE_TYPE_OPTIONS.find((o) => o.value === type) || NODE_TYPE_OPTIONS[0];
}

export default function ApprovalSettingsPage() {
  const { can } = usePermission();
  const { data, loading, error, run: runFetch, setData } = useFetchState<Workflow[]>([]);

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

  const fetchList = async () => {
    await runFetch(async () => {
      const res = await approvalApi.listWorkflows();
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取审批流程列表失败');
    });
  };

  useEffect(() => {
    fetchList();
  }, []);

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
      module: record.module,
      status: record.status,
    });
    setBaseModalVisible(true);
  };

  const handleBaseSubmit = async () => {
    try {
      const values = await baseForm.validate();
      setBaseSaving(true);

      let res;
      if (editingBase) {
        res = await approvalApi.updateWorkflow(editingBase.id, values);
      } else {
        res = await approvalApi.createWorkflow({ ...values, nodes: [] });
      }

      if (res.code === 0) {
        Message.success(editingBase ? '更新成功' : '创建成功');
        setBaseModalVisible(false);
        fetchList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e: any) {
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
        fetchList();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e: any) {
      notifyError(e, '保存失败');
    } finally {
      setNodeSaving(false);
    }
  };

  const handleDelete = async (record: Workflow) => {
    const res = await approvalApi.deleteWorkflow(record.id);
    if (res.code === 0) {
      Message.success('删除成功');
      fetchList();
    } else {
      Message.error(res.message || '删除失败');
    }
  };

  const activeNode = nodes.find((n) => n.nodeKey === activeNodeKey) || null;

  const columns = [
    { title: '流程名称', dataIndex: 'name', width: 200 },
    { title: '编码', dataIndex: 'code', width: 150 },
    {
      title: '适用模块',
      dataIndex: 'module',
      width: 120,
      render: (v: string) => MODULE_OPTIONS.find((m) => m.value === v)?.label || v,
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
      render: (v: string) => (
        <Tag color={STATUS_MAP[v]?.color || 'gray'}>{STATUS_MAP[v]?.label || v}</Tag>
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 260,
      render: (_: any, record: Workflow) => (
        <Space size="mini">
          <Button
            size="small"
            type="text"
            icon={<IconEdit />}
            disabled={!can('approval:workflow:manage')}
            onClick={() => openEditBase(record)}
          >
            编辑信息
          </Button>
          <Button
            size="small"
            type="text"
            icon={<IconSettings />}
            disabled={!can('approval:workflow:manage')}
            onClick={() => openNodeConfig(record)}
          >
            配置节点
          </Button>
          <ConfirmButton
            size="small"
            type="text"
            status="danger"
            disabled={!can('approval:workflow:manage')}
            title="确认删除"
            content={`确定要删除审批流程「${record.name}」吗？`}
            onConfirm={() => handleDelete(record)}
          >
            删除
          </ConfirmButton>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="审批流程设置"
      subTitle="配置各业务模块的审批流程和节点"
    >
      <Card style={{ marginTop: 16 }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>审批流列表</div>
          <Button
            type="primary"
            icon={<IconPlus />}
            disabled={!can('approval:workflow:manage')}
            onClick={openCreateBase}
          >
            新建审批流程
          </Button>
        </div>
        <DataState loading={loading} error={error} onRetry={fetchList} isEmpty={!data || data.length === 0}>
          <Table
            columns={columns}
            data={data || []}
            rowKey="id"
            pagination={{ pageSize: 20, showTotal: true }}
          />
        </DataState>
      </Card>

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
          <Form.Item label="流程编码" field="code" rules={[{ required: true, message: '请输入流程编码' }]}>
            <Input placeholder="英文唯一标识" disabled={!!editingBase} />
          </Form.Item>
          <Form.Item label="适用模块" field="module" rules={[{ required: true, message: '请选择适用模块' }]}>
            <Select placeholder="请选择适用模块">
              {MODULE_OPTIONS.map((m) => (
                <Option key={m.value} value={m.value}>
                  {m.label}
                </Option>
              ))}
            </Select>
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
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', minHeight: 480 }}>
          {/* 左侧：节点列表 */}
          <div style={{ borderRight: '1px solid var(--color-border-2)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {nodes.map((node, index) => {
                  const meta = getNodeTypeMeta(node.type);
                  const isActive = activeNodeKey === node.nodeKey;
                  return (
                    <div
                      key={node.nodeKey}
                      onClick={() => setActiveNodeKey(node.nodeKey)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: `1px solid ${isActive ? 'var(--color-primary-light-3)' : 'var(--color-border-2)'}`,
                        backgroundColor: isActive ? 'var(--color-primary-light-1)' : 'var(--color-bg-2)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary-light-3)',
                            color: 'var(--color-primary-5)',
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {index + 1}
                        </span>
                        <Text style={{ fontSize: 12, fontWeight: 500 }}>{node.name}</Text>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 26 }}>
                        <Text style={{ fontSize: 11, color: 'var(--color-text-3)' }}>{meta.label}</Text>
                      </div>
                      <div style={{ display: 'flex', gap: 2, marginTop: 6, paddingLeft: 26 }}>
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
          <div style={{ padding: 16, backgroundColor: 'var(--color-bg-1)' }}>
            <Text bold style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>流程预览</Text>
            <div
              style={{
                padding: '16px 8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                minHeight: 380,
              }}
            >
              <div
                style={{
                  width: 100,
                  padding: '8px 12px',
                  borderRadius: 6,
                  backgroundColor: 'var(--color-success-light-1)',
                  border: '1px solid var(--color-success-light-3)',
                  color: 'var(--color-success-6)',
                  textAlign: 'center',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                开始
              </div>

              {nodes.length === 0 ? (
                <>
                  <div style={{ color: 'var(--color-border-3)', fontSize: 20 }}>↓</div>
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
                      <div style={{ color: 'var(--color-border-3)', fontSize: 16, lineHeight: 1.5 }}>↓</div>
                      <div
                        onClick={() => setActiveNodeKey(node.nodeKey)}
                        style={{
                          width: 160,
                          padding: '10px 12px',
                          borderRadius: 8,
                          backgroundColor:
                            activeNodeKey === node.nodeKey
                              ? 'var(--color-primary-light-1)'
                              : 'var(--color-bg-2)',
                          border: `1.5px solid ${
                            activeNodeKey === node.nodeKey
                              ? 'var(--color-primary-5)'
                              : 'var(--color-border-2)'
                          }`,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s',
                          boxShadow:
                            activeNodeKey === node.nodeKey
                              ? '0 4px 12px rgba(var(--primary-6), 0.15)'
                              : 'none',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            marginBottom: 2,
                          }}
                        >
                          <span style={{ color: 'var(--color-primary-5)', fontSize: 12 }}>
                            {meta.icon}
                          </span>
                          <Text bold style={{ fontSize: 12 }}>
                            {node.name}
                          </Text>
                        </div>
                        <Text style={{ fontSize: 10, color: 'var(--color-text-3)' }}>
                          {meta.label} · 第 {index + 1} 节点
                        </Text>
                      </div>
                    </div>
                  );
                })
              )}

              <div style={{ color: 'var(--color-border-3)', fontSize: 20, lineHeight: 1.5 }}>↓</div>
              <div
                style={{
                  width: 100,
                  padding: '8px 12px',
                  borderRadius: 6,
                  backgroundColor: 'var(--color-info-light-1)',
                  border: '1px solid var(--color-info-light-3)',
                  color: 'var(--color-info-6)',
                  textAlign: 'center',
                  fontWeight: 500,
                  fontSize: 12,
                }}
              >
                结束
              </div>
            </div>
          </div>

          {/* 右侧：节点配置 */}
          <div style={{ borderLeft: '1px solid var(--color-border-2)', padding: 16 }}>
            <Text bold style={{ fontSize: 13, marginBottom: 12, display: 'block' }}>
              节点配置
            </Text>
            {!activeNode ? (
              <Empty description="选择左侧节点" style={{ marginTop: 60 }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

                <Text style={{ fontSize: 11, color: 'var(--color-text-3)' }}>
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
                  <Text style={{ fontSize: 11, color: 'var(--color-text-3)', fontWeight: 500 }}>
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
