/**
 * 资产流程定义页面 (黑白视觉最终打磨版)
 *
 * 优化重点：
 * 1. 弹窗底部按钮对齐：极致黑白对比，统一圆角与高度。
 * 2. 交互反馈强化：优化悬浮态与点击态的视觉变化。
 * 3. 架构设计优化：增强拖拽节点的视觉层次。
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Select,
  Space,
  Typography,
  Divider,
  Empty
} from 'antd';
import {
  SyncOutlined,
  PlusOutlined,
  SettingOutlined,
  SearchOutlined,
  ReloadOutlined,
  MenuOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import api from '../../api';
import { toast } from 'sonner';

const { Text } = Typography;
const { Option } = Select;

// --- 样式组件：标准黑底白字按钮（原生 button，避免 AntD hover 样式干扰）---
const BlackButton = ({ children, icon, className = '', onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`bg-black hover:bg-slate-800 active:bg-slate-900 border-none rounded-lg h-10 px-8 flex items-center justify-center gap-2 transition-all shadow-lg shadow-slate-200 text-white font-bold tracking-wide text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {icon && <span className="flex items-center text-white">{icon}</span>}
    <span className="font-bold text-white tracking-wide">{children}</span>
  </button>
);

// --- 样式组件：标准次要按钮（原生 button）---
const SecondaryButton = ({ children, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 rounded-lg h-10 px-8 font-bold text-slate-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {children}
  </button>
);

const WorkflowSettings = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [searchText, setSearchText] = useState('');

  const [form] = Form.useForm();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const response = await api.get('/approval-workflow', { params: { type: 'asset_request' } });
      if (response.data.success) {
        setWorkflows(response.data.data);
      }
    } catch (error) {
      console.error('获取流程失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorkflow = () => {
    setCurrentWorkflow(null);
    form.resetFields();
    form.setFieldsValue({ status: 'active', is_default: false });
    setIsEditModalOpen(true);
  };

  const handleEditWorkflow = (record) => {
    setCurrentWorkflow(record);
    form.setFieldsValue(record);
    setIsEditModalOpen(true);
  };

  const handleDeleteWorkflow = (record) => {
    Modal.confirm({
      title: '确认删除该流程模型？',
      icon: <ExclamationCircleOutlined className="text-rose-500" />,
      content: '该操作不可撤销。默认生效流程不可删除。',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const res = await api.delete(`/approval-workflow/${record.id}`);
          if (res.data.success) {
            toast.success('删除成功');
            fetchWorkflows();
          }
        } catch (e) {
          toast.error(e.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleSaveWorkflow = async (values) => {
    try {
      const payload = { ...values, type: 'asset_request' };
      let res;
      if (currentWorkflow) {
        res = await api.put(`/approval-workflow/${currentWorkflow.id}`, payload);
      } else {
        res = await api.post('/approval-workflow', payload);
      }
      if (res.data.success) {
        toast.success('配置已保存');
        setIsEditModalOpen(false);
        fetchWorkflows();
      }
    } catch (e) { toast.error('保存失败'); }
  };

  const openNodeConfig = async (record) => {
    setCurrentWorkflow(record);
    setLoading(true);
    try {
      const res = await api.get(`/approval-workflow/${record.id}/nodes`);
      if (res.data.success) {
        setNodes(res.data.data.map(n => ({ ...n, dnd_id: `node-${n.id || Math.random()}` })));
        setIsNodeModalOpen(true);
      }
    } catch (e) { toast.error('加载失败'); } finally { setLoading(false); }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(nodes);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setNodes(items);
  };

  const saveNodes = async () => {
    try {
      const payload = nodes.map((n, idx) => ({
        node_name: n.node_name,
        approver_type: n.approver_type,
        node_order: idx + 1
      }));
      const res = await api.post(`/approval-workflow/${currentWorkflow.id}/nodes`, { nodes: payload });
      if (res.data.success) {
        toast.success('架构已更新');
        setIsNodeModalOpen(false);
      }
    } catch (e) { toast.error('保存失败'); }
  };

  const workflowColumns = [
    {
      title: '流程模型名称',
      dataIndex: 'name',
      key: 'name',
      align: 'center',
      render: (text, record) => (
        <div>
          <div className="font-black text-slate-800 text-sm">{text}</div>
          <Text type="secondary" className="text-[10px]">{record.description || '暂无描述'}</Text>
        </div>
      )
    },
    {
      title: '系统状态',
      dataIndex: 'is_default',
      key: 'is_default',
      width: 140,
      align: 'center',
      render: (isDefault) => isDefault ? (
        <div className="bg-[#07C160] text-white text-[11px] font-black px-4 py-1.5 rounded-lg inline-block">生效中</div>
      ) : (
        <div className="bg-slate-300 text-white text-[11px] font-black px-4 py-1.5 rounded-lg inline-block">已就绪</div>
      )
    },
    {
      title: '管理操作',
      key: 'action',
      width: 240,
      align: 'center',
      render: (_, record) => (
        <Space split={<Divider type="vertical" />}>
          <Button type="link" size="small" className="font-bold text-black" onClick={() => openNodeConfig(record)}>配置架构</Button>
          <Button type="link" size="small" className="font-bold text-slate-400" onClick={() => handleEditWorkflow(record)}>属性</Button>
          <Button type="link" size="small" danger className="font-bold" onClick={() => handleDeleteWorkflow(record)} disabled={record.is_default === 1}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50/50">
      <div className="max-w-[1400px] mx-auto mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-black !m-0">资产流程定义</h1>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-bold">Workflow Model Configuration</p>
        </div>
        <BlackButton onClick={handleAddWorkflow} icon={<PlusOutlined />}>新建流程模型</BlackButton>
      </div>

      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b]">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input
              placeholder="搜索模型名称或关键字..."
              variant="borderless"
              className="h-full text-sm font-medium"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </div>
          <button onClick={fetchWorkflows} className="h-[44px] px-6 bg-black text-white hover:bg-slate-800 transition-colors border-none flex items-center justify-center">
            <ReloadOutlined className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <Table columns={workflowColumns} dataSource={workflows.filter(w => w.name.includes(searchText))} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 10, size: 'small' }} />
        </div>
      </div>

      {/* 属性 Modal */}
      <Modal
        title={<div className="font-black text-black text-base">流程属性配置</div>}
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={[
          <div className="flex justify-end gap-3 px-2 pb-2" key="footer">
            <SecondaryButton onClick={() => setIsEditModalOpen(false)}>返回列表</SecondaryButton>
            <BlackButton onClick={() => form.submit()}>确定并保存</BlackButton>
          </div>
        ]}
        width={420}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSaveWorkflow} className="mt-6">
          <Form.Item name="name" label={<span className="text-[10px] font-black text-slate-400 uppercase">模型显示名称</span>} rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="输入名称..." className="rounded-lg h-11 border-slate-300" />
          </Form.Item>
          <Form.Item name="description" label={<span className="text-[10px] font-black text-slate-400 uppercase">备注描述 (选填)</span>}>
            <Input.TextArea rows={3} placeholder="简述用途..." className="rounded-lg border-slate-300" />
          </Form.Item>
          <div className="bg-slate-50 p-4 rounded-xl flex items-center justify-between border border-slate-100">
            <div>
              <span className="font-bold text-slate-700 text-xs">设为全系统生效流程</span>
              <div className="text-[9px] text-slate-400 mt-0.5">启用后将自动覆盖现有资产流程</div>
            </div>
            <Form.Item name="is_default" valuePropName="checked" noStyle><Switch className="bg-slate-300" /></Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 架构 Modal */}
      <Modal
        title={<div className="font-black text-black text-base">审批环节架构设计 - {currentWorkflow?.name}</div>}
        open={isNodeModalOpen}
        onCancel={() => setIsNodeModalOpen(false)}
        width={600}
        footer={[
          <div className="flex justify-end gap-3 px-4 pb-4" key="footer">
            <SecondaryButton onClick={() => setIsNodeModalOpen(false)}>放弃修改</SecondaryButton>
            <BlackButton onClick={saveNodes} className="px-10">应用架构</BlackButton>
          </div>
        ]}
        centered
      >
        <div className="py-4">
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => setNodes([...nodes, { dnd_id: `new-${Date.now()}`, node_name: `新节点`, approver_type: 'dept_manager' }])}
            className="h-14 rounded-xl border-slate-200 text-slate-400 font-bold hover:text-black hover:border-black mb-8 border-2"
          >
            插入审批流节点
          </Button>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="nodes-list">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {nodes.map((node, index) => (
                    <Draggable key={node.dnd_id} draggableId={node.dnd_id} index={index}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.draggableProps}>
                          <div className="bg-white border border-slate-200 rounded-2xl flex items-center p-5 gap-5 shadow-sm hover:border-black hover:shadow-md transition-all">
                            <div {...provided.dragHandleProps} className="text-slate-300 cursor-move hover:text-black">
                              <MenuOutlined style={{ fontSize: 18 }} />
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-5">
                              <div className="flex flex-col gap-1">
                                <Text className="text-[10px] font-black text-slate-400 uppercase">环节名称</Text>
                                <Input
                                  value={node.node_name}
                                  onChange={e => {
                                    const n = [...nodes]; n[index].node_name = e.target.value; setNodes(n);
                                  }}
                                  variant="borderless"
                                  className="font-bold text-slate-800 p-0 h-8 text-base border-b border-transparent focus:border-black rounded-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <Text className="text-[10px] font-black text-slate-400 uppercase">审批人类型</Text>
                                <Select
                                  value={node.approver_type}
                                  onChange={val => {
                                    const n = [...nodes]; n[index].approver_type = val; setNodes(n);
                                  }}
                                  className="w-full text-sm font-bold"
                                  variant="borderless"
                                >
                                  <Option value="dept_manager">部门主管</Option>
                                  <Option value="role">指定角色</Option>
                                  <Option value="user">指定人员</Option>
                                  <Option value="custom_group">特殊组</Option>
                                </Select>
                              </div>
                            </div>
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setNodes(nodes.filter((_, i) => i !== index))} className="hover:bg-rose-50" />
                          </div>
                          {index < nodes.length - 1 && (
                            <div className="flex justify-center py-2 text-slate-200">
                              <ArrowDownOutlined style={{ fontSize: 20 }} />
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </Modal>

      <style>{`
        .ant-table-thead > tr > th { text-align: center !important; background: #f8fafc !important; color: #64748b !important; font-weight: 900 !important; }
        .ant-table-tbody > tr > td { text-align: center !important; }
        .ant-modal-content { border-radius: 24px !important; padding: 24px !important; box-shadow: 0 20px 50px rgba(0,0,0,0.1) !important; }
        .ant-modal-header { margin-bottom: 20px !important; border-bottom: none !important; }
        .ant-modal-footer { border-top: none !important; margin-top: 20px !important; }
        .ant-input:focus, .ant-input-focused { border-color: #000000 !important; box-shadow: none !important; }
        .ant-select-focused:not(.ant-select-disabled).ant-select:not(.ant-select-customize-input) .ant-select-selector { border-color: #000000 !important; box-shadow: none !important; }
        /* 兜底：确保 dashed 按钮 hover 时文字不变白 */
        .ant-btn-dashed:hover { color: #000000 !important; border-color: #000000 !important; background: #ffffff !important; }
      `}</style>
    </div>
  );
};

export default WorkflowSettings;
