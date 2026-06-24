import logger from '@/utils/logger';
/**
 * 审批流程配置页面
 *
 * 功能：
 * - 流程列表管理（卡片/列表视图，支持分页）
 * - 创建/编辑/删除流程
 * - 配置流程节点（拖拽排序，支持用户搜索）
 * - 配置触发条件（角色多选、金额、部门等）
 */

import React, { useState, useEffect } from 'react';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  UserOutlined,
  AppstoreOutlined,
  BarsOutlined,
  SearchOutlined
} from '@ant-design/icons';
import {
  Select,
  Table,
  Pagination,
  Radio,
  Input,
  Tag,
  Space,
  Tooltip,
  Button,
  Empty,
  Modal
} from 'antd';
import { toast } from 'sonner';
import api from '../api';
import { matchPinyin, filterOptionWithPinyin } from '../utils/searchUtils';

const { Option } = Select;
const { TextArea } = Input;

// 审批人类型选项
const APPROVER_TYPES = [
  { value: 'role', label: '指定角色', icon: <TeamOutlined /> },
  { value: 'user', label: '指定用户', icon: <UserOutlined /> },
  { value: 'custom_group', label: '特殊审批组', icon: <TeamOutlined /> },
  { value: 'initiator', label: '发起人确认', icon: <CheckCircleOutlined /> }
];

// 审批人类型显示映射（包含旧类型，用于回显）
const APPROVER_TYPE_MAP = {
  'role': '指定角色',
  'user': '指定用户',
  'custom_group': '特殊审批组',
  'initiator': '发起人确认',
  'department_manager': '部门主管',
  'boss': '老板',
  'finance': '财务'
};

const ApprovalWorkflowConfig = () => {
  // 状态管理
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);

  // 视图与分页
  const [viewMode, setViewMode] = useState('card'); // 'card' | 'list'
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [searchText, setSearchText] = useState('');

  // 编辑与弹窗状态
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);

  // 基础数据
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [customTypes, setCustomTypes] = useState([]);

  useEffect(() => {
    logger.debug('组件挂载，开始加载数据...');
    fetchWorkflows();
    fetchRoles();
    fetchUsers(); // 预加载用户数据，或者在打开节点配置时加载
    fetchCustomTypes();
  }, []);

  // ===================== 数据获取 =====================

    const fetchWorkflows = async () => {
        setLoading(true);
        try {
          const response = await api.get('/approval-workflow');
          logger.debug('审批流程API完整响应:', response);
          logger.debug('审批流程API响应数据:', response.data);
          
          // 处理不同的响应格式
          if (response.data && response.data.success) {
            const data = response.data.data || [];
            logger.debug('设置流程数据:', data);
            setWorkflows(data);
          } else if (Array.isArray(response.data)) {
            // 兼容直接返回数组的情况
            logger.debug('设置流程数据（数组格式）:', response.data);
            setWorkflows(response.data);
          } else if (response.data) {
            // 尝试从响应中提取数据
            const data = response.data.data || response.data;
            if (Array.isArray(data)) {
              logger.debug('设置流程数据（提取）:', data);
              setWorkflows(data);
            } else {
              logger.warn('审批流程API返回格式异常:', response.data);
              toast.error('获取流程列表失败: 数据格式错误');
              setWorkflows([]);
            }
          } else {
            logger.warn('审批流程API返回空响应');
            toast.error('获取流程列表失败: 无数据返回');
            setWorkflows([]);
          }
        } catch (error) {
          logger.error('获取流程列表失败:', error);
          logger.error('错误详情:', error.response?.data);
          toast.error('获取流程列表失败: ' + (error.response?.data?.message || error.message));
          setWorkflows([]);
        } finally {
          setLoading(false);
        }
      };    const fetchRoles = async () => {
      try {
        const response = await api.get('/approvers/available-roles');
        if (response.data.success) {
          setRoles(response.data.data || []);
        } else if (Array.isArray(response.data)) {
          setRoles(response.data);
        }
      } catch (error) {
        logger.error('获取角色列表失败:', error);
      }
    };

    const fetchUsers = async (keyword = '') => {
      try {
        const response = await api.get('/approvers/available-users', {
          params: { keyword }
        });
        if (response.data.success) {
          setUsers(response.data.data || []);
        } else if (Array.isArray(response.data)) {
          setUsers(response.data);
        }
      } catch (error) {
        logger.error('获取用户列表失败:', error);
      }
    };

    const fetchCustomTypes = async () => {
      try {
        const response = await api.get('/approvers');
        const data = response.data.success ? response.data.data : (Array.isArray(response.data) ? response.data : []);
        if (data) {
          const types = [...new Set(data.map(a => a.approver_type))];
          setCustomTypes(types.map(t => ({ value: t, label: t })));
        }
      } catch (error) {
        logger.error('获取自定义审批组失败:', error);
      }
    };

    // ===================== 流程操作 =====================

  const openWorkflowModal = (workflow = null) => {
    if (workflow) {
      setEditingWorkflow({
        ...workflow,
        is_default: !!workflow.is_default, // 强制转换为布尔值，防止显示 1/0
        conditions: typeof workflow.conditions === 'string'
          ? JSON.parse(workflow.conditions || '{}')
          : (workflow.conditions || {})
      });
    } else {
      setEditingWorkflow({
        name: '',
        description: '',
        is_default: false,
        status: 'active',
        conditions: {
          role_ids: [] // 初始化为空数组
        }
      });
    }
    setShowModal(true);
  };

  const saveWorkflow = async () => {
    if (!editingWorkflow.name.trim()) {
      toast.error('请输入流程名称');
      return;
    }

    try {
      const payload = {
        ...editingWorkflow,
        type: 'reimbursement'
      };

      let response;
      if (editingWorkflow.id) {
        response = await api.put(`/approval-workflow/${editingWorkflow.id}`, payload);
      } else {
        response = await api.post('/approval-workflow', payload);
      }

      if (response.data.success) {
        toast.success(editingWorkflow.id ? '更新成功' : '创建成功');
        setShowModal(false);
        fetchWorkflows();
      } else {
        toast.error(response.data.message || '操作失败');
      }
    } catch (error) {
      logger.error('保存流程失败:', error);
      toast.error('保存失败');
    }
  };

  const deleteWorkflow = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此审批流程吗？此操作不可恢复。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await api.delete(`/approval-workflow/${id}`);
          if (response.data.success) {
            toast.success('删除成功');
            fetchWorkflows();
          } else {
            toast.error(response.data.message || '删除失败');
          }
        } catch (error) {
          logger.error('删除流程失败:', error);
          toast.error('删除失败');
        }
      }
    });
  };

  // ===================== 节点操作 =====================

  const openNodeConfig = async (workflow) => {
    setCurrentWorkflow(workflow);
    // 每次打开节点配置时刷新自定义类型，确保最新
    fetchCustomTypes();
    try {
      const response = await api.get(`/approval-workflow/${workflow.id}/nodes`);
      if (response.data.success) {
        setNodes(response.data.data);
      }
    } catch (error) {
      logger.error('获取节点失败:', error);
    }
    setShowNodeModal(true);
  };

  const addNode = () => {
    setNodes([...nodes, {
      node_name: '',
      approver_type: 'role', // 默认选中指定角色
      role_id: null,
      approver_id: null,
      custom_type_name: null,
      approval_mode: 'serial',
      can_skip: false
    }]);
  };

  const updateNode = (index, field, value) => {
    const newNodes = [...nodes];
    newNodes[index][field] = value;

    // 切换类型时清空不相关字段
    if (field === 'approver_type') {
      newNodes[index].role_id = null;
      newNodes[index].approver_id = null;
      newNodes[index].custom_type_name = null;
    }

    setNodes(newNodes);
  };

  const removeNode = (index) => {
    setNodes(nodes.filter((_, i) => i !== index));
  };

  const moveNode = (index, direction) => {
    const newNodes = [...nodes];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= nodes.length) return;
    [newNodes[index], newNodes[targetIndex]] = [newNodes[targetIndex], newNodes[index]];
    setNodes(newNodes);
  };

  const saveNodes = async () => {
    // 验证节点
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.node_name?.trim()) {
        toast.error(`第 ${i + 1} 个节点：请输入节点名称`);
        return;
      }
      if (node.approver_type === 'role' && !node.role_id) {
        toast.error(`第 ${i + 1} 个节点：请选择角色`);
        return;
      }
      if (node.approver_type === 'user' && !node.approver_id) {
        toast.error(`第 ${i + 1} 个节点：请选择用户`);
        return;
      }
      if (node.approver_type === 'custom_group' && !node.custom_type_name) {
        toast.error(`第 ${i + 1} 个节点：请选择特殊审批组类型`);
        return;
      }
    }

    try {
      const response = await api.post(`/approval-workflow/${currentWorkflow.id}/nodes`, {
        nodes
      });
      if (response.data.success) {
        toast.success('节点配置保存成功');
        setShowNodeModal(false);
        fetchWorkflows();
      } else {
        toast.error(response.data.message || '保存失败');
      }
    } catch (error) {
      logger.error('保存节点失败:', error);
      toast.error('保存失败');
    }
  };

  // ===================== 辅助函数 =====================

  const updateCondition = (field, value) => {
    setEditingWorkflow(prev => ({
      ...prev,
      conditions: {
        ...prev.conditions,
        [field]: value
      }
    }));
  };

  // 过滤和分页逻辑
  const filteredWorkflows = workflows.filter(w =>
    matchPinyin(w.name, searchText)
  );

  const currentData = filteredWorkflows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 表格列定义
  const columns = [
    {
      title: '流程名称',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
      render: (text, record) => (
        <Space>
          <span style={{ fontWeight: 600 }}>{text}</span>
          {record.is_default && <Tag color="#667eea">默认</Tag>}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      align: 'center',
      ellipsis: true,
      render: (text) => text || <span style={{ color: '#999' }}>-</span>
    },
    {
      title: '节点数',
      dataIndex: 'node_count',
      key: 'node_count',
      width: 100,
      align: 'center',
      render: (count) => <Tag>{count || 0} 个节点</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<SettingOutlined />} onClick={() => openNodeConfig(record)}>
            节点
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openWorkflowModal(record)}>
            编辑
          </Button>
          {!record.is_default && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteWorkflow(record.id)}>
              删除
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="workflow-config">
      <style>{styles}</style>

      {/* 顶部工具栏 */}
      <div className="page-header">
        <div>
          <h1 className="page-title">审批流程配置</h1>
          <p className="page-subtitle">配置报销审批流程和节点</p>
        </div>
        <Space>
          <Input
            placeholder="搜索流程..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            style={{ width: 200 }}
            onChange={e => setSearchText(e.target.value)}
            allowClear
          />
          <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} buttonStyle="solid">
            <Radio.Button value="card"><AppstoreOutlined /></Radio.Button>
            <Radio.Button value="list"><BarsOutlined /></Radio.Button>
          </Radio.Group>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openWorkflowModal()} className="btn-primary-custom">
            新建流程
          </Button>
        </Space>
      </div>

      {/* 内容区域 */}
      <div className="content-area">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : filteredWorkflows.length === 0 ? (
          <Empty description="暂无审批流程" style={{ padding: '40px 0' }} />
        ) : (
          <>
            {viewMode === 'card' ? (
              <div className="workflow-grid">
                {currentData.map(workflow => (
                  <div key={workflow.id} className={`workflow-card ${workflow.is_default ? 'default' : ''}`}>
                    <div className="card-header">
                      <div className="card-title">
                        {workflow.name}
                        {workflow.is_default && <span className="default-badge">默认</span>}
                      </div>
                      <div className="card-status">
                        {workflow.status === 'active' ? (
                          <Tag color="#ecfdf5" style={{ color: '#059669', border: 0, margin: 0 }}>启用</Tag>
                        ) : (
                          <Tag color="#f3f4f6" style={{ color: '#6b7280', border: 0, margin: 0 }}>停用</Tag>
                        )}
                      </div>
                    </div>

                    <div className="card-desc" title={workflow.description}>
                      {workflow.description || '暂无描述'}
                    </div>

                    <div className="card-meta">
                      <Tag>{workflow.node_count || 0} 个节点</Tag>
                      {workflow.conditions && Object.keys(workflow.conditions).length > 0 && (
                        <Tag color="warning">有触发条件</Tag>
                      )}
                    </div>

                    <div className="card-actions">
                      <button className="action-btn" onClick={() => openNodeConfig(workflow)}>
                        <SettingOutlined /> 配置节点
                      </button>
                      <button className="action-btn" onClick={() => openWorkflowModal(workflow)}>
                        <EditOutlined /> 编辑
                      </button>
                      {!workflow.is_default && (
                        <button className="action-btn delete" onClick={() => deleteWorkflow(workflow.id)}>
                          <DeleteOutlined /> 删除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="workflow-table-wrapper">
                <Table
                  columns={columns}
                  dataSource={currentData}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                />
              </div>
            )}

            {/* 分页器 */}
            <div className="pagination-wrapper">
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredWorkflows.length}
                onChange={(page, size) => {
                  setCurrentPage(page);
                  setPageSize(size);
                }}
                showSizeChanger
                showTotal={(total) => `共 ${total} 条流程`}
              />
            </div>
          </>
        )}
      </div>

      {/* 流程编辑弹窗 */}
      <Modal
        title={editingWorkflow?.id ? '编辑流程' : '新建流程'}
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={saveWorkflow}
        width={650}
        centered
        okText="保存"
        cancelText="取消"
        okButtonProps={{ className: 'btn-primary-custom' }}
      >
        {editingWorkflow && (
          <div className="modal-form">
            <div className="form-group">
              <label className="form-label required">流程名称</label>
              <Input
                value={editingWorkflow.name}
                onChange={e => setEditingWorkflow({ ...editingWorkflow, name: e.target.value })}
                placeholder="如：普通员工报销流程"
              />
            </div>

            <div className="form-group">
              <label className="form-label">流程描述</label>
              <TextArea
                rows={3}
                value={editingWorkflow.description || ''}
                onChange={e => setEditingWorkflow({ ...editingWorkflow, description: e.target.value })}
                placeholder="描述此流程的适用场景..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">状态</label>
                <Select
                  value={editingWorkflow.status}
                  onChange={value => setEditingWorkflow({ ...editingWorkflow, status: value })}
                  style={{ width: '100%' }}
                >
                  <Option value="active">启用</Option>
                  <Option value="inactive">停用</Option>
                </Select>
              </div>
              <div className="form-group">
                <label className="form-label">是否设为默认</label>
                <Select
                  value={editingWorkflow.is_default}
                  onChange={value => setEditingWorkflow({ ...editingWorkflow, is_default: value })}
                  style={{ width: '100%' }}
                >
                  <Option value={false}>否 - 需满足条件触发</Option>
                  <Option value={true}>是 - 作为兜底流程</Option>
                </Select>
              </div>
            </div>

            <div className="condition-section">
              <h4 className="section-title">触发条件配置</h4>
              <p className="section-hint">当报销申请满足以下条件时，将自动匹配使用此流程</p>

              <div className="condition-grid">
                <div className="condition-item">
                  <label>金额大于 (元)</label>
                  <Input
                    type="number"
                    value={editingWorkflow.conditions?.amount_greater_than || ''}
                    onChange={e => updateCondition('amount_greater_than', e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="如: 5000"
                    suffix="RMB"
                  />
                </div>

                <div className="condition-item">
                  <label>部门主管专用</label>
                  <Select
                    value={editingWorkflow.conditions?.is_department_manager === true ? 'true' :
                           editingWorkflow.conditions?.is_department_manager === false ? 'false' : ''}
                    onChange={value => updateCondition('is_department_manager',
                      value === '' ? undefined : value === 'true')}
                    style={{ width: '100%' }}
                  >
                    <Option value="">不限</Option>
                    <Option value="true">仅部门主管</Option>
                    <Option value="false">仅非主管</Option>
                  </Select>
                </div>

                <div className="condition-item full">
                  <label>适用角色 (多选)</label>
                  <Select
                    mode="multiple"
                    allowClear
                    style={{ width: '100%' }}
                    placeholder="请选择适用的角色"
                    value={editingWorkflow.conditions?.role_ids || []}
                    onChange={values => updateCondition('role_ids', values.length > 0 ? values : undefined)}
                    optionFilterProp="children"
                    maxTagCount="responsive"
                  >
                    {roles.map(role => (
                      <Option key={role.id} value={role.id}>{role.name}</Option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 节点配置弹窗 */}
      <Modal
        title={`配置节点 - ${currentWorkflow?.name || ''}`}
        open={showNodeModal}
        onCancel={() => setShowNodeModal(false)}
        onOk={saveNodes}
        width={800}
        centered
        okText="保存配置"
        cancelText="取消"
        okButtonProps={{ className: 'btn-primary-custom' }}
      >
        <div className="node-list-container">
          <div className="node-list">
            {nodes.map((node, index) => (
              <div key={index} className="node-item">
                <div className="node-order">{index + 1}</div>

                <div className="node-form">
                  <Input
                    placeholder="节点名称"
                    value={node.node_name}
                    onChange={e => updateNode(index, 'node_name', e.target.value)}
                    style={{ width: '25%' }}
                  />

                  <Select
                    value={node.approver_type}
                    onChange={value => updateNode(index, 'approver_type', value)}
                    style={{ width: '30%' }}
                    placeholder="请选择类型"
                  >
                    {APPROVER_TYPES.map(type => (
                      <Option key={type.value} value={type.value}>
                        <Space>{type.icon} {type.label}</Space>
                      </Option>
                    ))}
                    {/* 如果当前值不在选项中(旧数据)，强制添加一个隐藏的选项用于显示 label */}
                    {node.approver_type && !APPROVER_TYPES.find(t => t.value === node.approver_type) && (
                      <Option key={node.approver_type} value={node.approver_type} disabled>
                        {APPROVER_TYPE_MAP[node.approver_type] || node.approver_type}
                      </Option>
                    )}
                  </Select>

                  {/* 只有选择了特定类型时才显示后续选择框 */}
                  <div style={{ flex: 1 }}>
                    {node.approver_type === 'role' && (
                      <Select
                        placeholder="请选择角色"
                        showSearch
                        filterOption={filterOptionWithPinyin}
                        value={node.role_id}
                        onChange={value => updateNode(index, 'role_id', value)}
                        style={{ width: '100%' }}
                      >
                        {roles.map(role => (
                          <Option key={role.id} value={role.id}>{role.name}</Option>
                        ))}
                      </Select>
                    )}

                    {node.approver_type === 'user' && (
                      <Select
                        showSearch
                        placeholder="搜索并选择用户"
                        filterOption={filterOptionWithPinyin}
                        value={node.approver_id}
                        onChange={value => updateNode(index, 'approver_id', value)}
                        style={{ width: '100%' }}
                        options={users.map(user => ({
                          value: user.id,
                          label: `${user.real_name} (${user.username})`
                        }))}
                      />
                    )}

                    {node.approver_type === 'custom_group' && (
                      <Select
                        placeholder="请选择审批组类型"
                        showSearch
                        filterOption={filterOptionWithPinyin}
                        value={node.custom_type_name}
                        onChange={value => updateNode(index, 'custom_type_name', value)}
                        style={{ width: '100%' }}
                        options={customTypes}
                      />
                    )}
                  </div>
                </div>

                <div className="node-actions">
                  <Tooltip title="上移">
                    <Button
                      size="small"
                      icon={<ArrowUpOutlined />}
                      onClick={() => moveNode(index, -1)}
                      disabled={index === 0}
                    />
                  </Tooltip>
                  <Tooltip title="下移">
                    <Button
                      size="small"
                      icon={<ArrowDownOutlined />}
                      onClick={() => moveNode(index, 1)}
                      disabled={index === nodes.length - 1}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeNode(index)}
                    />
                  </Tooltip>
                </div>
              </div>
            ))}

            <Button type="dashed" block icon={<PlusOutlined />} onClick={addNode} style={{ marginTop: 12, height: 48 }}>
              添加审批节点
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const styles = `
  .workflow-config {
    padding: 24px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  .page-title {
    font-size: 22px;
    font-weight: 600;
    color: #1a1a2e;
    margin: 0;
  }
  .page-subtitle {
    font-size: 14px;
    color: #888;
    margin: 4px 0 0 0;
  }

  /* 列表视图样式 */
  .workflow-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 24px;
  }
  .workflow-card {
    background: white;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    border: 1px solid #f3f4f6;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
  }
  .workflow-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
    border-color: #e5e7eb;
  }
  .workflow-card.default {
    border: 2px solid #667eea;
  }
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 18px;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .default-badge {
    font-size: 11px;
    padding: 2px 8px;
    background: #667eea;
    color: white;
    border-radius: 999px;
    font-weight: 500;
  }
  .card-desc {
    font-size: 14px;
    color: #6b7280;
    margin-bottom: 20px;
    line-height: 1.5;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .card-meta {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 20px;
    padding-top: 16px;
    border-top: 1px solid #f3f4f6;
  }
  .card-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }
  .action-btn {
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    font-size: 13px;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s;
  }
  .action-btn:hover {
    background: #f9fafb;
    border-color: #d1d5db;
    color: #111827;
  }
  .action-btn.delete:hover {
    background: #fef2f2;
    color: #dc2626;
    border-color: #fecaca;
  }

  /* 表格视图样式修正 */
  .workflow-table-wrapper {
    background: white;
    padding: 16px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }

  /* 通用样式 */
  .btn-primary-custom {
    background-color: #667eea !important;
    border-color: #667eea !important;
  }
  .btn-primary-custom:hover {
    background-color: #5a6fd1 !important;
    border-color: #5a6fd1 !important;
  }

  .pagination-wrapper {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
  }

  /* 弹窗样式优化 */
  .modal-form {
    padding: 10px 0;
  }
  .form-group {
    margin-bottom: 20px;
  }
  .form-row {
    display: flex;
    gap: 20px;
  }
  .form-row .form-group {
    flex: 1;
  }
  .form-label {
    display: block;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
  }
  .form-label.required::after {
    content: '*';
    color: #ef4444;
    margin-left: 4px;
  }

  .condition-section {
    background: #f8fafc;
    padding: 20px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-top: 10px;
  }
  .section-title {
    font-size: 15px;
    font-weight: 600;
    margin: 0 0 4px 0;
  }
  .section-hint {
    font-size: 13px;
    color: #64748b;
    margin: 0 0 16px 0;
  }
  .condition-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .condition-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* 节点列表 */
  .node-list-container {
    max-height: 60vh;
    overflow-y: auto;
    padding-right: 8px;
  }
  .node-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    margin-bottom: 12px;
    transition: all 0.2s;
  }
  .node-item:hover {
    border-color: #cbd5e1;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .node-order {
    width: 28px;
    height: 28px;
    background: #667eea;
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 13px;
    flex-shrink: 0;
  }
  .node-form {
    flex: 1;
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .node-form .ant-select {
    font-size: 13px;
  }
  .node-form .ant-select-selector {
    border-radius: 8px !important;
    border: 1px solid #e2e8f0 !important;
    background: white !important;
  }
  .node-form .ant-select-selector:hover {
    border-color: #cbd5e1 !important;
  }
  .node-form .ant-select-focused .ant-select-selector {
    border-color: #667eea !important;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1) !important;
  }
  .node-form .ant-input {
    border-radius: 8px !important;
    border: 1px solid #e2e8f0 !important;
    font-size: 13px;
  }
  .node-form .ant-input:hover {
    border-color: #cbd5e1 !important;
  }
  .node-form .ant-input:focus {
    border-color: #667eea !important;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1) !important;
  }
  .node-actions {
    display: flex;
    gap: 4px;
  }
`;

export default ApprovalWorkflowConfig;
