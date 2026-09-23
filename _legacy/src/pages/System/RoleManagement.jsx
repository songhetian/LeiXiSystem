import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import RoleDepartmentModal from '../../components/RoleDepartmentModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getApiUrl } from '../../utils/apiConfig';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiClient';
import '../../styles/antd-custom.css';
import { 
    Table, 
    Button, 
    Form, 
    Input, 
    Tree, 
    Drawer, 
    Select, 
    Space, 
    Tag, 
    Card, 
    Modal as AntdModal, 
    ConfigProvider,
    InputNumber,
    Tooltip,
    Typography,
    Row,
    Col,
    Divider
} from 'antd';
import { 
    ShieldCheck, 
    Users, 
    Plus, 
    Copy,
    RefreshCcw, 
    Zap,
    Settings, 
    Search, 
    X,
    Lock,
    Activity,
    Cpu,
    Grid,
    ArrowRight,
    Layout,
    Save,
    Edit3,
    Trash2
} from 'lucide-react';

const { Option } = Select;
const { Text, Title } = Typography;

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [form] = Form.useForm();
  const [userForm] = Form.useForm();
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  
  const [customTemplates, setCustomTemplates] = useState([]);
  const [isTemplateManageOpen, setIsTemplateManageOpen] = useState(false);
  const [isTemplateEditorOpen, setIsCreateTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm] = Form.useForm();
  const [templateCheckedKeys, setTemplateCheckedKeys] = useState([]);

  const [clonePrefix, setClonePrefix] = useState('');
  const [cloneSuffix, setCloneSuffix] = useState('副本');
  const [cloneCopyDepartments, setCloneCopyDepartments] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState(null);

  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [selectedRoleForDepartment, setSelectedRoleForDepartment] = useState(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({ title: '', message: '', onConfirm: null });

  useEffect(() => {
    fetchRoles(); fetchPermissions(); fetchPermissionTemplates();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/roles');
      const data = response.success ? (Array.isArray(response.data) ? response.data : []) : [];
      const rolesWithDepartments = await Promise.all(data.map(async (role) => {
        try {
          const deptRes = await apiGet(`/api/roles/${role.id}/departments`);
          if (deptRes.success) return { ...role, departments: deptRes.data };
        } catch (e) {}
        return { ...role, departments: [] };
      }));
      setRoles(rolesWithDepartments);
    } catch (e) { toast.error('获取角色失败'); } finally { setLoading(false); }
  };

  const fetchPermissions = async () => {
    try {
      const res = await apiGet('/api/permissions');
      if (res.success && Array.isArray(res.data)) setPermissions(res.data);
    } catch (e) {}
  };

  const fetchPermissionTemplates = async () => {
    try {
      const res = await apiGet('/api/permission-templates');
      const data = res.success && Array.isArray(res.data) ? res.data : [];
      setCustomTemplates(data);
    } catch (e) { setCustomTemplates([]); }
  };

  const fetchUsers = async () => {
    try {
      const response = await apiGet('/api/users-with-roles');
      const data = response.success ? response.data : (Array.isArray(response) ? response : []);
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const moduleNames = useMemo(() => ({
    system: '系统基础', 
    user: '用户中枢', 
    permission: '权限配置', 
    organization: '组织架构',
    org: '组织管理',
    attendance: '考勤中心',
    vacation: '假期管理', 
    reimbursement: '财务报销',
    finance: '财务资产',
    asset: '资产管理',
    workflow: '审批流程',
    messaging: '即时通讯',
    quality: '质检审计', 
    knowledge: '知识库管理', 
    assessment: '绩效考核',
    schedule: '排班策略',
    exam: '在线考试',
    training: '培训赋能',
    memo: '工作备忘',
    learning: '学习中心',
    personal: '个人中心',
    personnel: '人事档案',
    role: '角色权限',
    payroll: '薪酬管理'
  }), []);

  const BUILTIN_TEMPLATES = [
    { key: 'employee_basic', name: '员工基础权限' },
    { key: 'full_access', name: '全权限体系' }
  ];

  const getTemplatePermissionIds = (tplKey) => {
    if (!tplKey) return [];
    if (tplKey.startsWith('custom:')) {
      const id = parseInt(tplKey.split(':')[1]);
      const tpl = customTemplates.find(t => t.id === id);
      return Array.isArray(tpl?.permission_ids) ? tpl.permission_ids : [];
    }
    if (tplKey === 'full_access') return permissions.map(p => p.id);
    return [];
  };

  const handleApplyTemplateToSelectedRoles = async () => {
    const templatePermissionIds = getTemplatePermissionIds(selectedTemplateKey);
    if (templatePermissionIds.length === 0) return toast.error('模板无效');
    try {
      for (const roleId of selectedRoleIds) {
        const role = roles.find(r => r.id === roleId);
        let currentIds = (role.permissions || []).map(p => p.id);
        let finalIds = templateApplyMode === 'replace' ? templatePermissionIds : [...new Set([...currentIds, ...templatePermissionIds])];
        await apiPut(`/api/roles/${roleId}`, { name: role.name, description: role.description, permissionIds: finalIds });
      }
      setIsTemplateModalOpen(false); setSelectedRoleIds([]); fetchRoles();
      toast.success('批量赋权成功');
    } catch (e) { toast.error('操作失败'); }
  };

  const handleCloneSelectedRoles = async () => {
    try {
      for (const roleId of selectedRoleIds) {
        const role = roles.find(r => r.id === roleId);
        if (!role) continue;
        const newName = `${clonePrefix || ''}${role.name}${cloneSuffix || ''}`;
        const pIds = (role.permissions || []).map(p => p.id);
        const res = await apiPost('/api/roles', { name: newName, description: role.description, permissionIds: pIds });
        const newRoleId = res?.data?.id || res?.id;
        if (cloneCopyDepartments && newRoleId) {
          const deptRes = await apiGet(`/api/roles/${roleId}/departments`);
          const deptIds = (deptRes?.data || []).map(d => d.id);
          if (deptIds.length > 0) await apiPut(`/api/roles/${newRoleId}/departments`, { department_ids: deptIds });
        }
      }
      await fetchRoles(); setIsCloneModalOpen(false); setSelectedRoleIds([]);
      toast.success('克隆完成');
    } catch (error) { toast.error('克隆失败'); }
  };

  const handleAdd = () => { setEditingRole(null); form.resetFields(); setCheckedKeys([]); setModalVisible(true); };
  const handleEdit = (record) => { setEditingRole(record); form.setFieldsValue(record); setCheckedKeys(record.permissions ? record.permissions.map(p => p.id.toString()) : []); setModalVisible(true); };
  
  const handleAssignUsers = async (role) => {
    setSelectedRole(role); setDrawerVisible(true); fetchUsers();
    try {
      const res = await apiGet(`/api/roles/${role.id}/users`);
      if (res.success && Array.isArray(res.data)) { 
        userForm.setFieldsValue({ users: res.data.map(u => u.id) }); 
      }
    } catch (e) {}
  };

  const handleSaveUserAssignment = async () => {
    try {
      const values = await userForm.validateFields();
      await apiPut(`/api/roles/${selectedRole.id}/users`, { userIds: values.users });
      toast.success('成员授权成功'); setDrawerVisible(false); fetchRoles();
    } catch (e) { toast.error('授权失败'); }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const pIds = checkedKeys.filter(k => !k.toString().startsWith('module-')).map(Number);
      const payload = { ...values, permissionIds: pIds };
      if (editingRole) await apiPut(`/api/roles/${editingRole.id}`, payload);
      else await apiPost('/api/roles', payload);
      toast.success('同步成功'); setModalVisible(false); fetchRoles();
    } catch (e) { toast.error('保存失败'); }
  };

  const handleOpenTemplateEditor = (tpl = null) => {
    setEditingTemplate(tpl);
    if (tpl) {
      templateForm.setFieldsValue({ name: tpl.name, description: tpl.description });
      setTemplateCheckedKeys(Array.isArray(tpl.permission_ids) ? tpl.permission_ids.map(String) : []);
    } else {
      templateForm.resetFields();
      setTemplateCheckedKeys([]);
    }
    setIsCreateTemplateModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      const pIds = templateCheckedKeys.filter(k => !k.toString().startsWith('module-')).map(Number);
      const payload = { ...values, permission_ids: pIds };
      if (editingTemplate) await apiPut(`/api/permission-templates/${editingTemplate.id}`, payload);
      else await apiPost('/api/permission-templates', payload);
      toast.success('模板同步成功');
      setIsCreateTemplateModalOpen(false);
      fetchPermissionTemplates();
    } catch (e) { toast.error('保存失败'); }
  };

  const filteredRoles = useMemo(() => {
    if (!searchText) return roles;
    return roles.filter(r => r.name.toLowerCase().includes(searchText.toLowerCase()) || (r.description && r.description.toLowerCase().includes(searchText.toLowerCase())));
  }, [roles, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / pageSize));
  const getCurrentPageData = () => filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); };
  
  const columns = [
    { title: <div className="text-slate-900 font-black text-center">角色身份标识</div>, key: 'name', align: 'center', render: (_, r) => (
        <div className="flex items-center justify-center gap-2 font-black">
            <span className="text-[14px] text-slate-900">{r.name}</span>
            {r.is_system ? <Tag color="blue" className="m-0 text-[9px] border-none bg-blue-100 text-blue-800">系统内置</Tag> : null}
        </div>
    )},
    { title: <div className="text-slate-900 font-black text-center">业务职能描述</div>, dataIndex: 'description', key: 'description', align: 'center', render: (t) => <Text className="text-[13px] font-black text-slate-700">{t || '-'}</Text> },
    { title: <div className="text-slate-900 font-black text-center">数据权限范围</div>, key: 'departments', align: 'center', render: (_, r) => {
        if (!r.departments || r.departments.length === 0) return <Text className="text-[11px] font-black text-slate-500">公开级访问</Text>;
        return (
            <div className="flex flex-wrap gap-1 justify-center">
                {r.departments.slice(0, 2).map(d => <Tag key={d.id} className="m-0 bg-indigo-100 text-indigo-900 border-none font-black text-[11px]">{d.name}</Tag>)}
                {r.departments.length > 2 && <Tag className="m-0 bg-slate-200 text-slate-800 border-none font-black text-[11px]">+{r.departments.length - 2}</Tag>}
            </div>
        );
    }},
    { title: <div className="text-slate-900 font-black text-center">授权点</div>, key: 'permissions', align: 'center', render: (_, r) => <Tag color="success" className="m-0 border-none font-black bg-emerald-100 text-emerald-900">{(r.permissions || []).length} 项权限</Tag> },
    { title: <div className="text-slate-900 font-black text-center">管理中枢</div>, key: 'action', align: 'center', render: (_, r) => (
        <Space size={4}>
            <Button size="small" onClick={() => handleAssignUsers(r)} className="text-[11px] font-black text-blue-700 border-blue-200 bg-blue-50/50">成员授权</Button>
            <Button size="small" onClick={() => { setSelectedRoleForDepartment(r); setIsDepartmentModalOpen(true); }} className="text-[11px] font-black text-indigo-700 border-indigo-200 bg-indigo-50/50">范围定义</Button>
            <Button size="small" onClick={() => handleEdit(r)} disabled={r.name === '超级管理员'} className="text-[11px] font-black text-emerald-700 border-emerald-200 bg-emerald-50/50">修订</Button>
            {!r.is_system && <Button size="small" onClick={() => { setConfirmDialogConfig({ title: '销毁角色', message: `确定要彻底移除 "${r.name}" 角色？`, onConfirm: () => apiDelete(`/api/roles/${r.id}`).then(fetchRoles) }); setIsConfirmDialogOpen(true); }} className="text-[11px] font-black text-rose-700 border-rose-200 bg-rose-50/50">移除</Button>}
        </Space>
    )}
  ];

  const permissionTreeData = useMemo(() => {
    const modules = {};
    permissions.forEach(p => {
      const mod = p.module || 'system';
      const label = moduleNames[mod] || mod.toUpperCase();
      if (!modules[mod]) modules[mod] = { title: <span className="font-black text-slate-900">{label}系统</span>, key: `module-${mod}`, children: [] };
      modules[mod].children.push({ title: <span className="font-black text-slate-700">{p.description || p.code}</span>, key: p.id.toString(), isLeaf: true });
    });
    return Object.values(modules);
  }, [permissions, moduleNames]);

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#000000', borderRadius: 6, controlHeight: 36, colorBorder: '#64748b' }
    }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen font-black text-left">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <Space size={16}>
            <div className="w-11 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-lg"><ShieldCheck size={22} /></div>
            <div>
                <Title level={4} className="m-0 font-black text-slate-900">权限配置架构</Title>
                <Text className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">系统角色定义与资源访问管控</Text>
            </div>
          </Space>
          <Space>
            <Button onClick={handleAdd} type="primary" icon={<Plus size={14} />} className="font-black bg-slate-900 text-white h-9 px-6 border-none flex items-center">创建角色</Button>
            <Button onClick={() => setIsTemplateManageOpen(true)} icon={<Settings size={14} />} className="font-black h-9 border-slate-400 text-slate-900">模板管理</Button>
            <Button onClick={() => setIsCloneModalOpen(true)} icon={<Copy size={14} />} className="font-black h-9 border-slate-400 text-slate-900">副本克隆</Button>
            <Button onClick={fetchRoles} icon={<RefreshCcw size={14} />} className="font-black h-9 border-slate-400 text-slate-900" />
          </Space>
        </div>
        <div className="bg-slate-50/40 px-6 py-4">
            <div className="flex items-center gap-3 max-w-xl">
                <Input placeholder="检索角色标识或职能..." value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                    className="h-9 font-black border-slate-400" prefix={<Search size={16} className="text-slate-500" />} />
                <Button onClick={() => { setSearchText(''); setCurrentPage(1); }} className="h-9 px-6 border-slate-400 font-black text-slate-700">重置</Button>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <Table columns={columns} dataSource={getCurrentPageData()} rowKey="id" loading={loading} pagination={false} size="middle"
          rowSelection={{ selectedRowKeys: selectedRoleIds, onChange: (keys) => setSelectedRoleIds(keys), columnWidth: 50 }} />
        <div className="px-6 py-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
            <Text className="text-[11px] font-black text-slate-900">共计管理 <span className="text-indigo-700">{filteredRoles.length}</span> 个权限角色节点</Text>
            <div className="flex items-center gap-2">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 px-3 rounded-lg bg-white border border-slate-400 text-slate-900 font-black text-xs disabled:opacity-30 transition-all">←</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => Math.abs(p - currentPage) < 3).map(p => (
                    <button key={p} onClick={() => handlePageChange(p)} className={`w-8 h-8 rounded-lg text-sm font-black transition-all ${currentPage === p ? 'bg-slate-900 text-white' : 'bg-white border border-slate-400 text-slate-700 hover:border-slate-900'}`}>{p}</button>
                ))}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 px-3 rounded-lg bg-white border border-slate-400 text-slate-900 font-black text-xs disabled:opacity-30 transition-all">→</button>
                <div className="flex items-center gap-2 ml-3">
                    <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={() => handlePageChange(jumpPage)} className="w-12 h-8 rounded-lg font-black text-center" controls={false} />
                    <button onClick={() => handlePageChange(jumpPage)} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-md"><ArrowRight size={14} /></button>
                </div>
            </div>
        </div>
      </div>

      <Drawer title={<div className="flex items-center gap-2 font-black text-slate-900"><Users size={20} className="text-blue-600" /> 级联授权中枢</div>} width={480} onClose={() => setDrawerVisible(false)} open={drawerVisible} styles={{ body: { paddingBottom: 80 } }} zIndex={3000}>
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 font-black"><p className="text-[10px] text-blue-400 uppercase mb-1">目标角色</p><h2 className="text-lg text-blue-900 m-0">{selectedRole?.name}</h2></div>
        <Form form={userForm} layout="vertical" className="font-black">
          <Form.Item name="users" label={<span className="text-[13px] font-black text-slate-700">选择受权成员 (实名优先)</span>} rules={[{ required: true, message: '请选择人员' }]}>
            <Select mode="multiple" placeholder="通过姓名检索..." optionLabelProp="label" showSearch className="w-full h-10 font-black" filterOption={(i, o) => o.label.toLowerCase().indexOf(i.toLowerCase()) >= 0}>
              {users.map(user => <Option key={user.id} value={user.id} label={user.real_name}><div className="flex items-center gap-3 py-1 font-black"><div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-[10px] text-slate-600">{user.real_name?.charAt(0)}</div><div><div className="text-sm text-slate-900">{user.real_name}</div><div className="text-[10px] text-slate-500">@{user.username}</div></div></div></Option>)}
            </Select>
          </Form.Item>
        </Form>
        <div className="absolute bottom-0 left-0 w-full p-6 bg-white border-t border-slate-100 flex gap-3 shadow-2xl"><button onClick={() => setDrawerVisible(false)} className="flex-1 h-11 bg-slate-100 text-slate-600 font-black rounded-lg text-xs hover:bg-slate-200 transition-all">取消</button><button onClick={handleSaveUserAssignment} className="flex-1 h-11 bg-slate-900 text-white font-black rounded-lg text-xs shadow-lg hover:bg-black transition-all">确认授权</button></div>
      </Drawer>

      <AntdModal title={<div className="flex items-center gap-2 text-slate-900 font-black uppercase text-sm tracking-widest"><Settings size={18} className="text-indigo-600" />{editingRole ? '配置修订' : '定义新角色'}</div>}
        open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={800} styles={{ body: { padding: '24px' } }} zIndex={3000} okText="同步配置" cancelText="取消">
        <Form form={form} layout="vertical" className="font-black">
          <Row gutter={24}>
            <Col span={12}><Form.Item name="name" label={<span className="text-[13px] font-black text-slate-700">角色标识 *</span>} rules={[{ required: true, message: '请输入名称' }]}><Input placeholder="输入角色名称..." className="h-9 font-black" /></Form.Item></Col>
            <Col span={12}><Form.Item label={<span className="text-[13px] font-black text-indigo-600">⚡ 快速赋权</span>}><Select placeholder="选择模板直接导入..." className="h-9 font-black" allowClear onChange={(val) => { if (!val) return; const pIds = getTemplatePermissionIds(val); if (pIds.length > 0) setCheckedKeys(pIds.map(id => id.toString())); }}><Select.OptGroup label="官方预置">{BUILTIN_TEMPLATES.map(t => <Option key={t.key} value={t.key}>{t.name}</Option>)}</Select.OptGroup><Select.OptGroup label="自定义库">{customTemplates.map(tpl => <Option key={`custom:${tpl.id}`} value={`custom:${tpl.id}`}>{tpl.name}</Option>)}</Select.OptGroup></Select></Form.Item></Col>
          </Row>
          <Form.Item name="description" label={<span className="text-[13px] font-black text-slate-700">职能描述</span>}><Input placeholder="简述该角色的业务覆盖范围..." className="h-9 font-black" /></Form.Item>
          <Form.Item label={<span className="text-[13px] font-black text-slate-700">授权地图 (中文展示)</span>}>
            <div className="border border-slate-200 rounded p-4 bg-slate-50 max-h-[350px] overflow-y-auto shadow-inner"><Tree checkable onCheck={setCheckedKeys} checkedKeys={checkedKeys} treeData={permissionTreeData} className="font-black bg-transparent" /></div>
          </Form.Item>
        </Form>
      </AntdModal>

      <AntdModal title={<div className="flex items-center justify-between w-full pr-8"><div className="flex items-center gap-2 text-slate-900 font-black"><Layout size={18} className="text-indigo-600" />权限模板库管理</div><Button type="primary" onClick={() => handleOpenTemplateEditor()} icon={<Plus size={14} />} size="small" className="bg-slate-900 text-white border-none font-black">新建模板</Button></div>} 
        open={isTemplateManageOpen} onCancel={() => setIsTemplateManageOpen(false)} footer={null} width={900} zIndex={3000}>
        <div className="py-4 font-black">
          <div className="mb-6 flex justify-between items-center"><Text className="text-slate-600 font-black">已定义的权限预设模板</Text><Button onClick={async () => { await apiPost('/api/permission-templates/create-default', {}); fetchPermissionTemplates(); toast.success('已同步默认模板'); }} size="small" className="font-black border-slate-400">重置默认模板</Button></div>
          <div className="grid grid-cols-2 gap-4">
            {customTemplates.map(tpl => (
              <div key={tpl.id} className="p-4 border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between font-black"><span className="text-slate-900 text-[15px]">{tpl.name}</span><Tag color="indigo" className="m-0 font-black text-[10px] border-none bg-indigo-100">{ (tpl.permission_ids || []).length } 项权限</Tag></div>
                <p className="text-[12px] text-slate-500 mt-1 h-8 line-clamp-2">{tpl.description || '无详细描述'}</p>
                <div className="mt-3 pt-3 border-t border-slate-50 flex justify-end gap-2">
                    <Button size="small" icon={<Edit3 size={12} />} onClick={() => handleOpenTemplateEditor(tpl)} className="text-[11px] font-black text-indigo-600 border-indigo-200">修改</Button>
                    <Button size="small" icon={<Trash2 size={12} />} danger onClick={async () => { await apiDelete(`/api/permission-templates/${tpl.id}`); fetchPermissionTemplates(); toast.success('已移除'); }} className="text-[11px] font-black">删除</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AntdModal>

      <AntdModal title={<div className="flex items-center gap-2 font-black text-slate-900"><Save size={18} className="text-indigo-600" />{editingTemplate ? '权限模板修订' : '定义新权限模板'}</div>} 
        open={isTemplateEditorOpen} onCancel={() => setIsCreateTemplateModalOpen(false)} onOk={handleSaveTemplate} okText="立即同步" cancelText="取消" width={700} zIndex={4000}>
        <Form form={templateForm} layout="vertical" className="py-4 font-black">
          <Row gutter={24}>
            <Col span={12}><Form.Item name="name" label="模板名称 *" rules={[{ required: true, message: '必填' }]}><Input placeholder="如：部门主管通用模板" className="h-9 font-black" /></Form.Item></Col>
            <Col span={12}><Form.Item name="description" label="模板职能描述"><Input placeholder="简述该预设的使用场景" className="h-9 font-black" /></Form.Item></Col>
          </Row>
          <Form.Item label="模板预设权限范围 (中文授权地图)">
            <div className="border border-slate-200 rounded p-4 bg-slate-50 max-h-[350px] overflow-y-auto shadow-inner"><Tree checkable onCheck={setTemplateCheckedKeys} checkedKeys={templateCheckedKeys} treeData={permissionTreeData} className="font-black bg-transparent" /></div>
          </Form.Item>
        </Form>
      </AntdModal>

      <AntdModal title="角色体系快速克隆" open={isCloneModalOpen} onCancel={() => setIsCloneModalOpen(false)} onOk={handleCloneSelectedRoles} okText="立即克隆" cancelText="取消" width={480} zIndex={3000}><div className="space-y-4 py-4 font-black"><div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-blue-800 text-xs">已锁定 {selectedRoleIds.length} 个角色进行副本生成</div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-slate-500 uppercase">副本前缀</label><Input value={clonePrefix} onChange={e => setClonePrefix(e.target.value)} className="h-9 rounded border-slate-300 font-black" /></div><div><label className="text-[10px] text-slate-500 uppercase">副本后缀</label><Input value={cloneSuffix} onChange={e => setCloneSuffix(e.target.value)} className="h-9 rounded border-slate-300 font-black" /></div></div><label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"><input type="checkbox" checked={cloneCopyDepartments} onChange={e => setCloneCopyDepartments(e.target.checked)} className="w-4 h-4 rounded" /> 同步复制可见范围</label></div></AntdModal>

      <RoleDepartmentModal isOpen={isDepartmentModalOpen} onClose={() => { setIsDepartmentModalOpen(false); setSelectedRoleForDepartment(null); }} role={selectedRoleForDepartment} onSuccess={() => fetchRoles()} zIndex={3000} />
      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} zIndex={5000} />
    </div>
    </ConfigProvider>
  );
};

export default RoleManagement;
