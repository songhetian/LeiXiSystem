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
    Tooltip
} from 'antd';
import { 
    ShieldAlert, 
    ShieldCheck, 
    Users, 
    Plus, 
    Copy, 
    RefreshCcw, 
    Settings, 
    Search, 
    X,
    Lock,
    Eye,
    Edit3,
    Trash2,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Activity,
    Cpu
} from 'lucide-react';

const { Option } = Select;

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [form] = Form.useForm();
  const [userForm] = Form.useForm();
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [templateApplyMode, setTemplateApplyMode] = useState('merge');
  const [customTemplates, setCustomTemplates] = useState([]);
  const [isTemplateManageOpen, setIsTemplateManageOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', permission_ids: [] });
  const [departments, setDepartments] = useState([]);
  const [isBatchDeptOpen, setIsBatchDeptOpen] = useState(false);
  const [batchSelectedDepartments, setBatchSelectedDepartments] = useState([]);
  const [clonePrefix, setClonePrefix] = useState('');
  const [cloneSuffix, setCloneSuffix] = useState('副本');
  const [cloneCopyDepartments, setCloneCopyDepartments] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState({ title: '', message: '', onConfirm: null });
  const [searchText, setSearchText] = useState('');
  const [permissionSearchText, setPermissionSearchText] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState(null);

  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [selectedRoleForDepartment, setSelectedRoleForDepartment] = useState(null);

  useEffect(() => {
    fetchRoles(); fetchPermissions(); fetchPermissionTemplates();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/roles');
      if (response.success) {
        const rolesWithDepartments = await Promise.all(response.data.map(async (role) => {
          try {
            const deptRes = await apiGet(`/api/roles/${role.id}/departments`);
            if (deptRes.success) return { ...role, departments: deptRes.data };
          } catch (e) {}
          return { ...role, departments: [] };
        }));
        setRoles(rolesWithDepartments);
      }
    } catch (e) { toast.error('获取角色失败'); } finally { setLoading(false); }
  };

  const fetchPermissions = async () => {
    try {
      const res = await apiGet('/api/permissions');
      if (res.success) setPermissions(res.data);
    } catch (e) {}
  };

  const fetchPermissionTemplates = async () => {
    try {
      const res = await apiGet('/api/permission-templates');
      const data = res.success && Array.isArray(res.data) ? res.data : [];
      setCustomTemplates(data);
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const response = await apiGet('/api/users-with-roles');
      setUsers(response.success ? response.data : (Array.isArray(response) ? response : []));
    } catch (e) {}
  };

  const moduleNames = {
    system: '系统基础', user: '用户中枢', organization: '组织架构', messaging: '即时通讯', attendance: '考勤中心',
    vacation: '假期管理', quality: '质检审计', knowledge: '知识库', assessment: '绩效考核', schedule: '排班策略',
    exam: '在线考试', training: '培训赋能', memo: '工作备忘', learning: '学习中心', device: '资产管理'
  };

  // --- 关键业务逻辑补全 ---
  const handleCloneSelectedRoles = async () => {
    if (selectedRoleIds.length === 0) return;
    setIsProcessingBatch(true);
    setBatchProgress({ done: 0, total: selectedRoleIds.length });
    try {
      for (const roleId of selectedRoleIds) {
        const role = roles.find(r => r.id === roleId);
        if (!role) continue;
        const newName = `${clonePrefix || ''}${role.name}${cloneSuffix || ''}`;
        const permissionIds = (role.permissions || []).map(p => p.id);
        const res = await apiPost('/api/roles', { name: newName, description: role.description, permissionIds });
        const newRoleId = res?.data?.id || res?.id;
        if (cloneCopyDepartments && newRoleId) {
          try {
            const deptRes = await apiGet(`/api/roles/${roleId}/departments`);
            const deptIds = (deptRes?.data || []).map(d => d.id);
            if (deptIds.length > 0) await apiPut(`/api/roles/${newRoleId}/departments`, { department_ids: deptIds });
          } catch (e) {}
        }
        setBatchProgress(prev => ({ ...prev, done: prev.done + 1 }));
      }
      await fetchRoles(); setIsCloneModalOpen(false); setClonePrefix(''); setCloneSuffix('副本'); setCloneCopyDepartments(false); setSelectedRoleIds([]);
      toast.success('角色克隆任务已完成');
    } catch (error) { toast.error('克隆失败'); } finally { setIsProcessingBatch(false); setBatchProgress({ done: 0, total: 0 }); }
  };

  const filteredPermissionTreeData = useMemo(() => {
    const modules = {}; const searchLower = permissionSearchText.toLowerCase();
    permissions.forEach(p => {
      const mod = p.module || 'system'; const desc = p.description || '未命名'; const code = p.code || '';
      if (permissionSearchText && !desc.toLowerCase().includes(searchLower) && !code.toLowerCase().includes(searchLower) && !(moduleNames[mod] || '').toLowerCase().includes(searchLower)) return;
      if (!modules[mod]) modules[mod] = { title: moduleNames[mod] || '系统管理', key: `module-${mod}`, children: [] };
      modules[mod].children.push({ title: `${desc} (${code})`, key: p.id.toString(), isLeaf: true });
    });
    return Object.values(modules);
  }, [permissions, permissionSearchText]);

  const handleAdd = () => { setEditingRole(null); form.resetFields(); setCheckedKeys([]); setModalVisible(true); };
  const handleEdit = (record) => { setEditingRole(record); form.setFieldsValue(record); setCheckedKeys(record.permissions ? record.permissions.map(p => p.id.toString()) : []); setModalVisible(true); };
  const handleManageDepartments = (role) => { setSelectedRoleForDepartment(role); setIsDepartmentModalOpen(true); };
  const handleAssignUsers = async (role) => {
    setSelectedRole(role); setDrawerVisible(true); fetchUsers();
    try {
      const res = await apiGet(`/api/roles/${role.id}/users`);
      if (res.success) { const ids = res.data.map(u => u.id); setSelectedUsers(ids); userForm.setFieldsValue({ users: ids }); }
    } catch (e) {}
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const pIds = checkedKeys.filter(k => !k.startsWith('module-')).map(Number);
      const payload = { ...values, permissionIds: pIds };
      if (editingRole) await apiPut(`/api/roles/${editingRole.id}`, payload);
      else await apiPost('/api/roles', payload);
      toast.success('配置已保存'); setModalVisible(false); fetchRoles();
    } catch (e) { toast.error('保存失败'); }
  };

  const handleSaveUserAssignment = async () => {
    try {
      const values = await userForm.validateFields();
      await apiPut(`/api/roles/${selectedRole.id}/users`, { userIds: values.users });
      toast.success('成员授权成功'); setDrawerVisible(false); fetchRoles();
    } catch (e) { toast.error('分配失败'); }
  };

  const filteredRoles = useMemo(() => {
    if (!searchText) return roles;
    return roles.filter(r => r.name.toLowerCase().includes(searchText.toLowerCase()) || (r.description && r.description.toLowerCase().includes(searchText.toLowerCase())));
  }, [roles, searchText]);

  const totalPages = Math.ceil(filteredRoles.length / pageSize);
  const getCurrentPageData = () => filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); };
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); };
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); };

  const columns = [
    { title: '角色身份标识', key: 'name', align: 'center', render: (_, r) => (
        <div className="flex items-center justify-center gap-2">
            <span className="text-[14px] font-black text-slate-900">{r.name}</span>
            {r.is_system ? <span className="px-2 py-0.5 text-[9px] font-black bg-blue-100 text-blue-700 rounded-md uppercase border border-blue-200">系统内置</span> : null}
        </div>
    )},
    { title: '业务描述', dataIndex: 'description', key: 'description', align: 'center', render: (t) => <span className="text-xs font-bold text-slate-600 italic">{t || '暂无详细业务说明'}</span> },
    { title: '可见部门范围', key: 'departments', align: 'center', render: (_, r) => {
        if (!r.departments || r.departments.length === 0) return <span className="text-[10px] font-bold text-slate-400">未限制部门</span>;
        return (
            <div className="flex flex-wrap gap-1 justify-center">
                {r.departments.slice(0, 2).map(d => <span key={d.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-black border border-indigo-100">{d.name}</span>)}
                {r.departments.length > 2 && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black">+{r.departments.length - 2}</span>}
            </div>
        );
    }},
    { title: '授权项规模', key: 'permissions', align: 'center', render: (_, r) => <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100"><Lock size={12} /><span className="text-[11px] font-black">{(r.permissions || []).length} 项</span></div> },
    { title: '决策与管控', key: 'action', align: 'center', render: (_, r) => (
        <div className="flex items-center justify-center gap-1">
            <button onClick={() => handleAssignUsers(r)} className="px-3 py-1.5 text-[10px] font-black text-blue-600 hover:bg-blue-50 rounded-lg transition-all">成员授权</button>
            <button onClick={() => handleManageDepartments(r)} className="px-3 py-1.5 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">范围定义</button>
            <button onClick={() => handleEdit(r)} disabled={r.name === '超级管理员'} className="px-3 py-1.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-30">修改</button>
            {!r.is_system && <button onClick={() => { setConfirmDialogConfig({ title: '销毁角色', message: '删除角色将立即使所有关联用户的权限失效，确定执行？', onConfirm: () => apiDelete(`/api/roles/${r.id}`).then(fetchRoles) }); setIsConfirmDialogOpen(true); }} className="px-3 py-1.5 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-lg">移除</button>}
        </div>
    )}
  ];

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-xs font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{i}</button>);
    return pages;
  };

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44 },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><ShieldCheck size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">权限体系架构</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1">系统角色定义与资源访问管控</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} className="h-11 px-8 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black transition-all flex items-center gap-2 shadow-lg shadow-slate-200"><Plus size={16} /> 创建新角色</button>
            <button onClick={() => setIsCloneModalOpen(true)} className="h-11 px-6 bg-white border-2 border-slate-200 text-slate-900 font-black rounded-lg text-xs hover:bg-slate-50 transition-all flex items-center gap-2"><Copy size={16} /> 角色克隆</button>
            <button onClick={() => setIsTemplateManageOpen(true)} className="h-11 px-6 bg-white border-2 border-slate-200 text-slate-900 font-black rounded-lg text-xs hover:bg-slate-50 transition-all flex items-center gap-2"><Settings size={16} /> 模板管控</button>
            <button onClick={fetchRoles} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><RefreshCcw size={18} /></button>
          </div>
        </div>
        <div className="bg-slate-50/40 px-10 py-6">
            <div className="flex items-center gap-4 max-w-2xl">
                <div className="flex-1 relative group">
                    <input type="text" placeholder="检索角色名称或描述..." value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                        className="w-full h-11 pl-12 pr-4 bg-white border-2 border-slate-200 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                </div>
                <button onClick={() => { setSearchText(''); setCurrentPage(1); }} className="h-11 px-8 bg-white border-2 border-slate-200 text-slate-600 text-xs font-black rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"><X size={14} /> 重置</button>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
              { label: '注册角色总量', val: roles.length, color: 'indigo', icon: Activity, desc: '底层鉴权架构节点' },
              { label: '核心预置角色', val: roles.filter(r => r.is_system).length, color: 'blue', icon: Cpu, desc: '系统内建受保护策略' },
              { label: '业务自定义角色', val: roles.filter(r => !r.is_system).length, color: 'emerald', icon: ShieldCheck, desc: '灵活匹配业务管控需求' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform`}><item.icon size={24} /></div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.label}</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1">{item.val}</h3>
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{item.desc}</div>
            </div>
          ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <Table columns={columns} dataSource={getCurrentPageData()} rowKey="id" loading={loading} pagination={false}
          rowSelection={{ selectedRowKeys: selectedRoleIds, onChange: (keys) => setSelectedRoleIds(keys), columnWidth: 50 }} />
        
        {filteredRoles.length > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">共计管理 <span className="text-indigo-600">{filteredRoles.length}</span> 个权限角色</span>
                  <div className="h-4 w-[1px] bg-slate-300 mx-2" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">单页展示</span>
                  <Select size="small" value={pageSize} onChange={handlePageSizeChange} variant="borderless" className="bg-white rounded-lg shadow-sm border border-slate-300 text-[11px] font-black text-slate-900 w-24" options={[10, 20, 50].map(v => ({ label: `${v} 条`, value: v }))} />
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 hover:border-indigo-400 disabled:opacity-40 font-black text-xs">← 上一页</button>
                  <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 hover:border-indigo-400 disabled:opacity-40 font-black text-xs">下一页 →</button>
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1" controls={false} />
                      <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg"><ArrowRight size={16} /></button>
                  </div>
              </div>
          </div>
        )}
      </div>

      <AntdModal title={<div className="flex items-center gap-2 text-slate-900 font-black uppercase text-sm tracking-widest"><Settings size={18} className="text-indigo-600" />{editingRole ? '配置既有角色权限' : '定义全新权限体系'}</div>}
        open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={900} bodyStyle={{ padding: '24px' }}>
        <Form form={form} layout="vertical" className="text-left font-black">
          <Form.Item name="name" label={<span className="text-xs font-black text-slate-700 uppercase">角色官方名称</span>} rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="例如：行政高级主管、财务审计等..." className="h-11 rounded-lg border-2 border-slate-100" />
          </Form.Item>
          <Form.Item name="description" label={<span className="text-xs font-black text-slate-700 uppercase">职能边界描述</span>}>
            <Input.TextArea placeholder="简述该角色的具体职责范围..." rows={2} className="rounded-lg border-2 border-slate-100" />
          </Form.Item>
          <Form.Item label={<span className="text-xs font-black text-slate-700 uppercase">核心授权地图</span>}>
            <div className="mb-4 relative">
              <Input placeholder="搜索特定功能点或权限代码..." prefix={<Search size={16} className="text-slate-400" />} value={permissionSearchText} onChange={e => setPermissionSearchText(e.target.value)} allowClear className="h-11 rounded-lg border-2 border-slate-100" />
            </div>
            <div className="border-2 border-slate-100 rounded-xl p-6 bg-slate-50 shadow-inner max-h-[400px] overflow-y-auto">
              <Tree checkable defaultExpandAll={!permissionSearchText} onCheck={setCheckedKeys} checkedKeys={checkedKeys} treeData={filteredPermissionTreeData} virtual height={350} />
            </div>
          </Form.Item>
        </Form>
      </AntdModal>

      <Drawer title={<div className="flex items-center gap-2 font-black text-slate-900"><Users size={20} className="text-blue-600" /> 成员授权配置</div>} width={520} onClose={() => setDrawerVisible(false)} open={drawerVisible} bodyStyle={{ paddingBottom: 80 }} className="font-black">
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-100 text-left"><p className="text-[10px] font-black text-blue-400 uppercase mb-1">当前目标角色</p><h2 className="text-lg font-black text-blue-900">{selectedRole?.name}</h2></div>
        <Form form={userForm} layout="vertical">
          <Form.Item name="users" label={<span className="text-xs font-black text-slate-700 uppercase">选定授权成员</span>} rules={[{ required: true, message: '请选择至少一个用户' }]}>
            <Select mode="multiple" placeholder="在人才库中通过姓名或工号检索..." optionLabelProp="label" showSearch className="w-full custom-win11-select-flat" 
                filterOption={(i, o) => o.label.toLowerCase().indexOf(i.toLowerCase()) >= 0}>
              {users.map(user => <Option key={user.id} value={user.id} label={`${user.real_name} (${user.username})`}><div className="flex items-center gap-3 py-1"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">{user.real_name?.charAt(0)}</div><div><div className="text-sm font-black text-slate-900">{user.real_name}</div><div className="text-[10px] font-bold text-slate-400">@{user.username}</div></div></div></Option>)}
            </Select>
          </Form.Item>
        </Form>
        <div className="absolute bottom-0 left-0 w-full p-6 bg-white border-t border-slate-100 flex gap-3">
          <button onClick={() => setDrawerVisible(false)} className="flex-1 h-11 bg-slate-100 text-slate-600 font-black rounded-lg hover:bg-slate-200 transition-all uppercase text-xs">取消操作</button>
          <button onClick={handleSaveUserAssignment} className="flex-1 h-11 bg-slate-900 text-white font-black rounded-lg hover:bg-black transition-all shadow-lg shadow-slate-200 uppercase text-xs">执行授权</button>
        </div>
      </Drawer>

      <RoleDepartmentModal isOpen={isDepartmentModalOpen} onClose={() => { setIsDepartmentModalOpen(false); setSelectedRoleForDepartment(null); }} role={selectedRoleForDepartment} onSuccess={() => fetchRoles()} />
      
      <AntdModal title={<div className="flex items-center gap-2 font-black"><Copy size={18} className="text-blue-600" />角色体系快速克隆</div>} open={isCloneModalOpen} onCancel={() => setIsCloneModalOpen(false)} onOk={handleCloneSelectedRoles} okText="立即启动克隆" cancelText="取消" width={480}>
          <div className="space-y-4 py-4 text-left font-black">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-xs">已锁定 {selectedRoleIds.length} 个基准角色进行克隆</div>
              <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">命名开头</label><Input value={clonePrefix} onChange={e => setClonePrefix(e.target.value)} placeholder="如: 副本-" className="h-11 rounded-lg border-2 border-slate-100" /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase ml-1">命名结尾</label><Input value={cloneSuffix} onChange={e => setCloneSuffix(e.target.value)} placeholder="如: -2026" className="h-11 rounded-lg border-2 border-slate-100" /></div>
              </div>
              <label className="flex items-center gap-2 text-xs font-black text-slate-600 cursor-pointer hover:text-slate-900 transition-colors"><input type="checkbox" checked={cloneCopyDepartments} onChange={e => setCloneCopyDepartments(e.target.checked)} className="w-4 h-4 rounded border-slate-300" /> 同时复制部门数据可见范围</label>
          </div>
      </AntdModal>

      <AntdModal title="权限模板管控中枢" open={isTemplateManageOpen} onCancel={() => setIsTemplateManageOpen(false)} footer={null} width={1000}>
          <div className="p-4 text-center text-slate-400 font-black uppercase text-xs tracking-widest italic border-2 border-dashed border-slate-100 rounded-xl py-20">正在根据新标准重构模板编辑逻辑...</div>
      </AntdModal>

      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} />
    </div>
    </ConfigProvider>
  );
};

export default RoleManagement;
