import React, { useState, useEffect } from 'react';
import { 
  Table, Tag, Card, Modal, Form, Input, Space, Typography, 
  Timeline, Badge, Empty, Tabs, Avatar, Select
} from 'antd';
import { 
  DesktopOutlined, HistoryOutlined, ThunderboltOutlined, 
  ClockCircleOutlined, InfoCircleOutlined, ToolOutlined,
  FileTextOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { apiGet, apiPost } from '../../utils/apiClient';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { getImageUrl } from '../../utils/fileUtils';

const { Title, Text } = Typography;

// --- Shadcn 风格按钮 ---
const ShadcnButton = ({ children, onClick, variant = 'default', icon, className = '', size = 'md' }) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 gap-2 active:scale-[0.98]";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 py-2 text-sm", lg: "h-10 px-8 text-base" };
  const variants = {
    default: "bg-slate-900 text-white shadow hover:bg-slate-900/90",
    outline: "border border-slate-200 bg-white shadow-sm hover:bg-slate-100 text-slate-700",
    secondary: "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-100/80",
    ghost: "hover:bg-slate-100 text-slate-600",
    danger: "bg-red-500 text-white shadow-sm hover:bg-red-500/90",
    link: "text-indigo-600 underline-offset-4 hover:underline"
  };
  return (<button onClick={onClick} className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}>{icon}{children}</button>);
};

const MyAssets = () => {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('assets');
  const [historyModal, setHistoryModal] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [currentAsset, setCurrentAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (activeTab === 'assets') fetchMyAssets();
    else fetchMyRequests();
  }, [activeTab]);

  const fetchMyAssets = async () => {
    setLoading(true);
    try {
      const savedUser = JSON.parse(localStorage.getItem('user'));
      const res = await apiGet(`/api/assets/employee/${savedUser.id}`);
      if (res.success) setAssets(res.data);
    } catch (error) { toast.error('获取资产失败'); }
    finally { setLoading(false); }
  };

  const fetchMyRequests = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/assets/requests');
      if (res.success) setRequests(res.data);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const viewHistory = async (asset) => {
    setCurrentAsset(asset);
    try {
      const res = await apiGet(`/api/assets/${asset.id}/history`);
      if (res.success) {
        setHistory(res.data);
        setHistoryModal(true);
      }
    } catch (error) { toast.error('获取记录失败'); }
  };

  const handleUpgradeRequest = (asset) => {
    setCurrentAsset(asset);
    form.resetFields();
    setUpgradeModal(true);
  };

  const submitUpgrade = async (values) => {
    try {
      const res = await apiPost(`/api/assets/instances/${currentAsset.id}/request`, values);
      if (res.success) {
        toast.success('申请已提交，等待后勤审批');
        setUpgradeModal(false);
        setActiveTab('requests');
      }
    } catch (error) { toast.error('提交失败'); }
  };

  const assetColumns = [
    {
      title: '设备编号',
      dataIndex: 'asset_no',
      align: 'center',
      render: (text) => <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{text}</span>,
    },
    {
      title: '设备名称',
      align: 'center',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.model_name}</Text>
          <Text type="secondary" className="text-[10px] uppercase">{r.form_name}</Text>
        </Space>
      ),
    },
    {
      title: '实时配置快照',
      dataIndex: 'components',
      align: 'center',
      render: (config) => (
        <div className="flex flex-wrap justify-center gap-1 max-w-xs mx-auto">
          {(config || []).map((c, i) => (
            <Tag key={i} className="text-[10px] m-0 bg-slate-50 border-slate-200 text-slate-600">
              <span className="opacity-50">{c.type_name}:</span> {c.component_model || c.component_name}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: '操作',
      width: 280,
      align: 'center',
      render: (_, record) => (
        <div className="flex items-center justify-center gap-2">
          <ShadcnButton variant="outline" size="sm" icon={<HistoryOutlined />} onClick={() => viewHistory(record)}>履历</ShadcnButton>
          <ShadcnButton variant="default" size="sm" icon={<ThunderboltOutlined />} onClick={() => handleUpgradeRequest(record)}>申请升级</ShadcnButton>
          <ShadcnButton variant="secondary" size="sm" icon={<FileTextOutlined />} onClick={() => {
            window.location.href = `/finance/reimbursement?asset_no=${record.asset_no}&asset_id=${record.id}`;
          }}>报销申请</ShadcnButton>
        </div>
      ),
    },
  ];

  const requestColumns = [
    {
      title: '提交时间',
      dataIndex: 'created_at',
      align: 'center',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '相关设备',
      dataIndex: 'asset_no',
      align: 'center',
      render: t => <b className="font-mono">{t}</b>
    },
    {
      title: '类型',
      dataIndex: 'type',
      align: 'center',
      render: (t) => t === 'upgrade' ? <Tag color="orange" className="rounded-full border-none px-3 font-bold text-[10px]">硬件升级</Tag> : <Tag color="blue" className="rounded-full border-none px-3 font-bold text-[10px]">故障维修</Tag>
    },
    { title: '需求描述', dataIndex: 'description', align: 'center', ellipsis: true },
    {
      title: '当前进度',
      key: 'status',
      align: 'center',
      render: (_, record) => {
        const statusMap = {
          pending: { c: 'processing', t: '待处理' },
          approved: { c: 'success', t: '已通过' },
          rejected: { c: 'error', t: '已驳回' }
        };
        const config = statusMap[record.status] || { c: 'default', t: record.status };
        return <Badge status={config.c} text={config.t} />;
      }
    }
  ];

  return (
    <div className="p-8 bg-white min-h-screen text-slate-900">
      <div className="mb-8">
          <Title level={3} className="tracking-tight font-extrabold"><DesktopOutlined className="mr-3 text-slate-900" />我的资产与设备</Title>
          <Text className="text-slate-500 font-medium">查看当前领用设备的实时硬件快照，或提交配置变更申请</Text>
      </div>

      <Card variant="borderless" className="shadow-sm border border-slate-200 rounded-xl overflow-hidden">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          className="asset-tabs"
          items={[
            {
              key: 'assets',
              label: <span className="px-6 font-bold">我的领用</span>,
              children: <Table columns={assetColumns} dataSource={assets} rowKey="id" loading={loading} pagination={false} size="middle" className="border-t border-slate-100" />
            },
            {
              key: 'requests',
              label: <span className="px-6 font-bold">申请进度</span>,
              children: <Table columns={requestColumns} dataSource={requests} rowKey="id" loading={loading} size="middle" className="border-t border-slate-100" />
            }
          ]}
        />
      </Card>

      {/* 履历弹窗 - Shadcn 简约风格 */}
      <Modal title={<Space><HistoryOutlined /><span>设备配置变迁记录</span></Space>} open={historyModal} onCancel={() => setHistoryModal(false)} footer={null} width={600} centered>
        <div className="py-6 px-4">
          <Timeline mode="left" className="custom-timeline">
            {history.map((item, index) => (
              <Timeline.Item key={index} color="blue" label={<span className="text-[10px] font-bold text-slate-400">{dayjs(item.upgrade_date).format('YYYY-MM-DD')}</span>}>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-800 text-sm mb-2">{item.type_name} {item.upgrade_type === 'upgrade' ? '性能升级' : '变更'}</div>
                    <div className="flex items-center gap-3 text-xs">
                        <Text type="secondary" delete className="opacity-40">{item.old_model || '原始配件'}</Text>
                        <ArrowRightOutlined className="text-blue-500" />
                        <Text strong className="text-blue-600 font-bold">{item.new_model}</Text>
                    </div>
                    {item.reason && <div className="mt-3 text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-100 italic">“{item.reason}”</div>}
                </div>
              </Timeline.Item>
            ))}
            {history.length === 0 && <Empty description="该设备暂无硬件变更记录" />}
          </Timeline>
        </div>
      </Modal>

      {/* 申请弹窗 */}
      <Modal title={<Space><ToolOutlined className="text-slate-900" /><span>提交后勤服务申请 - {currentAsset?.asset_no}</span></Space>} open={upgradeModal} onCancel={() => setUpgradeModal(false)} footer={null} centered width={450}>
        <Form form={form} layout="vertical" onFinish={submitUpgrade} className="mt-6">
          <Form.Item name="type" label={<span className="text-xs font-bold text-slate-500 uppercase">申请性质</span>} initialValue="upgrade" rules={[{ required: true }]}>
             <Select options={[{label: '硬件配置升级 (性能提升)', value: 'upgrade'}, {label: '故障报修/更换 (损坏修复)', value: 'repair'}]} className="h-10" />
          </Form.Item>
          <Form.Item name="description" label={<span className="text-xs font-bold text-slate-500 uppercase">具体需求描述</span>} rules={[{ required: true, message: '请简要说明需求' }]}>
            <Input.TextArea rows={4} placeholder="例如：内存不足，申请升级至32G；或者屏幕出现坏点申请维修。" className="rounded-md" />
          </Form.Item>
          <div className="flex justify-end gap-3 mt-8">
            <ShadcnButton variant="outline" onClick={() => setUpgradeModal(false)}>取消</ShadcnButton>
            <ShadcnButton onClick={() => form.submit()}>提交申请</ShadcnButton>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default MyAssets;