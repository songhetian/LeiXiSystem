/**
 * 设备配置中心 (雷犀高级感 2.0 商务版 - 极致本地化)
 * 
 * 核心升级：
 * 1. 全面去英文：移除 UNITS, GENERIC, SKU 等所有非中文字符，改为“台”、“标准”、“型号库”等。
 * 2. 物理缝合搜索栏：44px 统一高度、全铺满、边框 #64748b。
 * 3. 极致紧凑表格：黑白商务配色、全量居中、信息密度最大化。
 * 4. 规范分页：采用商务黑白风格的分页组件，居中展示。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  Badge, Tag, Modal, Form, Input, Select, 
  Table, Avatar, Space, Tabs, Card, Row, Col, Divider, Tooltip, Button
} from 'antd';
import { 
  UserOutlined, 
  SearchOutlined,
  PlusOutlined,
  ReloadOutlined,
  BuildOutlined,
  SettingOutlined,
  LayoutOutlined,
  DatabaseOutlined,
  CheckCircleFilled,
  ExclamationCircleOutlined,
  FilterOutlined,
  ArrowRightOutlined,
  CloseOutlined
} from '@ant-design/icons';
import api from '../../../api';
import { getImageUrl } from '../../../utils/fileUtils';
import DeviceModelEditor from './DeviceModelEditor';

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

const AssetManagement = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('employees');
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ keyword: '', department_id: null });

  // 数据状态
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [compTypes, setCompTypes] = useState([]);
  const [forms, setForms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [devices, setDevices] = useState([]);
  const [components, setComponents] = useState([]);
  const [idleAssets, setIdleAssets] = useState([]);
  const [userAssets, setUserAssets] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [assignedFilters, setAssignedFilters] = useState({ keyword: '', department_id: null });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isBaseModalOpen, setIsBaseModalOpen] = useState(false);
  const [baseModalConfig, setBaseModalConfig] = useState({ type: '', title: '' });
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCompEntryOpen, setIsCompEntryOpen] = useState(false);
  const [isUserDetailOpen, setIsUserDetailOpen] = useState(false);
  const [isAssignedModalOpen, setIsAssignedModalOpen] = useState(false);
  
  const [assignMode, setAssignMode] = useState('new');

  useEffect(() => { fetchMainData(); }, [activeTab, filters]);
  useEffect(() => { fetchBaseConfig(); fetchFilterData(); }, []);
  useEffect(() => { if (isAssignedModalOpen && selectedDevice) fetchAssignedUsers(); }, [isAssignedModalOpen, assignedFilters]);

  const fetchFilterData = async () => {
    try {
      const [deptRes, posRes] = await Promise.all([api.get('/departments'), api.get('/positions')]);
      setDepartments(Array.isArray(deptRes.data) ? deptRes.data : (deptRes.data.data || []));
      setPositions(Array.isArray(posRes.data) ? posRes.data : (posRes.data.data || []));
    } catch (e) {}
  };

  const fetchBaseConfig = async () => {
    try {
      const [catRes, typeRes, formRes] = await Promise.all([api.get('/assets/categories'), api.get('/assets/component-types'), api.get('/assets/forms')]);
      if (catRes.data.success) setCategories(catRes.data.data);
      if (formRes.data.success) setForms(formRes.data.data);
      if (typeRes.data.success) setCompTypes(typeRes.data.data);
    } catch (e) {}
  };

  const fetchMainData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'employees') {
        const res = await api.get('/assets/employee-centric', { params: filters });
        if (res.data.success) setEmployees(res.data.data);
      } else if (activeTab === 'devices') {
        const res = await api.get('/assets/devices');
        if (res.data.success) setDevices(res.data.data);
      } else if (activeTab === 'components') {
        const res = await api.get('/assets/components');
        if (res.data.success) setComponents(res.data.data);
      }
    } catch (e) { toast.error('加载数据失败'); } finally { setLoading(false); }
  };

  const fetchAssignedUsers = async () => {
    try {
      const res = await api.get(`/assets/devices/${selectedDevice.id}/users`, { params: assignedFilters });
      if (res.data.success) setAssignedUsers(res.data.data);
    } catch (e) {}
  };

  const fetchIdleAssets = async () => {
    try {
      const res = await api.get('/assets/idle');
      if (res.data.success) setIdleAssets(res.data.data);
    } catch (e) {}
  };

  const handleUserDetail = async (user) => {
    setSelectedUser(user);
    setLoading(true);
    try {
      const res = await api.get(`/assets/employee/${user.user_id}`);
      if (res.data.success) { setUserAssets(res.data.data); setIsUserDetailOpen(true); }
    } catch (e) {} finally { setLoading(false); }
  };

  const handleAssignSubmit = async () => {
    try {
      const values = await form.validateFields();
      const res = await api.post('/assets/assign', { ...values, user_id: selectedUser.user_id });
      if (res.data.success) {
        toast.success('设备配属成功');
        setIsAssignModalOpen(false);
        fetchMainData();
      }
    } catch (e) {}
  };

  const handleCompEntry = async () => {
    try {
      const values = await form.validateFields();
      const res = await api.post('/assets/components', values);
      if (res.data.success) {
        toast.success('规格保存成功');
        setIsCompEntryOpen(false);
        fetchMainData();
      }
    } catch (e) {}
  };

  const handleBaseSubmit = async () => {
    try {
      const values = await form.validateFields();
      const endpoint = baseModalConfig.type === 'category' ? '/assets/categories' : 
                       baseModalConfig.type === 'form' ? '/assets/forms' : '/assets/component-types';
      const res = await api.post(endpoint, values);
      if (res.data.success) {
        toast.success('配置已生效');
        setIsBaseModalOpen(false);
        fetchBaseConfig();
      }
    } catch (e) {}
  };

  const handleDeleteItem = (type, record) => {
    const endpointMap = {
      category: `/assets/categories/${record.id}`,
      form: `/assets/forms/${record.id}`,
      type: `/assets/component-types/${record.id}`,
      component: `/assets/components/${record.id}`
    };
    
    Modal.confirm({
      title: '确认移除此配置？',
      content: '该操作将永久移除此项，若已被关联使用则无法删除。',
      centered: true,
      okText: '确认移除',
      cancelText: '取消',
      okButtonProps: { danger: true, className: "rounded-lg font-bold" },
      cancelButtonProps: { className: "rounded-lg font-bold" },
      onOk: async () => {
        try {
          const res = await api.delete(endpointMap[type]);
          if (res.data.success) {
            toast.success('已成功移除');
            type === 'component' ? fetchMainData() : fetchBaseConfig();
          }
        } catch (e) {
          toast.error(e.response?.data?.message || '移除失败，请检查关联关系');
        }
      }
    });
  };

  // 表格通用分页配置
  const commonPagination = {
    pageSize: 10,
    showSizeChanger: false,
    position: ['bottomCenter'], // 强制居中
    showTotal: (total) => `共计 ${total} 条数据`,
    className: "custom-pagination"
  };

  const employeeColumns = [
    {
      title: '员工姓名', dataIndex: 'real_name', align: 'center', width: 120,
      render: (text, r) => <Space size="small"><Avatar size={24} src={getImageUrl(r.avatar)} icon={<UserOutlined />} className="border border-slate-100" /><span className="font-bold text-slate-800 text-xs">{text}</span></Space>
    },
    { title: '所属部门', dataIndex: 'department_name', align: 'center', width: 150, render: t => <span className="text-slate-500 font-medium text-xs">{t || '-'}</span> },
    { title: '现任职位', dataIndex: 'position_name', align: 'center', width: 150, render: t => <span className="text-slate-400 font-bold text-[11px] uppercase">{t || '-'}</span> },
    { 
      title: '持有实机', dataIndex: 'device_count', align: 'center', width: 100,
      render: count => <Tag color={count > 0 ? 'black' : 'default'} className="m-0 border-none font-black text-[10px] rounded-md">{count} 台</Tag>
    },
    {
      title: '管理操作', align: 'center', width: 160,
      render: (_, r) => (
        <Space split={<Divider type="vertical" />}>
          <Button type="link" size="small" className="font-bold text-slate-900 text-xs" onClick={() => handleUserDetail(r)}>档案</Button>
          <Button type="link" size="small" className="font-bold text-indigo-600 text-xs" onClick={() => { setSelectedUser(r); setIsAssignModalOpen(true); fetchIdleAssets(); }}>配属</Button>
        </Space>
      )
    }
  ];

  const deviceColumns = [
    { title: '硬件型号', dataIndex: 'name', align: 'center', render: t => <span className="font-black text-slate-800 text-sm">{t}</span> },
    { title: '业务分类', dataIndex: 'category_name', align: 'center', render: t => <Tag className="rounded-md border-slate-200 text-slate-500 font-bold text-[10px]">{t}</Tag> },
    { title: '设备形态', dataIndex: 'form_name', align: 'center', render: t => <span className="text-slate-400 font-black text-[10px]">{t}</span> },
    { 
      title: '在用数量', dataIndex: 'assigned_count', align: 'center', width: 120,
      render: (count, r) => (
        <button onClick={() => { setSelectedDevice(r); setIsAssignedModalOpen(true); }} className="font-black text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors text-xs underline underline-offset-4">
          {count} 台
        </button>
      )
    },
    {
      title: '管理操作', align: 'center', width: 150,
      render: (_, r) => (
        <Space split={<Divider type="vertical" />}>
          <Button type="link" size="small" className="font-bold text-slate-900 text-xs" onClick={() => { setSelectedDevice(r); setIsEditorOpen(true); }}>编辑</Button>
          <Button type="link" size="small" danger className="font-bold text-xs" onClick={() => {
             Modal.confirm({ title: '确认下架此型号？', content: '仅支持无领用记录的型号移除。', centered: true, onOk: async () => { await api.delete(`/assets/devices/${r.id}`); fetchMainData(); } });
          }}>删除</Button>
        </Space>
      )
    }
  ];

  const componentColumns = [
    { title: '规格组件名称', dataIndex: 'name', align: 'center', render: t => <span className="font-bold text-slate-700 text-xs">{t}</span> },
    { title: '组件分类', dataIndex: 'type_name', align: 'center', render: t => <Tag className="m-0 border-none bg-slate-100 text-slate-500 font-bold text-[10px]">{t}</Tag> },
    { title: '核心参数', dataIndex: 'model', align: 'center', render: t => <code className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{t || '标准规格'}</code> },
    { title: '管理操作', align: 'center', width: 100, render: (_, r) => <Button type="link" danger size="small" className="font-bold text-xs" onClick={() => handleDeleteItem('component', r)}>移除</Button> }
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
            <h1 className="text-2xl font-black text-slate-900 !m-0">设备配置中心</h1>
          </div>
          <p className="text-slate-400 text-sm font-bold">后勤管理与资产档案枢纽</p>
        </div>
        
        <div className="flex items-center gap-3">
          {activeTab === 'devices' && <BlackButton icon={<PlusOutlined />} onClick={() => { setSelectedDevice(null); setIsEditorOpen(true); }}>发布新型号</BlackButton>}
          {activeTab === 'components' && <BlackButton icon={<PlusOutlined />} onClick={() => setIsCompEntryOpen(true)}>定义新规格</BlackButton>}
        </div>
      </div>

      {/* 雷犀标准：44px 物理缝合搜索栏 */}
      <div className="max-w-[1400px] mx-auto mb-8">
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b]">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-3" />
            <Input 
              placeholder="搜索姓名、编号或资产描述..." 
              variant="borderless"
              className="h-full text-sm font-medium"
              value={filters.keyword}
              onChange={e => setFilters({...filters, keyword: e.target.value})}
              allowClear
            />
          </div>
          <Divider type="vertical" className="h-6 border-slate-200 m-0" />
          <div className="w-48 flex items-center h-[44px] px-4 bg-slate-50/50">
            <span className="text-[10px] font-black text-slate-400 uppercase mr-3 shrink-0">所属部门</span>
            <Select 
              value={filters.department_id} 
              onChange={val => setFilters({...filters, department_id: val})}
              variant="borderless"
              className="w-full text-xs font-bold text-slate-700"
              placeholder="全公司"
              allowClear
              options={departments.map(d => ({ label: d.name, value: d.id }))}
            />
          </div>
          <button 
            onClick={fetchMainData}
            className="h-[44px] px-6 bg-black text-white hover:bg-slate-800 transition-colors flex items-center justify-center border-none"
          >
            <ReloadOutlined className={loading ? 'animate-spin' : ''} style={{ color: '#ffffff' }} />
          </button>
        </div>
      </div>

      {/* 核心内容区 */}
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab} 
            className="custom-asset-tabs"
            items={[
              {
                key: 'employees',
                label: <span className="px-6 font-bold flex items-center gap-2"><UserOutlined />员工配属档案</span>,
                children: (
                  <div className="p-0">
                    <Table columns={employeeColumns} dataSource={employees} loading={loading} rowKey="user_id" size="middle" pagination={commonPagination} className="compact-table" />
                  </div>
                )
              },
              {
                key: 'devices',
                label: <span className="px-6 font-bold flex items-center gap-2"><BuildOutlined />设备型号库</span>,
                children: (
                  <div className="p-0">
                    <Table columns={deviceColumns} dataSource={devices} loading={loading} rowKey="id" size="middle" pagination={commonPagination} className="compact-table" />
                  </div>
                )
              },
              {
                key: 'components',
                label: <span className="px-6 font-bold flex items-center gap-2"><LayoutOutlined />配件规格库</span>,
                children: (
                  <div className="p-0">
                    <Table columns={componentColumns} dataSource={components} loading={loading} rowKey="id" size="middle" pagination={commonPagination} className="compact-table" />
                  </div>
                )
              },
              {
                key: 'settings',
                label: <span className="px-6 font-bold flex items-center gap-2"><SettingOutlined />基础配置中心</span>,
                children: (
                  <div className="p-6">
                    <Row gutter={24}>
                      <Col span={8}>
                        <Card title={<span className="text-xs font-black uppercase tracking-wider text-slate-400">业务分类</span>} size="small" className="rounded-xl border-slate-200 shadow-none" extra={<Button type="link" size="small" className="font-bold text-black" onClick={() => { setBaseModalConfig({ type: 'category', title: '配置业务分类' }); setIsBaseModalOpen(true); }}>增加</Button>}>
                          <Table size="small" pagination={false} dataSource={categories} rowKey="id" columns={[{ title: '名称', dataIndex: 'name', align: 'center', render: t => <span className="font-bold text-xs">{t}</span> }, { title: '操作', align: 'center', render: (_, r) => <Button type="link" danger size="small" onClick={() => handleDeleteItem('category', r)} icon={<CloseOutlined className="text-[10px]" />} /> }]} className="mini-table" />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card title={<span className="text-xs font-black uppercase tracking-wider text-slate-400">设备形态</span>} size="small" className="rounded-xl border-slate-200 shadow-none" extra={<Button type="link" size="small" className="font-bold text-black" onClick={() => { setBaseModalConfig({ type: 'form', title: '配置形态' }); setIsBaseModalOpen(true); }}>增加</Button>}>
                          <Table size="small" pagination={false} dataSource={forms} rowKey="id" columns={[{ title: '名称', dataIndex: 'name', align: 'center', render: t => <span className="font-bold text-xs">{t}</span> }, { title: '操作', align: 'center', render: (_, r) => <Button type="link" danger size="small" onClick={() => handleDeleteItem('form', r)} icon={<CloseOutlined className="text-[10px]" />} /> }]} className="mini-table" />
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card title={<span className="text-xs font-black uppercase tracking-wider text-slate-400">配件大类</span>} size="small" className="rounded-xl border-slate-200 shadow-none" extra={<Button type="link" size="small" className="font-bold text-black" onClick={() => { setBaseModalConfig({ type: 'type', title: '配置类型' }); setIsBaseModalOpen(true); }}>增加</Button>}>
                          <Table size="small" pagination={false} dataSource={compTypes} rowKey="id" columns={[{ title: '名称', dataIndex: 'name', align: 'center', render: t => <span className="font-bold text-xs">{t}</span> }, { title: '操作', align: 'center', render: (_, r) => <Button type="link" danger size="small" onClick={() => handleDeleteItem('type', r)} icon={<CloseOutlined className="text-[10px]" />} /> }]} className="mini-table" />
                        </Card>
                      </Col>
                    </Row>
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>

      <DeviceModelEditor isOpen={isEditorOpen} deviceId={selectedDevice?.id} onClose={() => { setIsEditorOpen(false); setSelectedDevice(null); }} onSave={fetchMainData} categories={categories} forms={forms} />

      {/* 领用名单详情 */}
      <Modal title={<div className="font-black text-slate-800 text-sm">领用人员清单 - {selectedDevice?.name}</div>} open={isAssignedModalOpen} onCancel={() => setIsAssignedModalOpen(false)} footer={null} width={800} centered className="custom-modal">
        <div className="mb-6 bg-slate-50 p-3 rounded-xl flex gap-3 border border-slate-100">
          <Input placeholder="搜索姓名或资产编号..." prefix={<SearchOutlined />} className="rounded-lg h-9" allowClear onChange={e => setAssignedFilters({...assignedFilters, keyword: e.target.value})} />
          <Select placeholder="筛选部门" className="w-48 rounded-lg" allowClear options={departments.map(d => ({ label: d.name, value: d.id }))} onChange={val => setAssignedFilters({...assignedFilters, department_id: val})} />
        </div>
        <Table dataSource={assignedUsers} rowKey="user_id" pagination={{ ...commonPagination, pageSize: 5 }} size="small" className="compact-table" columns={[
          { title: '领用人', dataIndex: 'real_name', align: 'center', render: (text, r) => <Space size="small"><Avatar size={20} src={getImageUrl(r.avatar)} /><b>{text}</b></Space> },
          { title: '所属部门', dataIndex: 'department_name', align: 'center' },
          { title: '资产编号', dataIndex: 'asset_no', align: 'center', render: t => <code className="text-indigo-600 font-black text-[10px]">{t}</code> },
          { title: '配属时间', dataIndex: 'assigned_at', align: 'center', render: d => <span className="text-[10px] font-mono text-slate-400">{new Date(d).toLocaleDateString()}</span> }
        ]} />
      </Modal>

      {/* 员工设备档案 */}
      <Modal title={<div className="font-black text-slate-800 text-sm">设备资产档案 - {selectedUser?.real_name}</div>} open={isUserDetailOpen} onCancel={() => setIsUserDetailOpen(false)} footer={null} width={800} centered className="custom-modal">
        <Table dataSource={userAssets} rowKey="id" pagination={false} size="small" className="compact-table" columns={[
          { title: '物理编号', dataIndex: 'asset_no', align: 'center', render: t => <code className="font-black text-[10px] bg-slate-100 px-2 py-0.5 rounded">{t}</code> },
          { title: '设备型号', dataIndex: 'model_name', align: 'center', render: t => <span className="font-bold text-xs">{t}</span> },
          { title: '详细配置', align: 'center', render: r => <div className="flex flex-wrap justify-center gap-1">{(r.components||[]).map((c, i) => <Tag key={i} className="text-[9px] m-0 border-none bg-indigo-50 text-indigo-600 font-bold px-1.5">{c.component_model || c.component_name}</Tag>)}</div> },
          { title: '运行状态', dataIndex: 'device_status', align: 'center', width: 100, render: s => (
            <div className="flex items-center justify-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${s==='in_use'?'bg-emerald-500':s==='damaged'?'bg-rose-500':'bg-slate-300'}`}></div>
              <span className="text-[11px] font-bold text-slate-600">{s==='in_use'?'服役中':s==='damaged'?'待修':'闲置'}</span>
            </div>
          )},
          { title: '管理操作', align: 'center', width: 120, render: (_, r) => <Button type="link" danger size="small" className="font-black text-xs" onClick={() => { Modal.confirm({ title: '确认回收此设备？', content: '回收后该资产将重置为闲置状态。', centered: true, onOk: async() => { await api.post('/assets/return',{asset_id:r.id}); handleUserDetail(selectedUser); fetchMainData(); } }); }}>执行回收</Button> }
        ]} />
      </Modal>

      {/* 业务弹窗 */}
      <Modal title={<div className="font-black text-slate-800 text-sm">执行资产配属</div>} open={isAssignModalOpen} onCancel={() => setIsAssignModalOpen(false)} onOk={handleAssignSubmit} centered width={400} okText="确认配属" cancelText="返回" className="custom-modal">
        <Form form={form} layout="vertical" className="mt-4">
          <Tabs activeKey={assignMode} onChange={setAssignMode} size="small" className="mb-4" items={[{ key: 'new', label: '新机发放' }, { key: 'existing', label: '库存重用' }]} />
          {assignMode === 'new' ? (
            <Form.Item name="model_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">选择标准硬件型号</span>} rules={[{ required: true }]}>
              <Select placeholder="检索型号库..." options={devices.map(d => ({ label: d.name, value: d.id }))} className="rounded-lg h-10" />
            </Form.Item>
          ) : (
            <Form.Item name="asset_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">选择闲置设备实例</span>} rules={[{ required: true }]}>
              <Select placeholder="检索闲置库..." options={idleAssets.map(a => ({ label: `${a.asset_no} - ${a.model_name}`, value: a.id }))} className="rounded-lg h-10" />
            </Form.Item>
          )}
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
        .custom-asset-tabs .ant-tabs-nav { margin-bottom: 0 !important; border-bottom: 1px solid #e2e8f0; }
        .compact-table .ant-table-row:hover { background: #fcfcfd !important; }
        .mini-table .ant-table-thead > tr > th { padding: 8px !important; font-size: 9px !important; }
        .ant-modal-content { border-radius: 24px !important; padding: 24px !important; }
        .ant-btn-primary span { color: #ffffff !important; }
        
        /* 分页居中标准样式 */
        .custom-pagination { 
          margin: 24px 0 !important;
          display: flex !important;
          justify-content: center !important;
          width: 100% !important;
        }
        .ant-pagination-item { border-radius: 8px !important; border-color: #f1f5f9 !important; }
        .ant-pagination-item-active { background: #000000 !important; border-color: #000000 !important; }
        .ant-pagination-item-active a { color: #ffffff !important; }
      `}} />
    </div>
  );
};

export default AssetManagement;
