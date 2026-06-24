/**
 * 设备配置中心 (雷犀精致商务版 - 交互回归与极致本地化)
 * 
 * 核心升级：
 * 1. 修复点击失效：确保所有自定义按钮与 antd 组件的事件冒泡与执行链路闭环。
 * 2. 极致中文化：彻底清理分页、标题、描述中残余的 Total, Items 等英文。
 * 3. 视觉守护：维持纤巧分页与 44px 物理缝合搜索栏。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { 
  Badge, Tag, Modal, Form, Input, Select, 
  Table, Avatar, Space, Tabs, Card, Row, Col, Divider, Tooltip, Button, InputNumber
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
  LeftOutlined,
  RightOutlined,
  AppstoreOutlined,
  DeploymentUnitOutlined,
  TagsOutlined,
  CloseOutlined
} from '@ant-design/icons';
import api from '../../../api';
import { getImageUrl } from '../../../utils/fileUtils';
import DeviceModelEditor from './DeviceModelEditor';

// --- 样式组件：黑底白字商务按钮 (确保 onClick 事件透传) ---
const BlackButton = ({ children, icon, onClick, disabled, loading, ...props }) => (
  <button 
    onClick={onClick}
    disabled={disabled || loading}
    className="bg-black hover:bg-slate-800 text-white rounded-md h-8 px-4 flex items-center justify-center gap-2 transition-all font-bold text-[11px] shadow-sm active:scale-95 disabled:opacity-50"
    {...props}
  >
    {loading ? <ReloadOutlined className="animate-spin" /> : icon}
    <span className="text-white">{children}</span>
  </button>
);

const AssetManagement = () => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('employees');
  const [settingsActiveTab, setSettingsActiveTab] = useState('category');
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
  const [editingItem, setEditingItem] = useState(null);
  
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
    } catch (e) { toast.error('加载失败'); } finally { setLoading(false); }
  };

  const handleCompEntry = async () => {
    try {
      const values = await form.validateFields();
      let res;
      if (editingItem) res = await api.put(`/assets/components/${editingItem.id}`, values);
      else res = await api.post('/assets/components', values);
      if (res.data.success) {
        toast.success('规格保存成功');
        setIsCompEntryOpen(false);
        setEditingItem(null);
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
        toast.success('配置已更新');
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
      title: '确认移除？',
      centered: true,
      onOk: async () => {
        try {
          const res = await api.delete(endpointMap[type]);
          if (res.data.success) {
            toast.success('已移除');
            type === 'component' ? fetchMainData() : fetchBaseConfig();
          }
        } catch (e) { toast.error('无法删除'); }
      }
    });
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
        toast.success('配属成功');
        setIsAssignModalOpen(false);
        fetchMainData();
      }
    } catch (e) {}
  };

  // --- 极致本地化：纤巧版分页配置 ---
  const slimPagination = {
    pageSize: 10,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total) => <span className="text-[10px] font-black uppercase text-slate-400">共计 {total} 条数据记录</span>,
    className: "custom-pagination"
  };

  const employeeColumns = [
    {
      title: '员工姓名', dataIndex: 'real_name', align: 'center',
      render: (text, r) => <Space size="small"><Avatar size={20} src={getImageUrl(r.avatar)} icon={<UserOutlined />} /><span className="font-black text-slate-700 text-xs">{text}</span></Space>
    },
    { title: '所属部门', dataIndex: 'department_name', align: 'center', render: t => <span className="text-slate-500 text-xs">{t || '-'}</span> },
    { title: '持有实机', dataIndex: 'device_count', align: 'center', render: count => <b className="text-xs">{count} 台</b> },
    {
      title: '管理操作', align: 'center',
      render: (_, r) => (
        <Space split={<Divider type="vertical" className="border-slate-200" />}>
          <Button type="link" size="small" className="font-bold text-slate-900 text-[11px]" onClick={() => handleUserDetail(r)}>档案</Button>
          <Button type="link" size="small" className="font-bold text-indigo-600 text-[11px]" onClick={() => { setSelectedUser(r); setIsAssignModalOpen(true); fetchIdleAssets(); }}>配属</Button>
        </Space>
      )
    }
  ];

  const deviceColumns = [
    { title: '型号名称', dataIndex: 'name', align: 'center', render: t => <span className="font-black text-slate-800 text-xs">{t}</span> },
    { title: '业务分类', dataIndex: 'category_name', align: 'center', render: t => <Tag className="rounded-md border-slate-200 text-slate-500 font-bold text-[9px]">{t}</Tag> },
    { 
      title: '当前在用', dataIndex: 'assigned_count', align: 'center',
      render: (count, r) => <button className="font-black text-indigo-600 text-xs underline underline-offset-4">{count} 台</button>
    },
    {
      title: '操作', align: 'center', width: 120,
      render: (_, r) => (
        <Space split={<Divider type="vertical" />}>
          <Button type="link" size="small" className="font-bold text-slate-900 text-[11px]" onClick={() => { setSelectedDevice(r); setIsEditorOpen(true); }}>编辑</Button>
          <Button type="link" size="small" danger className="font-bold text-[11px]" onClick={() => {
             Modal.confirm({ title: '确认下架？', onOk: async () => { await api.delete(`/assets/devices/${r.id}`); fetchMainData(); } });
          }}>删除</Button>
        </Space>
      )
    }
  ];

  const componentColumns = [
    { title: '规格名称', dataIndex: 'name', align: 'center', render: t => <span className="font-bold text-slate-700 text-xs">{t}</span> },
    { title: '所属分类', dataIndex: 'type_name', align: 'center', render: t => <Tag className="m-0 border-none bg-slate-100 text-slate-500 font-bold text-[9px]">{t}</Tag> },
    { title: '核心参数', dataIndex: 'model', align: 'center', render: t => <code className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{t || '-'}</code> },
    { title: '操作', align: 'center', width: 120, render: (_, r) => (
      <Space split={<Divider type="vertical" />}>
        <Button type="link" size="small" className="font-bold text-slate-900 text-[11px]" onClick={() => { setEditingItem(r); form.setFieldsValue(r); setIsCompEntryOpen(true); }}>编辑</Button>
        <Button type="link" danger size="small" className="font-bold text-[11px]" onClick={() => handleDeleteItem('component', r)}>移除</Button>
      </Space>
    )}
  ];

  return (
    <div className="p-4 md:p-6 min-h-screen bg-slate-50/30">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center shadow-lg"><DatabaseOutlined className="text-white text-base" /></div>
            <div>
              <h1 className="text-base font-black text-slate-900 !m-0 tracking-tight">设备配置中心</h1>
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">Asset Configuration Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'devices' && <BlackButton icon={<PlusOutlined />} onClick={() => { setSelectedDevice(null); setIsEditorOpen(true); }}>新增型号</BlackButton>}
            {activeTab === 'components' && <BlackButton icon={<PlusOutlined />} onClick={() => { setEditingItem(null); form.resetFields(); setIsCompEntryOpen(true); }}>定义规格</BlackButton>}
          </div>
        </div>

        {/* 物理缝合搜索栏 */}
        <div className="flex items-center bg-white rounded-xl overflow-hidden shadow-sm border border-[#64748b] mb-6">
          <div className="flex-1 flex items-center h-[44px] px-4">
            <SearchOutlined className="text-slate-400 mr-2 text-sm" />
            <Input placeholder="输入关键字快速检索..." variant="borderless" className="h-full text-xs font-medium" value={filters.keyword} onChange={e => setFilters({...filters, keyword: e.target.value})} allowClear />
          </div>
          <Divider type="vertical" className="h-6 border-slate-200 m-0" />
          <button onClick={fetchMainData} className="h-[44px] px-5 bg-black text-white flex items-center justify-center border-none transition-all active:scale-95"><ReloadOutlined className={loading ? 'animate-spin' : ''} /></button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <Tabs 
            activeKey={activeTab} onChange={setActiveTab} size="small"
            className="custom-asset-tabs"
            items={[
              {
                key: 'employees',
                label: <span className="px-4 font-bold text-xs">员工档案</span>,
                children: <Table columns={employeeColumns} dataSource={employees} loading={loading} rowKey="user_id" size="small" pagination={slimPagination} />
              },
              {
                key: 'devices',
                label: <span className="px-4 font-bold text-xs">设备型号</span>,
                children: <Table columns={deviceColumns} dataSource={devices} loading={loading} rowKey="id" size="small" pagination={slimPagination} />
              },
              {
                key: 'components',
                label: <span className="px-4 font-bold text-xs">零配件规格</span>,
                children: <Table columns={componentColumns} dataSource={components} loading={loading} rowKey="id" size="small" pagination={slimPagination} />
              },
              {
                key: 'settings',
                label: <span className="px-4 font-bold text-xs">基础配置</span>,
                children: (
                  <div className="p-6">
                    <div className="flex bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
                      <div className="w-40 border-r border-slate-200 bg-white">
                        <div className="p-2 space-y-1">
                          {[
                            { key: 'category', label: '业务分类', icon: <AppstoreOutlined /> },
                            { key: 'form', label: '硬件形态', icon: <DeploymentUnitOutlined /> },
                            { key: 'type', label: '配件大类', icon: <TagsOutlined /> }
                          ].map(t => (
                            <div key={t.key} onClick={() => setSettingsActiveTab(t.key)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs font-bold ${settingsActiveTab === t.key ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                              {t.icon}<span>{t.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1 bg-white p-4">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            当前管理：{settingsActiveTab === 'category' ? '业务分类' : settingsActiveTab === 'form' ? '形态定义' : '配件大类'}
                          </span>
                          <BlackButton onClick={() => { form.resetFields(); setBaseModalConfig({ type: settingsActiveTab, title: `新增${settingsActiveTab === 'category' ? '业务分类' : settingsActiveTab === 'form' ? '形态' : '类型'}` }); setIsBaseModalOpen(true); }} icon={<PlusOutlined />}>新增项</BlackButton>
                        </div>
                        <Table size="small" pagination={{ ...slimPagination, pageSize: 5 }} dataSource={settingsActiveTab === 'category' ? categories : settingsActiveTab === 'form' ? forms : compTypes} rowKey="id" 
                          columns={[
                            { title: '配置项名称', dataIndex: 'name', align: 'center', render: t => <b className="text-xs text-slate-700">{t}</b> },
                            { title: '系统标识', dataIndex: 'code', align: 'center', render: t => t ? <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{t}</code> : '-' },
                            { title: '管理', align: 'center', width: 60, render: (_, r) => <Button type="link" danger size="small" onClick={() => handleDeleteItem(settingsActiveTab, r)} icon={<CloseOutlined className="text-[10px]" />} /> }
                          ]} />
                      </div>
                    </div>
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>

      <DeviceModelEditor isOpen={isEditorOpen} deviceId={selectedDevice?.id} onClose={() => { setIsEditorOpen(false); setSelectedDevice(null); }} onSave={fetchMainData} categories={categories} forms={forms} />

      <Modal title={<div className="font-black text-slate-800 text-sm">{editingItem ? '编辑规格' : '定义新规格'}</div>} open={isCompEntryOpen} onCancel={() => { setIsCompEntryOpen(false); setEditingItem(null); }} onOk={handleCompEntry} centered okText="提交保存" cancelText="取消" className="custom-modal">
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="type_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">所属分类</span>} rules={[{ required: true, message: '请选择分类' }]}><Select placeholder="请选择..." options={compTypes.map(t => ({ label: t.name, value: t.id }))} /></Form.Item>
          <Form.Item name="name" label={<span className="text-[10px] font-black text-slate-400 uppercase">名称</span>} rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="规格全称..." /></Form.Item>
          <Form.Item name="model" label={<span className="text-[10px] font-black text-slate-400 uppercase">参数</span>}><Input placeholder="型号细节..." /></Form.Item>
          <Form.Item name="notes" label={<span className="text-[10px] font-black text-slate-400 uppercase">备注</span>}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal title={<div className="font-black text-slate-800 text-sm">{baseModalConfig.title}</div>} open={isBaseModalOpen} onCancel={() => setIsBaseModalOpen(false)} onOk={handleBaseSubmit} centered okText="确认" cancelText="取消" className="custom-modal">
        <Form form={form} layout="vertical" className="mt-4"><Form.Item name="name" label={<span className="text-[10px] font-black text-slate-400 uppercase">名称</span>} rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item>{baseModalConfig.type === 'category' && <Form.Item name="code" label={<span className="text-[10px] font-black text-slate-400 uppercase">识别码 (可选)</span>}><Input placeholder="系统自动生成" /></Form.Item>}</Form>
      </Modal>

      <Modal title={<div className="font-black text-slate-800 text-sm">资产配属执行</div>} open={isAssignModalOpen} onCancel={() => setIsAssignModalOpen(false)} onOk={handleAssignSubmit} centered width={400} okText="立即配属" cancelText="取消" className="custom-modal">
        <Form form={form} layout="vertical" className="mt-4">
          <Tabs activeKey={assignMode} onChange={setAssignMode} size="small" className="mb-4" items={[{ key: 'new', label: '新机配发' }, { key: 'existing', label: '库存复用' }]} />
          {assignMode === 'new' ? (
            <Form.Item name="model_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">选择硬件型号</span>} rules={[{ required: true }]}><Select placeholder="检索型号..." options={devices.map(d => ({ label: d.name, value: d.id }))} /></Form.Item>
          ) : (
            <Form.Item name="asset_id" label={<span className="text-[10px] font-black text-slate-400 uppercase">选择闲置设备</span>} rules={[{ required: true }]}><Select placeholder="搜索闲置库..." options={idleAssets.map(a => ({ label: `${a.asset_no} - ${a.model_name}`, value: a.id }))} /></Form.Item>
          )}
        </Form>
      </Modal>

      {/* 员工设备档案 */}
      <Modal title={<div className="font-black text-slate-800 text-sm">设备资产档案 - {selectedUser?.real_name}</div>} open={isUserDetailOpen} onCancel={() => setIsUserDetailOpen(false)} footer={null} width={800} centered className="custom-modal">
        <Table dataSource={userAssets} rowKey="id" pagination={false} size="small" className="compact-table" columns={[
          { title: '物理编号', dataIndex: 'asset_no', align: 'center', render: t => <code className="font-black text-[10px] bg-slate-100 px-2 py-0.5 rounded">{t}</code> },
          { title: '型号名称', dataIndex: 'model_name', align: 'center', render: t => <span className="font-bold text-xs">{t}</span> },
          { title: '当前配置', align: 'center', render: r => <div className="flex flex-wrap justify-center gap-1">{(r.components||[]).map((c, i) => <Tag key={i} className="text-[9px] m-0 border-none bg-indigo-50 text-indigo-600 font-bold px-1.5">{c.component_model || c.component_name}</Tag>)}</div> },
          { title: '运行状态', dataIndex: 'device_status', align: 'center', width: 100, render: s => (
            <div className="flex items-center justify-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${s==='in_use'?'bg-emerald-500':s==='damaged'?'bg-rose-500':'bg-slate-300'}`}></div>
              <span className="text-[11px] font-bold text-slate-600">{s==='in_use'?'服役中':s==='damaged'?'待修':'闲置'}</span>
            </div>
          )},
          { title: '操作', align: 'center', width: 120, render: (_, r) => <Button type="link" danger size="small" className="font-black text-xs" onClick={() => { Modal.confirm({ title: '确认回收此设备？', content: '资产将重置为闲置状态。', centered: true, onOk: async() => { await api.post('/assets/return',{asset_id:r.id}); handleUserDetail(selectedUser); fetchMainData(); } }); }}>回收</Button> }
        ]} />
      </Modal>

      <style dangerouslySetInnerHTML={{ __html: `
        .ant-table-thead > tr > th { background: #fcfcfd !important; color: #64748b !important; font-weight: 900 !important; text-transform: uppercase !important; font-size: 10px !important; text-align: center !important; height: 40px !important; }
        .ant-table-tbody > tr > td { text-align: center !important; font-size: 12px !important; border-bottom: 1px solid #f1f5f9 !important; padding: 8px !important; }
        .custom-asset-tabs .ant-tabs-nav { margin-bottom: 0 !important; border-bottom: 1px solid #f1f5f9; padding: 0 12px; }
        .ant-modal-content { border-radius: 16px !important; padding: 20px !important; }
      `}} />
    </div>
  );
};

export default AssetManagement;
