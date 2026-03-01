/**
 * 资产申请审批中心 (雷犀高级感 2.0 商务版)
 * 
 * 核心标准：
 * 1. 物理缝合搜索栏：44px 统一高度、全铺满、边框 #64748b。
 * 2. 极致紧凑表格：黑白商务配色、全量居中、信息密度最大化。
 * 3. 视觉降噪：移除冗余面包屑，统一按钮视觉对比度。
 * 4. 极致本地化：全量移除英文状态词，改为地道中文。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Tag, Modal, Form, Input, Space, Typography, 
  Badge, Tabs, Divider, Row, Col, Avatar 
} from 'antd';
import { 
  CheckCircleFilled, 
  CloseCircleFilled, 
  SearchOutlined,
  ReloadOutlined,
  AuditOutlined,
  FileTextOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { toast } from 'sonner';
import api from '../../../api';

const { Text, Title } = Typography;

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
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assets/requests?status=${activeTab === 'all' ? '' : activeTab}`);
      if (res.data.success) {
        setRequests(res.data.data);
      }
    } catch (error) {
      toast.error('列表同步失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

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
        toast.success('审批操作已执行');
        setAuditModal(false);
        fetchRequests();
      }
    } catch (error) {
      toast.error('操作提交失败');
    }
  };

  const filteredData = useMemo(() => {
    if (!searchText) return requests;
    return requests.filter(r => 
      r.applicant_name?.includes(searchText) || 
      r.asset_no?.includes(searchText) ||
      r.device_name?.includes(searchText)
    );
  }, [requests, searchText]);

  const columns = [
    {
      title: '申请时间',
      dataIndex: 'created_at',
      align: 'center',
      render: (date) => <span className="text-slate-400 font-mono text-[11px]">{new Date(date).toLocaleString()}</span>,
      width: 160
    },
    {
      title: '申请人信息',
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
      title: '审批状态',
      dataIndex: 'status',
      align: 'center',
      render: (status) => {
        const config = {
          pending: { c: 'bg-amber-50 text-amber-600', t: '审核中' },
          approved: { c: 'bg-emerald-50 text-emerald-600', t: '审批通过' },
          rejected: { c: 'bg-rose-50 text-rose-600', t: '已驳回' }
        };
        const item = config[status] || { c: 'bg-slate-100 text-slate-400', t: '已撤销' };
        return (
          <div className="flex items-center justify-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${status === 'pending' ? 'bg-amber-500' : status === 'approved' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <span className={`text-[10px] font-black ${item.c.split(' ')[1]}`}>{item.t}</span>
          </div>
        );
      },
      width: 120
    },
    {
      title: '操作',
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
            <h1 className="text-2xl font-black text-slate-900 !m-0">后勤审批中心</h1>
          </div>
          <p className="text-slate-400 text-sm font-bold">处理全系统硬件资产的变更与报修申请</p>
        </div>
        <BlackButton icon={<ReloadOutlined className={loading ? 'animate-spin' : ''} />} onClick={fetchRequests}>同步记录</BlackButton>
      </div>

      {/* 雷犀标准：44px 物理缝合搜索栏 */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b]">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input 
              placeholder="通过申请人、资产编号或具体描述检索..." 
              variant="borderless"
              className="h-full text-sm font-medium"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </div>
          <Divider type="vertical" className="h-6 border-slate-200 m-0" />
          <div className="w-64 flex items-center h-[44px] px-4 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">当前视图</span>
            <Select 
              value={activeTab} 
              onChange={setActiveTab}
              variant="borderless"
              className="w-full text-xs font-black text-slate-700"
              options={[
                { value: 'pending', label: '待办审批' },
                { value: 'approved', label: '通过历史' },
                { value: 'rejected', label: '驳回历史' },
                { value: 'all', label: '全部记录' }
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
              showSizeChanger: false,
              showTotal: (total) => `共计 ${total} 条申请记录`,
              className: "custom-pagination",
              position: ['bottomCenter']
            }}
          />
        </div>
      </div>

      {/* 审批处理弹窗 */}
      <Modal 
        title={<div className="font-black text-slate-800 text-sm flex items-center gap-2"><FileTextOutlined className="text-indigo-600" /> 签署审批意见</div>} 
        open={auditModal} 
        onCancel={() => setAuditModal(false)} 
        onOk={submitAudit}
        centered 
        width={420}
        okText={selectedRequest?.targetAction === 'approve' ? '确认通过' : '确认驳回'}
        cancelText="暂不处理"
        className="custom-modal"
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase mb-3">
              <ClockCircleOutlined /> 申请事由描述
            </div>
            <div className="text-xs font-bold text-slate-600 leading-relaxed italic">
              " {selectedRequest?.description || '未填写具体事由'} "
            </div>
          </div>
          <Form.Item 
            name="admin_notes" 
            label={<span className="text-[10px] font-black text-slate-400 uppercase">处理备注 (驳回必填)</span>} 
            rules={[{ required: selectedRequest?.targetAction === 'reject', message: '请务必说明驳回原因' }]}
          >
            <Input.TextArea rows={3} placeholder="在此输入您的批复意见..." className="rounded-lg border-slate-200" />
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
      `}} />
    </div>
  );
};

export default AssetRequestAudit;
