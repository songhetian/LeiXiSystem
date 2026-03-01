/**
 * 资产申请审批 (雷犀高级感 2.0 视觉对齐版)
 * 
 * 核心升级：
 * 1. 标签修正：更正“处理状态”语意。
 * 2. 视觉统合：取消状态区的黑色背景，实现搜索栏全局色调一致性。
 * 3. 雷犀标准：严格遵循 44px 物理缝合搜索栏、边框 #64748b。
 * 4. 逻辑守护：确保多维过滤与分页机制稳健运行。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Tag, Modal, Form, Input, Space, Typography, 
  Divider, Row, Col, Avatar, Select 
} from 'antd';
import { 
  SearchOutlined,
  ReloadOutlined,
  AuditOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { toast } from 'sonner';
import api from '../../../api';

const { Text, Title } = Typography;
const { Option } = Select;

// --- 样式组件：黑底白字商务按钮 ---
const BlackButton = ({ children, icon, ...props }) => (
  <button 
    className="bg-black hover:bg-slate-800 text-white rounded-lg h-9 px-5 flex items-center justify-center gap-2 transition-all font-bold text-xs shadow-sm active:scale-95 disabled:opacity-50"
    {...props}
  >
    {icon}
    <span className="text-white">{children}</span>
  </button>
);

const AssetRequestAudit = () => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [auditModal, setAuditModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  
  // 搜索与过滤状态
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  
  const [departments, setDepartments] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRequests();
    fetchDepartments();
  }, [activeTab]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assets/requests?status=${activeTab === 'all' ? '' : activeTab}`);
      if (res.data.success) {
        setRequests(res.data.data);
      }
    } catch (error) {
      toast.error('数据同步失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(Array.isArray(res.data) ? res.data : (res.data.data || []));
    } catch (e) {}
  };

  const handleAuditAction = (record, action) => {
    setSelectedRequest({ ...record, targetAction: action });
    form.resetFields();
    setAuditModal(true);
  };

  const submitAudit = async () => {
    try {
      const values = await form.validateFields();
      const res = await api.put(`/assets/requests/${selectedRequest.id}/audit`, {
        action: selectedRequest.targetAction,
        admin_notes: values.admin_notes
      });
      if (res.data.success) {
        toast.success('审批处理已更新');
        setAuditModal(false);
        fetchRequests();
      }
    } catch (error) {
      toast.error('提交失败');
    }
  };

  // 客户端联合过滤逻辑
  const filteredData = useMemo(() => {
    return requests.filter(r => {
      const matchText = !searchText || 
        r.applicant_name?.includes(searchText) || 
        r.asset_no?.includes(searchText) ||
        r.device_name?.includes(searchText);
      
      const matchDept = !deptFilter || r.department_id === deptFilter;
      const matchType = !typeFilter || r.type === typeFilter;
      
      return matchText && matchDept && matchType;
    });
  }, [requests, searchText, deptFilter, typeFilter]);

  const columns = [
    {
      title: '申请时间',
      dataIndex: 'created_at',
      align: 'center',
      render: (date) => <span className="text-slate-400 font-mono text-[11px]">{new Date(date).toLocaleString()}</span>,
      width: 160
    },
    {
      title: '申请人员',
      key: 'applicant',
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center">
          <span className="font-black text-slate-800 text-xs">{record.applicant_name}</span>
          <Tag className="m-0 border-none bg-slate-100 text-slate-500 text-[9px] font-bold uppercase mt-0.5">
            {record.department_name}
          </Tag>
        </div>
      ),
      width: 140
    },
    {
      title: '目标资产',
      key: 'device',
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center">
          <code className="text-indigo-600 font-black text-[10px] bg-indigo-50 px-1.5 py-0.5 rounded">{record.asset_no}</code>
          <span className="text-[11px] text-slate-500 font-medium mt-1">{record.device_name}</span>
        </div>
      )
    },
    {
      title: '业务类型',
      dataIndex: 'type',
      align: 'center',
      render: (type) => (
        <Tag color={type === 'upgrade' ? 'black' : 'default'} className="rounded-md border-none px-2 font-black text-[10px]">
          {type === 'upgrade' ? '性能升级' : '故障报修'}
        </Tag>
      ),
      width: 100
    },
    {
      title: '审批进度',
      dataIndex: 'status',
      align: 'center',
      render: (status) => {
        const config = {
          pending: { c: 'text-amber-600', t: '处理中', dot: 'bg-amber-500' },
          approved: { c: 'text-emerald-600', t: '审批通过', dot: 'bg-emerald-500' },
          rejected: { c: 'text-rose-600', t: '已驳回', dot: 'bg-rose-500' }
        };
        const item = config[status] || { c: 'text-slate-400', t: '已撤销', dot: 'bg-slate-300' };
        return (
          <div className="flex items-center justify-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`}></div>
            <span className={`text-[10px] font-black ${item.c}`}>{item.t}</span>
          </div>
        );
      },
      width: 120
    },
    {
      title: '管理操作',
      key: 'action',
      align: 'center',
      width: 180,
      render: (_, record) => (
        record.status === 'pending' ? (
          <Space split={<Divider type="vertical" />}>
            <Button type="link" size="small" className="font-black text-emerald-600 text-xs" onClick={() => handleAuditAction(record, 'approve')}>同意</Button>
            <Button type="link" size="small" danger className="font-black text-xs" onClick={() => handleAuditAction(record, 'reject')}>拒绝</Button>
          </Space>
        ) : (
          <Text type="disabled" className="text-[10px] font-bold uppercase">流程已结项</Text>
        )
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 min-h-screen bg-slate-50/30">
      {/* 顶部标题栏 */}
      <div className="max-w-[1400px] mx-auto mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
              <AuditOutlined className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 !m-0">资产申请审批</h1>
          </div>
          <p className="text-slate-400 text-sm font-bold">硬件资产变更、维修及配属申请的处理枢纽</p>
        </div>
        <BlackButton icon={<ReloadOutlined className={loading ? 'animate-spin' : ''} />} onClick={fetchRequests}>同步记录</BlackButton>
      </div>

      {/* 雷犀标准：44px 物理缝合搜索栏 (视觉对齐版) */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b]">
          {/* 关键字检索 */}
          <div className="flex-[2] flex items-center h-[44px] px-4 border-r border-slate-100">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input 
              placeholder="搜索人员、资产编号或详情描述..." 
              variant="borderless"
              className="h-full text-sm font-medium"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </div>
          
          {/* 部门筛选 */}
          <div className="flex-1 flex items-center h-[44px] px-4 bg-slate-50/30 border-r border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">所属部门</span>
            <Select 
              placeholder="全部部门"
              variant="borderless"
              className="w-full text-xs font-bold text-slate-700"
              allowClear
              onChange={setDeptFilter}
              options={departments.map(d => ({ label: d.name, value: d.id }))}
            />
          </div>

          {/* 类型筛选 */}
          <div className="flex-1 flex items-center h-[44px] px-4 border-r border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">申请类型</span>
            <Select 
              placeholder="全部类型"
              variant="borderless"
              className="w-full text-xs font-bold text-slate-700"
              allowClear
              onChange={setTypeFilter}
              options={[{label:'硬件升级', value:'upgrade'}, {label:'故障报修', value:'repair'}]}
            />
          </div>

          {/* 状态筛选 (修正标签与视觉) */}
          <div className="flex-1 flex items-center h-[44px] px-4 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">处理状态</span>
            <Select 
              value={activeTab} 
              onChange={setActiveTab}
              variant="borderless"
              className="w-full text-xs font-black text-slate-800"
              options={[
                { value: 'pending', label: '待办审批' },
                { value: 'approved', label: '通过历史' },
                { value: 'rejected', label: '驳回记录' },
                { value: 'all', label: '全量记录' }
              ]}
            />
          </div>
        </div>
      </div>

      {/* 极致紧凑表格 */}
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <Table 
            columns={columns} 
            dataSource={filteredData} 
            rowKey="id" 
            loading={loading} 
            size="middle"
            className="compact-table"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共计 ${total} 条数据记录`,
              className: "custom-pagination"
            }}
          />
        </div>
      </div>

      {/* 审批弹窗 */}
      <Modal 
        title={<div className="font-black text-slate-800 text-sm flex items-center gap-2"><FileTextOutlined className="text-indigo-600" /> 签署审批意见</div>} 
        open={auditModal} 
        onCancel={() => setAuditModal(false)} 
        onOk={submitAudit}
        centered 
        width={420}
        okText={selectedRequest?.targetAction === 'approve' ? '确认通过' : '确认驳回'}
        cancelText="取消"
        className="custom-modal"
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">
            <div className="text-[10px] font-black text-slate-400 uppercase mb-2">申请事由摘要</div>
            <div className="text-xs font-bold text-slate-600 leading-relaxed italic">
              " {selectedRequest?.description || '未填写描述'} "
            </div>
          </div>
          <Form.Item 
            name="admin_notes" 
            label={<span className="text-[10px] font-black text-slate-400 uppercase">审批备注 (驳回必填)</span>} 
            rules={[{ required: selectedRequest?.targetAction === 'reject', message: '请说明拒绝原因' }]}
          >
            <Input.TextArea rows={3} placeholder="在此录入您的处理意见..." className="rounded-lg border-slate-200" />
          </Form.Item>
        </Form>
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .ant-table-thead > tr > th { 
          background: #f8fafc !important; 
          color: #64748b !important; 
          font-weight: 900 !important; 
          text-transform: uppercase !important; 
          font-size: 10px !important;
          padding: 12px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          text-align: center !important;
        }
        .ant-table-tbody > tr > td { text-align: center !important; font-size: 13px !important; border-bottom: 1px solid #f1f5f9 !important; }
        .ant-modal-content { border-radius: 24px !important; padding: 24px !important; }
        .ant-btn-primary { background: #000000 !important; border: none !important; border-radius: 8px !important; font-weight: 700 !important; }
        .ant-btn-primary span { color: #ffffff !important; }
        .ant-select-selection-item { font-weight: 700 !important; }
      `}} />
    </div>
  );
};

export default AssetRequestAudit;
