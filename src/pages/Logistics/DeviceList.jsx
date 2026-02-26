import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Badge, Tag, Modal, Input, Select, Form,
  Table, Avatar, Space, Card, Row, Col, Timeline, Typography, Empty, Button
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, InfoCircleOutlined, 
  ToolOutlined, StopOutlined, CheckCircleOutlined,
  HistoryOutlined, DesktopOutlined, UserOutlined, PlusOutlined,
  SwapOutlined,
  EyeOutlined
} from '@ant-design/icons';
import api from '../../api';
import Breadcrumb from '../../components/Breadcrumb';
import { getImageUrl } from '../../utils/fileUtils';

const { Text, Title } = Typography;

// --- 增强版 Shadcn 风格按钮 (支持多色体系) ---
const ShadcnButton = ({ children, onClick, variant = 'default', icon, className = '', size = 'md' }) => {
  const baseStyles = "inline-flex items-center justify-center rounded-md font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50 gap-2 active:scale-95 shadow-sm";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 py-2 text-sm", lg: "h-10 px-8 text-base" };
  const variants = {
    default: "bg-slate-900 text-white hover:bg-slate-800",
    indigo: "bg-indigo-600 text-white hover:bg-indigo-700",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200",
    warning: "bg-orange-500 text-white hover:bg-orange-600",
    danger: "bg-red-500 text-white hover:bg-red-600",
    outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-600",
    link: "text-indigo-600 underline-offset-4 hover:underline shadow-none"
  };
  return (<button onClick={onClick} className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}>{icon}{children}</button>);
};

const DeviceList = () => {
  const [form] = Form.useForm();
  const [configForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [instances, setInstances] = useState([]);
  const [filters, setFilters] = useState({ keyword: '', device_status: null, department_id: null, model_id: null });
  
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isConfigViewOpen, setIsConfigViewOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  const [currentDevice, setCurrentDevice] = useState(null);
  const [devices, setDevices] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [compTypes, setCompTypes] = useState([]);
  const [availableComps, setAvailableComps] = useState([]);

  useEffect(() => { fetchInstances(); }, [filters]);
  useEffect(() => { fetchOptions(); }, []);

  const fetchInstances = async () => {
    setLoading(true);
    try {
      const res = await api.get('/assets/instances', { params: filters });
      if (res.data.success) setInstances(res.data.data);
    } catch (e) { toast.error('获取库存失败'); }
    finally { setLoading(false); }
  };

  const fetchOptions = async () => {
    try {
      const [devRes, empRes, typeRes, deptRes] = await Promise.all([
        api.get('/assets/devices'),
        api.get('/assets/employee-centric'),
        api.get('/assets/component-types'),
        api.get('/departments')
      ]);
      setDevices(devRes.data.data || []);
      setAllEmployees(empRes.data.data || []);
      setCompTypes(typeRes.data.data || []);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : (deptRes.data.data || []));
    } catch (e) {}
  };

  const fetchCompsByType = async (typeId) => {
    try {
      const res = await api.get(`/assets/components?type_id=${typeId}`);
      if (res.data.success) setAvailableComps(res.data.data);
    } catch (e) {}
  };

  const showDetail = async (record) => {
    setLoading(true);
    try {
      const res = await api.get(`/assets/instances/${record.id}`);
      if (res.data.success) {
        setCurrentDevice(res.data.data);
        setIsDetailOpen(true);
      }
    } catch (e) { toast.error('获取详情失败'); }
    finally { setLoading(false); }
  };

  const showQuickConfig = async (record) => {
    setLoading(true);
    try {
      const res = await api.get(`/assets/instances/${record.id}`);
      if (res.data.success) {
        setCurrentDevice(res.data.data);
        setIsConfigViewOpen(true);
      }
    } catch (e) { toast.error('获取配置失败'); }
    finally { setLoading(false); }
  };

  const handleConfigSubmit = async () => {
    try {
      const values = await configForm.validateFields();
      const res = await api.post(`/assets/instances/${currentDevice.id}/config`, values);
      if (res.data.success) {
        toast.success('配置已更新');
        setIsConfigModalOpen(false);
        showDetail(currentDevice);
        fetchInstances();
      }
    } catch (e) {}
  };

  const updateStatus = (id, status, label) => {
    Modal.confirm({
      title: `确认${label}`,
      content: `确定将设备状态变更为 [${label}] 吗？`,
      centered: true,
      onOk: async () => {
        try {
          await api.put(`/assets/instances/${id}/status`, { device_status: status });
          toast.success('状态已更新');
          if (isDetailOpen) showDetail(currentDevice);
          fetchInstances();
        } catch (e) {}
      }
    });
  };

  const handleAssignSubmit = async () => {
    try {
      const values = await form.validateFields();
      const res = await api.post('/assets/assign', values);
      if (res.data.success) {
        toast.success(`分配成功，设备编号: ${res.data.data.asset_no}`);
        setIsAssignModalOpen(false);
        setIsQuickModalOpen(false);
        fetchInstances();
      }
    } catch (e) {}
  };

  const columns = [
    { title: '设备编号', dataIndex: 'asset_no', align: 'center', render: t => <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{t}</span> },
    { title: '型号', dataIndex: 'model_name', align: 'center', render: t => <span className="font-semibold text-slate-700">{t}</span> },
    { title: '状态', dataIndex: 'device_status', align: 'center', render: s => {
      const map = { idle: { c: 'bg-slate-100 text-slate-600', t: '闲置' }, in_use: { c: 'bg-emerald-50 text-emerald-600 border border-emerald-100', t: '使用中' }, damaged: { c: 'bg-rose-50 text-rose-600 border border-rose-100', t: '故障' }, maintenance: { c: 'bg-orange-50 text-orange-600 border border-orange-100', t: '维修' } };
      const cfg = map[s] || { c: 'bg-slate-100 text-slate-600', t: s };
      return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cfg.c}`}>{cfg.t}</span>;
    }},
    { title: '当前使用者', dataIndex: 'user_name', align: 'center', render: (u, r) => u ? <div className="flex items-center justify-center gap-2"><Avatar size={24} src={getImageUrl(r.user_avatar)} icon={<UserOutlined />} /><span className="font-semibold text-slate-700">{u}</span></div> : <span className="text-slate-300">未领用</span> },
    { title: '所属部门', dataIndex: 'department_name', align: 'center' },
    {
      title: '操作',
      align: 'center',
      width: 280,
      render: (_, record) => (
        <div className="flex items-center justify-center gap-2">
          <ShadcnButton variant="outline" size="sm" icon={<EyeOutlined />} onClick={() => showQuickConfig(record)}>详情</ShadcnButton>
          <ShadcnButton variant="outline" size="sm" icon={<InfoCircleOutlined />} onClick={() => showDetail(record)}>档案</ShadcnButton>
          {record.device_status === 'in_use' ? (
            <ShadcnButton variant="warning" size="sm" icon={<ReloadOutlined />} onClick={() => updateStatus(record.id, 'idle', '归还入库')}>回收</ShadcnButton>
          ) : record.device_status === 'idle' ? (
            <ShadcnButton variant="indigo" size="sm" icon={<CheckCircleOutlined />} onClick={() => { setCurrentDevice(record); form.setFieldsValue({ asset_id: record.id }); setIsAssignModalOpen(true); }}>分配</ShadcnButton>
          ) : null}
        </div>
      )
    }
  ];

  return (
    <div className="p-8 bg-white min-h-screen text-slate-900">
      <div className="mb-4"><Breadcrumb items={['首页', '后勤管理', '实机明细']} /></div>
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-slate-100 pb-8">
        <div><h1 className="text-3xl font-extrabold tracking-tight text-slate-900">物理设备档案库</h1><p className="text-slate-500 mt-2 text-sm font-medium">管理全量物理实体的实时状态、精准硬件快照及生命周期变迁记录</p></div>
        <ShadcnButton variant="indigo" size="lg" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setIsQuickModalOpen(true); }}>一键分配新设备</ShadcnButton>
      </div>

      <div className="mb-6 bg-slate-50/50 p-6 rounded-xl border border-slate-200">
        <Row gutter={[16, 16]} align="bottom">
          <Col span={6}><div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1">领用人 / 编号</div><Input placeholder="搜索..." prefix={<SearchOutlined className="text-slate-400" />} allowClear className="h-10 rounded-md border-slate-200 shadow-sm" onChange={e => setFilters({...filters, keyword: e.target.value})} /></Col>
          <Col span={5}><div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1">所属部门</div><Select placeholder="全部部门" className="w-full h-10" allowClear onChange={val => setFilters({...filters, department_id: val})} options={departments.map(d => ({ label: d.name, value: d.id }))} /></Col>
          <Col span={5}><div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1">设备型号</div><Select placeholder="所有型号" className="w-full h-10" allowClear onChange={val => setFilters({...filters, model_id: val})} options={devices.map(d => ({ label: d.name, value: d.id }))} /></Col>
          <Col span={5}><div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5 ml-1">状态筛选</div><Select placeholder="所有状态" className="w-full h-10" allowClear onChange={val => setFilters({...filters, device_status: val})} options={[{label:'闲置 (Idle)', value:'idle'},{label:'使用中 (In Use)', value:'in_use'},{label:'故障 (Damaged)', value:'damaged'},{label:'维修 (Maintenance)', value:'maintenance'}]} /></Col>
          <Col span={3}><ShadcnButton variant="outline" className="w-full h-10" onClick={fetchInstances} icon={<ReloadOutlined />}>刷新</ShadcnButton></Col>
        </Row>
      </div>

      <div className="rounded-md border border-slate-200 bg-white overflow-hidden shadow-sm"><Table columns={columns} dataSource={instances} loading={loading} rowKey="id" pagination={{ pageSize: 10, className: "px-4 py-4 border-t border-slate-100", showTotal: (t) => <span className="text-slate-500 text-xs font-medium">共 {t} 台设备</span> }} /></div>

      {/* 详情快速预览 (简约配置清单) */}
      <Modal 
        title={<div className="text-lg font-bold text-slate-800 pb-2 border-b border-slate-100">设备硬件配置单</div>}
        open={isConfigViewOpen} 
        onCancel={() => setIsConfigViewOpen(false)} 
        footer={null} 
        width={550} 
        centered 
        destroyOnHidden
      >
        <div className="py-6 px-2">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 m-0">{currentDevice?.model_name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Tag className="m-0 border-none bg-slate-100 text-slate-500 font-medium px-2 py-0">{currentDevice?.category_name}</Tag>
              <span className="text-slate-300">|</span>
              <span className="text-sm text-slate-400 font-medium uppercase tracking-tight">{currentDevice?.form_name}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">硬件组成明细 / Components</div>
            
            <div className="divide-y divide-slate-100 border-t border-b border-slate-100">
              {(currentDevice?.components || []).map((c, i) => (
                <div key={i} className="py-4 flex justify-between items-center group">
                  <span className="text-sm font-medium text-slate-500">{c.type_name}</span>
                  <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                    {c.component_model || c.component_name}
                    {c.quantity > 1 && <span className="ml-2 text-indigo-500 font-black">×{c.quantity}</span>}
                  </span>
                </div>
              ))}
              {(currentDevice?.components?.length === 0) && (
                <div className="py-10 text-center"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该设备暂无配置快照" /></div>
              )}
            </div>

            <div className="mt-8 p-4 bg-slate-50 rounded-lg flex items-center gap-3">
              <InfoCircleOutlined className="text-slate-400" />
              <span className="text-xs text-slate-400 leading-relaxed">
                此清单为该物理实体的实时硬件快照。若执行过硬件升级，此处将显示升级后的最新规格。
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* 档案全历程弹窗 */}
      <Modal title={<Space><DesktopOutlined className="text-slate-900" /><span>设备全生命周期档案 - {currentDevice?.asset_no}</span></Space>} open={isDetailOpen} onCancel={() => setIsDetailOpen(false)} footer={null} width={1000} centered destroyOnHidden>
        {currentDevice && (
          <div className="py-4">
            <Row gutter={24}>
              <Col span={14}>
                <div className="bg-slate-50 p-6 rounded-xl mb-6 border border-slate-200">
                  <div className="flex justify-between items-center mb-6">
                    <div><Title level={5} className="m-0 font-extrabold">{currentDevice.model_name}</Title><Text type="secondary" className="text-xs">{currentDevice.category_name} · {currentDevice.form_name}</Text></div>
                    <ShadcnButton variant="outline" size="sm" icon={<SwapOutlined />} onClick={() => { configForm.resetFields(); setIsConfigModalOpen(true); }}>调整配置</ShadcnButton>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-6">
                    {(currentDevice.components || []).map((c, i) => (
                      <div key={i} className="flex justify-between items-center bg-white px-4 py-3 rounded-md border border-slate-200 shadow-sm"><Text strong className="text-[10px] text-slate-400 uppercase">{c.type_name}</Text><Text className="text-xs font-bold text-slate-700">{c.component_model || c.component_name} x{c.quantity}</Text></div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <ShadcnButton variant="outline" icon={<ToolOutlined />} onClick={() => updateStatus(currentDevice.id, 'damaged', '报告故障')}>标记故障</ShadcnButton>
                  <ShadcnButton variant="secondary" icon={<CheckCircleOutlined />} onClick={() => updateStatus(currentDevice.id, 'idle', '设为闲置')}>一键回收</ShadcnButton>
                  <ShadcnButton variant="danger" icon={<StopOutlined />} onClick={() => updateStatus(currentDevice.id, 'scrapped', '报废销毁')}>报废销毁</ShadcnButton>
                </div>
              </Col>
              <Col span={10}>
                <div className="border-l border-slate-200 pl-6 h-full min-h-[300px]">
                  <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><HistoryOutlined /> 变更履历</div>
                  <div className="max-h-[450px] overflow-y-auto pr-2 scrollbar-hide">
                    {currentDevice.history?.length > 0 ? (
                      <Timeline mode="left">
                        {currentDevice.history.map((h, i) => (
                          <Timeline.Item key={i} color={h.upgrade_type === 'upgrade' ? 'green' : 'blue'} label={<span className="text-[10px] font-bold text-slate-400">{new Date(h.upgrade_date).toLocaleDateString()}</span>}>
                            <div className="bg-white p-3 rounded-md border border-slate-200 text-xs shadow-sm"><div className="font-bold text-slate-800 mb-1">{h.type_name} {h.upgrade_type === 'upgrade' ? '性能提升' : '变更'}</div><div className="text-slate-500">{h.old_model && <Text delete className="mr-2 text-[10px] opacity-40">{h.old_model}</Text>}<Text strong className="text-indigo-600">{h.new_model}</Text></div>{h.reason && <div className="mt-2 text-[10px] italic text-slate-400 bg-slate-50 p-1.5 rounded">“{h.reason}”</div>}</div>
                          </Timeline.Item>
                        ))}
                        <Timeline.Item color="gray" label={<span className="text-[10px] font-bold text-slate-400">{new Date(currentDevice.created_at).toLocaleDateString()}</span>}><div className="text-xs font-bold text-slate-400 italic">初始配置入库</div></Timeline.Item>
                      </Timeline>
                    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无履历数据" />}
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 配置调整 */}
      <Modal title="设备配件动态调整" open={isConfigModalOpen} onCancel={() => setIsConfigModalOpen(false)} onOk={handleConfigSubmit} centered width={450} okText="确定变更" cancelText="取消">
        <Form form={configForm} layout="vertical" className="mt-4"><Form.Item name="component_type_id" label="配件类型" rules={[{ required: true }]}><Select placeholder="选择类型" options={compTypes.map(t => ({ label: t.name, value: t.id }))} onChange={fetchCompsByType} /></Form.Item><Form.Item name="old_component_id" label="移除旧件 (可选)"><Select placeholder="替换现有配件" allowClear options={currentDevice?.components?.map(c => ({ label: `${c.type_name}: ${c.component_model || c.component_name}`, value: c.component_id }))} /></Form.Item><Form.Item name="new_component_id" label="安装新件规格" rules={[{ required: true }]}><Select placeholder="选择新配件" options={availableComps.map(c => ({ label: `${c.name} (${c.model})`, value: c.id }))} /></Form.Item><Form.Item name="change_type" label="变更性质" initialValue="upgrade" rules={[{ required: true }]}><Select options={[{label:'升级 (Performance Upgrade)', value:'upgrade'}, {label:'普通更换/维修', value:'downgrade'}]} /></Form.Item><Form.Item name="reason" label="变更原因" rules={[{ required: true }]}><Input.TextArea placeholder="原因..." /></Form.Item></Form>
      </Modal>

      <Modal title="分配闲置设备" open={isAssignModalOpen} onCancel={() => setIsAssignModalOpen(false)} onOk={handleAssignSubmit} centered width={450} okText="确定分配" cancelText="取消"><Form form={form} layout="vertical" className="mt-4"><Form.Item name="asset_id" hidden><Input /></Form.Item><div className="mb-4 p-4 bg-slate-900 text-white rounded-md flex justify-between items-center"><span className="text-xs opacity-60">Target</span><b className="font-mono">{currentDevice?.asset_no}</b></div><Form.Item name="user_id" label="指派给员工" rules={[{ required: true }]}><Select showSearch placeholder="选择员工" optionFilterProp="label" options={allEmployees.map(e => ({ label: `${e.real_name} (${e.department_name})`, value: e.user_id }))} /></Form.Item></Form></Modal>

      <Modal title="一键生成并分配" open={isQuickModalOpen} onCancel={() => setIsQuickModalOpen(false)} onOk={handleAssignSubmit} centered width={450} okText="立即生成" cancelText="取消"><Form form={form} layout="vertical" className="mt-4"><Form.Item name="model_id" label="选择标准设备型号" rules={[{ required: true }]}><Select placeholder="型号库" options={devices.map(d => ({ label: d.name, value: d.id }))} /></Form.Item><Form.Item name="user_id" label="分配给员工" rules={[{ required: true }]}><Select showSearch placeholder="搜索员工" optionFilterProp="label" options={allEmployees.map(e => ({ label: `${e.real_name} (${e.department_name})`, value: e.user_id }))} /></Form.Item><div className="bg-indigo-600 text-white p-4 rounded-md text-[11px] font-bold shadow-lg shadow-indigo-100">系统将自动创建一台物理实体，生成唯一编号并拍摄型号库当前的配置快照存入该设备档案。</div></Form></Modal>
    </div>
  );
};

export default DeviceList;