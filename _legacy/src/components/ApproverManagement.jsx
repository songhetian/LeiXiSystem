/**
 * 审批权限管理页面 (极致紧凑块模式版)
 * 
 * 核心设计：
 * 1. 块状回归：恢复用户偏好的块模式，但通过极简设计解决“乱”的问题。
 * 2. 雷犀标准：搜索栏严格锁定 44px、单行铺满、边框 #64748b。
 * 3. 逻辑守护：完整支持多选、金额区间、部门过滤。
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlusOutlined,
  UserOutlined,
  SearchOutlined,
  CloseOutlined,
  SwapRightOutlined,
  SafetyOutlined,
  FilterOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  TeamOutlined,
  CheckCircleFilled
} from '@ant-design/icons';
import {
  Button,
  Input,
  Select,
  Modal,
  Tag,
  Space,
  AutoComplete,
  Form,
  Checkbox,
  InputNumber,
  Avatar,
  Tooltip,
  Divider,
  Empty
} from 'antd';
import { toast } from 'sonner';
import api from '../api';
import { filterOptionWithPinyin } from '../utils/searchUtils';

const ApproverManagement = () => {
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  const [form] = Form.useForm();

  useEffect(() => {
    fetchApprovers();
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchApprovers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/approvers');
      if (response.data.success) setApprovers(response.data.data);
    } catch (error) {
      toast.error('数据同步失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/approvers/available-users');
      if (response.data.success) setUsers(response.data.data);
    } catch (e) {}
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments', { params: { forManagement: true } });
      if (Array.isArray(response.data)) setDepartments(response.data);
      else if (response.data.success) setDepartments(response.data.data);
    } catch (e) {}
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const { user_id, ...otherValues } = values;
      const payloadBase = {
        ...otherValues,
        department_scope: values.department_scope?.length > 0 ? values.department_scope : null,
        amount_min: values.amount_min || 0,
        amount_limit: values.amount_limit || null
      };

      const userIds = Array.isArray(user_id) ? user_id : [user_id];
      let successCount = 0;
      setLoading(true);
      for (const uid of userIds) {
        try {
          const res = await api.post('/approvers', { ...payloadBase, user_id: uid });
          if (res.data.success) successCount++;
        } catch (e) {}
      }

      if (successCount > 0) {
        toast.success(`已成功增补 ${successCount} 名成员`);
        setShowModal(false);
        fetchApprovers();
      }
    } catch (error) {} finally { setLoading(false); }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: '移除确认',
      content: '该成员将失去此组的审批权限',
      okText: '确认移除',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        const res = await api.delete(`/approvers/${id}`);
        if (res.data.success) {
          toast.success('已移除');
          fetchApprovers();
        }
      }
    });
  };

  // 分组逻辑
  const groupedData = useMemo(() => {
    const groups = {};
    approvers.forEach(a => {
      if (statusFilter === 'active' && !a.is_active) return;
      if (!groups[a.approver_type]) groups[a.approver_type] = { type: a.approver_type, members: [] };
      groups[a.approver_type].members.push(a);
    });
    let result = Object.values(groups);
    if (searchText) {
      result = result.filter(g => g.type.includes(searchText) || g.members.some(m => m.user_name.includes(searchText)));
    }
    return result;
  }, [approvers, searchText, statusFilter]);

  return (
    <div className="p-6 md:p-8 min-h-screen bg-slate-50/30">
      <div className="max-w-[1400px] mx-auto">
        {/* 顶部标题与新建按钮 */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md">
              <SafetyOutlined className="text-white text-base" />
            </div>
            <h1 className="text-lg font-black text-slate-800 !m-0">权限配置中心</h1>
          </div>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => {
              form.resetFields();
              form.setFieldsValue({ amount_min: 0, is_active: true });
              setShowModal(true);
            }}
            className="rounded-lg font-bold bg-indigo-600 border-none px-6 h-9 text-xs"
          >
            新建审批组
          </Button>
        </div>

        {/* 雷犀标准：44px 物理缝合搜索栏 */}
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b] mb-8">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input 
              placeholder="快速查找审批组或人员姓名..." 
              variant="borderless"
              className="h-full text-sm font-medium"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="w-48 flex items-center h-[44px] px-4 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">状态</span>
            <Select 
              value={statusFilter} 
              onChange={setStatusFilter}
              variant="borderless"
              className="w-full text-xs font-bold text-slate-700"
              options={[{ value: 'active', label: '仅看启用' }, { value: 'all', label: '显示全部' }]}
            />
          </div>
          <button 
            onClick={fetchApprovers}
            className="h-[44px] px-5 bg-white hover:bg-slate-50 transition-colors border-l border-slate-200 text-slate-400 hover:text-indigo-600"
          >
            <ReloadOutlined className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* 极致紧凑块流 */}
        {groupedData.length > 0 ? (
          <div className="space-y-6">
            {groupedData.map(group => (
              <div key={group.type} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                {/* 组标题：紧凑型 */}
                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-indigo-50 flex items-center justify-center">
                      <TeamOutlined className="text-indigo-600 text-xs" />
                    </div>
                    <span className="text-sm font-black text-slate-800">{group.type}</span>
                    <span className="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {group.members.length} 人
                    </span>
                  </div>
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<PlusOutlined />} 
                    className="text-[11px] font-bold text-indigo-600 p-0"
                    onClick={() => {
                      form.resetFields();
                      form.setFieldsValue({ approver_type: group.type, amount_min: 0, is_active: true });
                      setShowModal(true);
                    }}
                  >
                    增补成员
                  </Button>
                </div>

                {/* 成员平铺：紧凑块 */}
                <div className="p-3 flex flex-wrap gap-3">
                  {group.members.map(member => (
                    <div 
                      key={member.id} 
                      className="group flex items-center gap-3 p-2 bg-slate-50/50 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-white transition-all min-w-[200px]"
                    >
                      <Avatar size={28} className="bg-white text-indigo-600 border border-indigo-100 shadow-sm text-[10px] font-bold">
                        {member.user_name?.charAt(0)}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-slate-700 truncate">{member.user_name}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-1 rounded">
                            {parseInt(member.amount_min)} ~ {member.amount_limit ? parseInt(member.amount_limit) : '∞'}
                          </span>
                          {member.department_scope && (
                            <Tooltip title="具有特定部门管辖权限">
                              <CheckCircleFilled className="text-[10px] text-emerald-500" />
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDelete(member.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
                      >
                        <CloseOutlined className="text-[10px]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-32 flex flex-col items-center">
            <Empty description={<span className="text-slate-400 font-bold">未发现权限匹配</span>} />
            <Button type="primary" ghost className="mt-4 rounded-lg border-indigo-200 text-indigo-600 font-bold" onClick={() => setShowModal(true)}>创建首个审批组</Button>
          </div>
        )}
      </div>

      {/* 精致配置弹窗 */}
      <Modal
        title={<div className="font-black text-slate-800 text-sm">配置权限区间</div>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        width={440}
        okText="保存并激活"
        cancelText="取消"
        centered
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="approver_type" label={<span className="text-[10px] font-black text-slate-400 uppercase">组名称</span>} rules={[{ required: true }]}>
            <AutoComplete 
              options={useMemo(() => [...new Set(approvers.map(a => a.approver_type))].map(v => ({ value: v })), [approvers])} 
              placeholder="例如：财务部、华东区域经理" 
            />
          </Form.Item>

          <Form.Item name="user_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">成员 (支持多选)</span>} rules={[{ required: true }]}>
            <Select 
              mode="multiple" 
              showSearch 
              filterOption={filterOptionWithPinyin} 
              placeholder="搜索并批量添加人员" 
              maxTagCount="responsive"
              options={users.map(u => ({ value: u.id, label: `${u.real_name} (${u.username})` }))}
            />
          </Form.Item>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
            <div className="text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest flex items-center justify-between">
              金额职责区间
              <Tooltip title="单据金额在此区间内时生效"><InfoCircleOutlined className="text-slate-300" /></Tooltip>
            </div>
            <div className="flex items-center gap-3">
              <Form.Item name="amount_min" className="mb-0 flex-1">
                <InputNumber min={0} placeholder="起步" className="w-full" prefix="¥" size="small" />
              </Form.Item>
              <SwapRightOutlined className="text-slate-300" />
              <Form.Item name="amount_limit" className="mb-0 flex-1">
                <InputNumber min={0} placeholder="上限" className="w-full" prefix="¥" size="small" />
              </Form.Item>
            </div>
          </div>

          <Form.Item name="department_scope" label={<span className="text-[10px] font-black text-slate-400 uppercase">管辖部门 (可选)</span>}>
            <Select mode="multiple" placeholder="留空则全管" options={departments.map(d => ({ value: d.id, label: d.name }))} maxTagCount="responsive" />
          </Form.Item>

          <Form.Item name="is_active" valuePropName="checked" className="mb-0">
            <Checkbox className="text-xs font-bold text-slate-500">同步上线激活</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .ant-select-selector, .ant-input, .ant-input-number { border-radius: 8px !important; border-color: #e2e8f0 !important; font-size: 12px !important; }
        .ant-btn-primary { box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15) !important; }
        .ant-modal-content { border-radius: 20px !important; padding: 24px !important; }
      `}} />
    </div>
  );
};

export default ApproverManagement;
