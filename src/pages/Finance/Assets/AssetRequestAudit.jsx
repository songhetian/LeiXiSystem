import React, { useState, useEffect } from 'react';
import { Table, Tag, Card, Modal, Form, Input, Space, Typography, Badge, Tabs, Steps, Divider, Row, Col } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  EyeOutlined, 
  HistoryOutlined,
  AuditOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { toast } from 'sonner';
import api from '../../../api';
import Breadcrumb from '../../../components/Breadcrumb';

const { Title, Text } = Typography;

// --- Shadcn 风格按钮 ---
const ShadcnButton = ({ children, onClick, variant = 'default', icon, className = '', size = 'md' }) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 gap-2 active:scale-95 shadow-sm";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 py-2 text-sm", lg: "h-10 px-8 text-base" };
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    indigo: "bg-indigo-600 text-white hover:bg-indigo-700",
    warning: "bg-orange-500 text-white hover:bg-orange-600",
    danger: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200"
  };
  return (<button onClick={onClick} className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}>{icon}{children}</button>);
};

const AssetRequestAudit = () => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [auditModal, setAuditModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestDetail, setDetailData] = useState(null);
  const [form] = Form.useForm();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assets/requests?status=${activeTab === 'all' ? '' : activeTab}`);
      if (res.data.success) {
        setRequests(res.data.data);
      }
    } catch (error) {
      toast.error('获取申请列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeTab]);

  const viewDetail = async (record) => {
    setSelectedRequest(record);
    setLoading(true);
    try {
      // 修正接口：后端逻辑已在 processApproval 等处处理，此处拉取流程进度
      const res = await api.get(`/assets/requests/${record.id}/progress`); 
      // 如果后端没提供 progress 接口，我们降级显示基础信息
      if (res.data.success) {
        setDetailData(res.data);
        setDetailModal(true);
      }
    } catch (error) {
      toast.error('获取进度失败');
    } finally {
      setLoading(false);
    }
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
        toast.success('处理成功');
        setAuditModal(false);
        fetchRequests();
      }
    } catch (error) {
      toast.error('审核提交失败');
    }
  };

  const columns = [
    {
      title: '申请时间',
      dataIndex: 'created_at',
      align: 'center',
      render: (date) => <span className="text-slate-500 font-medium">{new Date(date).toLocaleString()}</span>,
      width: 180
    },
    {
      title: '申请人/部门',
      key: 'applicant',
      align: 'center',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span className="font-bold text-slate-800">{record.applicant_name}</span>
          <span className="text-[10px] text-slate-400 uppercase font-bold">{record.department_name}</span>
        </Space>
      ),
      width: 150
    },
    {
      title: '涉及设备',
      key: 'device',
      align: 'center',
      render: (_, record) => (
        <div className="flex flex-col items-center">
          <code className="text-indigo-600 font-bold mb-1">{record.asset_no}</code>
          <span className="text-xs text-slate-500">{record.device_name}</span>
        </div>
      )
    },
    {
      title: '申请类型',
      dataIndex: 'type',
      align: 'center',
      render: (type) => (
        <Tag color={type === 'upgrade' ? 'purple' : 'orange'} className="rounded-full border-none px-3 font-bold text-[10px]">
          {type === 'upgrade' ? '硬件升级' : '故障维修'}
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
          pending: { c: 'processing', t: '审批中' },
          approved: { c: 'success', t: '已通过' },
          rejected: { c: 'error', t: '已驳回' }
        };
        const item = config[status] || { c: 'default', t: status };
        return <Badge status={item.c} text={<span className="font-medium">{item.t}</span>} />;
      },
      width: 120
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      width: 250,
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          {/* <ShadcnButton variant="outline" size="sm" icon={<EyeOutlined />} onClick={() => viewDetail(record)}>进度</ShadcnButton> */}
          {record.status === 'pending' && (
            <>
              <ShadcnButton variant="indigo" size="sm" icon={<CheckCircleOutlined />} onClick={() => handleAuditAction(record, 'approve')}>通过</ShadcnButton>
              <ShadcnButton variant="danger" size="sm" icon={<CloseCircleOutlined />} onClick={() => handleAuditAction(record, 'reject')}>驳回</ShadcnButton>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 bg-white min-h-screen text-slate-900">
      <div className="mb-4">
        <Breadcrumb items={['首页', '后勤管理', '申请审批']} />
      </div>
      
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-slate-100 pb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">设备申请审批</h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">统一处理员工发起的硬件升级、故障报修及设备更换申请流</p>
        </div>
        <ShadcnButton variant="outline" icon={<ReloadOutlined />} onClick={fetchRequests}>刷新列表</ShadcnButton>
      </div>

      <Card variant="borderless" className="shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="asset-tabs" items={[
          { key: 'pending', label: <span className="px-4 font-bold">待我处理</span> },
          { key: 'approved', label: <span className="px-4 font-bold">已通过</span> },
          { key: 'rejected', label: <span className="px-4 font-bold">已驳回</span> },
          { key: 'all', label: <span className="px-4 font-bold">历史记录</span> },
        ]} />
        <Table columns={columns} dataSource={requests} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} className="border-t border-slate-100" />
      </Card>

      {/* 审批处理弹窗 */}
      <Modal title={<Space><AuditOutlined className="text-indigo-600" /><span>审批处理意见</span></Space>} open={auditModal} onCancel={() => setAuditModal(false)} footer={null} centered width={450}>
        <Form form={form} layout="vertical" className="mt-6">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6">
            <div className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">申请内容摘要</div>
            <div className="text-sm font-medium text-slate-700 leading-relaxed">
              {selectedRequest?.description || '无具体描述'}
            </div>
          </div>
          <Form.Item name="admin_notes" label={<span className="text-xs font-bold text-slate-500 uppercase">审批备注</span>} rules={[{ required: selectedRequest?.targetAction === 'reject', message: '驳回必须填写原因' }]}>
            <Input.TextArea rows={4} placeholder="请输入您的处理意见..." className="rounded-md" />
          </Form.Item>
          
          <div className="flex justify-end gap-3 mt-8">
            <ShadcnButton variant="outline" onClick={() => setAuditModal(false)}>取消</ShadcnButton>
            <ShadcnButton 
              variant={selectedRequest?.targetAction === 'approve' ? 'indigo' : 'danger'} 
              onClick={() => submitAudit()}
            >
              确认{selectedRequest?.targetAction === 'approve' ? '通过申请' : '驳回申请'}
            </ShadcnButton>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AssetRequestAudit;