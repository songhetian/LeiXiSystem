/**
 * 物理设备明细 (雷犀高级感 2.0 商务版)
 * 
 * 核心升级：
 * 1. 物理缝合搜索栏：44px 统一高度、全铺满、边框 #64748b。
 * 2. 极致紧凑表格：黑白商务配色、全量居中、信息密度最大化。
 * 3. 分页标准化：采用全局统一的高级感居中分页（黑底白字）。
 * 4. 极致本地化：全量移除英文单词，确保纯净中文体验。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  Badge, Tag, Modal, Input, Select, Form,
  Table, Avatar, Space, Card, Row, Col, Timeline, Typography, Empty, Button, Divider, Tooltip
} from 'antd';
import { 
  SearchOutlined, ReloadOutlined, InfoCircleOutlined, 
  ToolOutlined, StopOutlined, CheckCircleOutlined,
  HistoryOutlined, DesktopOutlined, UserOutlined, PlusOutlined,
  SwapOutlined,
  EyeOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import api from '../../api';
import { getImageUrl } from '../../utils/fileUtils';

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
      okText: '确定变更',
      cancelText: '取消',
      okButtonProps: { className: 'bg-black border-none font-bold' },
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
    { 
      title: '实物编号', dataIndex: 'asset_no', align: 'center', width: 160,
      render: t => <span className="font-mono font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">{t}</span> 
    },
    { title: '硬件型号', dataIndex: 'model_name', align: 'center', render: t => <span className="font-bold text-slate-700 text-xs">{t}</span> },
    { title: '运行状态', dataIndex: 'device_status', align: 'center', width: 100, render: s => {
      const map = { 
        idle: { c: 'bg-slate-100 text-slate-500', t: '闲置' }, 
        in_use: { c: 'bg-emerald-50 text-emerald-600 border border-emerald-100', t: '使用中' }, 
        damaged: { c: 'bg-rose-50 text-rose-600 border border-rose-100', t: '故障' }, 
        maintenance: { c: 'bg-orange-50 text-orange-600 border border-orange-100', t: '维修' } 
      };
      const cfg = map[s] || { c: 'bg-slate-100 text-slate-600', t: s };
      return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${cfg.c}`}>{cfg.t}</span>;
    }},
    { 
      title: '领用人员', dataIndex: 'user_name', align: 'center', width: 140,
      render: (u, r) => u ? (
        <div className="flex items-center justify-center gap-2">
          <Avatar size={20} src={getImageUrl(r.user_avatar)} icon={<UserOutlined />} className="border border-slate-100" />
          <span className="font-bold text-slate-700 text-xs">{u}</span>
        </div>
      ) : <span className="text-slate-300 font-bold text-xs italic">库房闲置</span> 
    },
    { title: '所属部门', dataIndex: 'department_name', align: 'center', render: t => <span className="text-slate-500 text-xs font-medium">{t || '-'}</span> },
    {
      title: '管理操作',
      align: 'center',
      width: 220,
      render: (_, record) => (
        <Space split={<Divider type="vertical" />}>
          <Button type="link" size="small" className="font-bold text-slate-900 text-xs" onClick={() => showQuickConfig(record)}>查看</Button>
          <Button type="link" size="small" className="font-bold text-slate-500 text-xs" onClick={() => showDetail(record)}>档案</Button>
          {record.device_status === 'in_use' ? (
            <Button type="link" size="small" danger className="font-bold text-xs" onClick={() => updateStatus(record.id, 'idle', '归还入库')}>回收</Button>
          ) : record.device_status === 'idle' ? (
            <Button type="link" size="small" className="font-bold text-emerald-600 text-xs" onClick={() => { setCurrentDevice(record); form.setFieldsValue({ asset_id: record.id }); setIsAssignModalOpen(true); }}>指派</Button>
          ) : null}
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 md:p-8 min-h-screen bg-slate-50/30">
      {/* 顶部：黑白商务标题栏 */}
      <div className="max-w-[1400px] mx-auto mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg">
              <DatabaseOutlined className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 !m-0">实机资产明细</h1>
          </div>
          <p className="text-slate-400 text-sm font-bold">全量物理设备生命周期与硬件快照管理</p>
        </div>
        <BlackButton icon={<PlusOutlined />} onClick={() => { form.resetFields(); setIsQuickModalOpen(true); }}>一键配发设备</BlackButton>
      </div>

      {/* 雷犀标准：44px 物理缝合搜索栏 */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b]">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input 
              placeholder="搜索人员姓名、设备编号或关键字..." 
              variant="borderless"
              className="h-full text-sm font-medium"
              value={filters.keyword}
              onChange={e => setFilters({...filters, keyword: e.target.value})}
              allowClear
            />
          </div>
          <Divider type="vertical" className="h-6 border-slate-200 m-0" />
          <div className="w-48 flex items-center h-[44px] px-4 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">运行状态</span>
            <Select 
              value={filters.device_status} 
              onChange={val => setFilters({...filters, device_status: val})}
              variant="borderless"
              className="w-full text-xs font-bold text-slate-700"
              placeholder="全部状态"
              allowClear
              options={[{label:'闲置', value:'idle'},{label:'使用中', value:'in_use'},{label:'故障', value:'damaged'},{label:'维修', value:'maintenance'}]}
            />
          </div>
          <button 
            onClick={fetchInstances}
            className="h-[44px] px-6 bg-black text-white hover:bg-slate-800 transition-colors flex items-center justify-center border-none"
          >
            <ReloadOutlined className={loading ? 'animate-spin' : ''} style={{ color: '#ffffff' }} />
          </button>
        </div>
      </div>

      {/* 表格区：黑白商务 & 极致紧凑 */}
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <Table 
            columns={columns} 
            dataSource={instances} 
            loading={loading} 
            rowKey="id" 
            size="middle"
            className="compact-table"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `共计 ${total} 台实机设备`,
              className: "custom-pagination"
            }}
          />
        </div>
      </div>

      {/* 配置快照弹窗 */}
      <Modal 
        title={<div className="font-black text-slate-800 text-sm">实时硬件配置快照 - {currentDevice?.asset_no}</div>}
        open={isConfigViewOpen} 
        onCancel={() => setIsConfigViewOpen(false)} 
        footer={null} 
        width={500} 
        centered 
        className="custom-modal"
      >
        <div className="py-4">
          <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
            <h2 className="text-lg font-black text-slate-900 m-0">{currentDevice?.model_name}</h2>
            <div className="mt-1 flex justify-center items-center gap-2">
              <Tag className="m-0 border-none bg-indigo-50 text-indigo-600 font-bold px-2 py-0 text-[10px]">{currentDevice?.category_name}</Tag>
              <Text className="text-[10px] text-slate-400 font-bold uppercase">{currentDevice?.form_name}</Text>
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">核心组件清单</div>
            <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
              {(currentDevice?.components || []).map((c, i) => (
                <div key={i} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-bold text-slate-500">{c.type_name}</span>
                  <span className="text-xs font-black text-slate-800">
                    {c.component_model || c.component_name}
                    {c.quantity > 1 && <span className="ml-2 text-indigo-600">×{c.quantity}</span>}
                  </span>
                </div>
              ))}
              {(currentDevice?.components?.length === 0) && (
                <div className="py-10 text-center"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该设备暂无配置快照" /></div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 生命周期档案弹窗 */}
      <Modal 
        title={<div className="font-black text-slate-800 text-sm">资产全生命周期档案 - {currentDevice?.asset_no}</div>} 
        open={isDetailOpen} onCancel={() => setIsDetailOpen(false)} footer={null} width={900} centered className="custom-modal" destroyOnHidden
      >
        {currentDevice && (
          <div className="py-2">
            <Row gutter={24}>
              <Col span={14}>
                <div className="bg-slate-50 p-6 rounded-2xl mb-6 border border-slate-100">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <Title level={5} className="m-0 font-black text-slate-900">{currentDevice.model_name}</Title>
                      <Text className="text-[10px] text-slate-400 font-bold uppercase mt-1 block">{currentDevice.category_name} · {currentDevice.form_name}</Text>
                    </div>
                    <Button type="link" size="small" className="font-black text-indigo-600 text-xs" icon={<SwapOutlined />} onClick={() => { configForm.resetFields(); setIsConfigModalOpen(true); }}>变更配置</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-6">
                    {(currentDevice.components || []).map((c, i) => (
                      <div key={i} className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-slate-100 shadow-sm">
                        <Text className="text-[9px] font-black text-slate-400 uppercase">{c.type_name}</Text>
                        <Text className="text-[11px] font-bold text-slate-700">{c.component_model || c.component_name} ×{c.quantity}</Text>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BlackButton onClick={() => updateStatus(currentDevice.id, 'damaged', '标记故障')}>报告异常</BlackButton>
                  <Button className="rounded-lg font-bold h-9 border-slate-200 text-slate-600" onClick={() => updateStatus(currentDevice.id, 'idle', '一键回收')}>执行回收</Button>
                  <Button type="link" danger className="font-bold text-xs" onClick={() => updateStatus(currentDevice.id, 'scrapped', '报废销毁')}>永久销毁</Button>
                </div>
              </Col>
              <Col span={10}>
                <div className="border-l border-slate-100 pl-6 h-full">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><HistoryOutlined /> 资产流转履历</div>
                  <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {currentDevice.history?.length > 0 ? (
                      <Timeline mode="left" className="mt-2">
                        {currentDevice.history.map((h, i) => (
                          <Timeline.Item key={i} color={h.upgrade_type === 'upgrade' ? 'green' : 'blue'} label={<span className="text-[9px] font-black text-slate-400">{new Date(h.upgrade_date).toLocaleDateString()}</span>}>
                            <div className="bg-white p-3 rounded-xl border border-slate-100 text-[11px] shadow-sm">
                              <div className="font-black text-slate-800 mb-1">{h.type_name} {h.change_type === 'upgrade' ? '性能升级' : '组件变更'}</div>
                              <div className="text-slate-500">
                                {h.old_model && <Text delete className="mr-2 opacity-40 italic">{h.old_model}</Text>}
                                <Text className="text-indigo-600 font-bold">{h.new_model}</Text>
                              </div>
                              {h.reason && <div className="mt-2 text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded-lg">“{h.reason}”</div>}
                            </div>
                          </Timeline.Item>
                        ))}
                        <Timeline.Item color="gray" label={<span className="text-[9px] font-black text-slate-400">{new Date(currentDevice.created_at).toLocaleDateString()}</span>}>
                          <div className="text-[11px] font-bold text-slate-400 italic">初始配置入库</div>
                        </Timeline.Item>
                      </Timeline>
                    ) : <div className="py-10"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史轨迹" /></div>}
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* 配置调整弹窗 */}
      <Modal title={<div className="font-black text-slate-800 text-sm">实机组件动态调整</div>} open={isConfigModalOpen} onCancel={() => setIsConfigModalOpen(false)} onOk={handleConfigSubmit} centered width={420} okText="应用变更" cancelText="放弃" className="custom-modal">
        <Form form={configForm} layout="vertical" className="mt-4">
          <Form.Item name="component_type_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">配件分类</span>} rules={[{ required: true }]}>
            <Select placeholder="选择类型..." options={compTypes.map(t => ({ label: t.name, value: t.id }))} onChange={fetchCompsByType} className="rounded-lg h-10" />
          </Form.Item>
          <Form.Item name="old_component_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">移除现有件 (可选)</span>}>
            <Select placeholder="选择要替换的组件..." allowClear options={currentDevice?.components?.map(c => ({ label: `${c.type_name}: ${c.component_model || c.component_name}`, value: c.component_id }))} className="rounded-lg h-10" />
          </Form.Item>
          <Form.Item name="new_component_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">安装新规格组件</span>} rules={[{ required: true }]}>
            <Select placeholder="选择新规格..." options={availableComps.map(c => ({ label: `${c.name} (${c.model})`, value: c.id }))} className="rounded-lg h-10" />
          </Form.Item>
          <Form.Item name="change_type" label={<span className="text-[10px] font-black text-slate-400 uppercase">变更性质</span>} initialValue="upgrade" rules={[{ required: true }]}>
            <Select options={[{label:'性能提升 (升级)', value:'upgrade'}, {label:'常规更换 (维修/维护)', value:'downgrade'}]} className="rounded-lg h-10" />
          </Form.Item>
          <Form.Item name="reason" label={<span className="text-[10px] font-black text-slate-400 uppercase">变更原因说明</span>} rules={[{ required: true }]}>
            <Input.TextArea placeholder="简述本次调整的原因..." className="rounded-lg" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 配发弹窗 */}
      <Modal title={<div className="font-black text-slate-800 text-sm">闲置资产定向指派</div>} open={isAssignModalOpen} onCancel={() => setIsAssignModalOpen(false)} onOk={handleAssignSubmit} centered width={400} okText="确认指派" cancelText="返回" className="custom-modal">
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="asset_id" hidden><Input /></Form.Item>
          <div className="mb-6 p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center shadow-lg">
            <span className="text-[10px] font-black uppercase opacity-60">目标设备编号</span>
            <b className="font-mono text-base">{currentDevice?.asset_no}</b>
          </div>
          <Form.Item name="user_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">指派至目标员工</span>} rules={[{ required: true }]}>
            <Select showSearch placeholder="搜索姓名/工号/部门..." optionFilterProp="label" options={allEmployees.map(e => ({ label: `${e.real_name} (${e.department_name})`, value: e.user_id }))} className="rounded-lg h-10" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 一键生成并配发弹窗 */}
      <Modal title={<div className="font-black text-slate-800 text-sm">新资产自动配发</div>} open={isQuickModalOpen} onCancel={() => setIsQuickModalOpen(false)} onOk={handleAssignSubmit} centered width={420} okText="立即生成" cancelText="取消" className="custom-modal">
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="model_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">选择标准硬件型号</span>} rules={[{ required: true }]}>
            <Select placeholder="检索型号库..." options={devices.map(d => ({ label: d.name, value: d.id }))} className="rounded-lg h-10" />
          </Form.Item>
          <Form.Item name="user_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">配发给目标员工</span>} rules={[{ required: true }]}>
            <Select showSearch placeholder="搜索人员档案..." optionFilterProp="label" options={allEmployees.map(e => ({ label: `${e.real_name} (${e.department_name})`, value: e.user_id }))} className="rounded-lg h-10" />
          </Form.Item>
          <div className="bg-indigo-600 text-white p-4 rounded-xl text-[11px] font-bold shadow-lg shadow-indigo-100 flex gap-3">
            <InfoCircleOutlined className="text-base" />
            <span>系统将自动创建物理实体，生成唯一资产编号并自动拍摄该型号的配置快照。</span>
          </div>
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
        .ant-btn-primary span { color: #ffffff !important; }
        .custom-pagination { margin: 24px 0 !important; display: flex !important; justify-content: center !important; }
      `}} />
    </div>
  );
};

export default DeviceList;
