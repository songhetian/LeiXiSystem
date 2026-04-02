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
    Zap,
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
    Cpu,
    Grid,
    List,
    FilePlus,
    Layout
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
  const [templateSearchText, setTemplateSearchText] = useState('');

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
    } catch (e) { setCustomTemplates([]); }
  };

  const fetchDepartments = async () => {
    try {
      const res = await apiGet('/api/departments');
      const data = res.success ? (res.data || []) : (Array.isArray(res) ? res : []);
      setDepartments((data || []).filter(d => d.status === 'active'));
    } catch { setDepartments([]); }
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

  const BUILTIN_TEMPLATES = [
    { key: 'customer_basic', name: '客服基础', modules: ['quality', 'knowledge', 'personal', 'messaging'] },
    { key: 'attendance_admin', name: '考勤管理员', modules: ['attendance', 'vacation'] },
    { key: 'org_admin', name: '组织管理员', modules: ['system', 'user', 'organization'] },
    { key: 'employee_basic', name: '员工基础权限', permissions: ['messaging:broadcast:view','attendance:record:view','vacation:record:view','attendance:approval:manage','vacation:approval:manage','knowledge:article:view','assessment:plan:view','assessment:result:view','user:profile:update','user:memo:manage'] },
    { key: 'full_access', name: '全权限体系', modules: ['system', 'user', 'organization', 'messaging', 'attendance', 'vacation', 'quality', 'knowledge', 'assessment', 'finance', 'payroll', 'reimbursement', 'personal', 'personnel'] }
  ];

  const getTemplatePermissionIds = (tplKey) => {
    if (!tplKey) return [];
    
    // 🛡️ 雷犀强化：优先处理自定义模板
    if (tplKey.startsWith('custom:')) {
      const id = parseInt(tplKey.split(':')[1]);
      const tpl = customTemplates.find(t => t.id === id);
      return Array.isArray(tpl?.permission_ids) ? tpl.permission_ids : [];
    }
    
    // 🛡️ 雷犀强化：处理内置模板，增加数据加载校验
    const tpl = BUILTIN_TEMPLATES.find(t => t.key === tplKey);
    if (!tpl || !permissions || permissions.length === 0) return [];
    
    if (tpl.permissions) {
      // 🚀 精准代码匹配
      return permissions
        .filter(p => p.code && tpl.permissions.includes(p.code))
        .map(p => p.id);
    }
    
    if (tpl.modules) {
      // 🚀 模块归类匹配
      return permissions
        .filter(p => p.module && tpl.modules.includes(p.module))
        .map(p => p.id);
    }
    
    return [];
  };

  const handleApplyTemplateToSelectedRoles = async () => {
    if (!selectedTemplateKey || selectedRoleIds.length === 0) return toast.error('请选择模板和角色');
    setIsProcessingBatch(true);
    try {
      const templatePermissionIds = getTemplatePermissionIds(selectedTemplateKey);
      for (const roleId of selectedRoleIds) {
        const roleRes = await apiGet(`/api/roles/${roleId}`);
        const rData = roleRes.success ? roleRes.data : (roleRes[0] || roleRes);
        let currentIds = (rData.permissions || []).map(p => p.id);
        let finalIds = templateApplyMode === 'replace' ? templatePermissionIds : [...new Set([...currentIds, ...templatePermissionIds])];
        await apiPut(`/api/roles/${roleId}`, {
          name: rData.name,
          description: rData.description,
          permissionIds: finalIds
        });
      }
      setIsTemplateModalOpen(false); setSelectedRoleIds([]); fetchRoles();
      toast.success('模板分发成功');
    } catch (e) { toast.error('分发失败'); } finally { setIsProcessingBatch(false); }
  };

  const handleCloneSelectedRoles = async () => {
    if (selectedRoleIds.length === 0) return;
    setIsProcessingBatch(true);
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
    } catch (error) { toast.error('克隆失败'); } finally { setIsProcessingBatch(false); }
  };

  const filteredPermissionTreeData = useMemo(() => {
    const modules = {}; const searchLower = permissionSearchText.toLowerCase();
    permissions.forEach(p => {
      const mod = p.module || 'system'; 
      // 🛡️ 雷犀强化：即使数据库缺失描述，也确保不显示空白
      const desc = p.description || `未命名权限 (${p.code})`; 
      const code = p.code || '';
      
      if (permissionSearchText && !desc.toLowerCase().includes(searchLower) && !code.toLowerCase().includes(searchLower) && !(moduleNames[mod] || '').toLowerCase().includes(searchLower)) return;
      
      if (!modules[mod]) modules[mod] = { title: moduleNames[mod] || '系统管理', key: `module-${mod}`, children: [] };
      
      // 🚀 物理去英文：只保留中文描述
      modules[mod].children.push({ title: desc, key: p.id.toString(), isLeaf: true });
    });
    return Object.values(modules);
  }, [permissions, permissionSearchText]);

  const filteredModulesForTemplate = useMemo(() => {
    return Object.entries(moduleNames).filter(([key, name]) => {
      const modPerms = permissions.filter(p => p.module === key);
      if (modPerms.length === 0) return false;
      if (!templateSearchText) return true;
      return name.includes(templateSearchText) || key.includes(templateSearchText) || modPerms.some(p => (p.description || '').includes(templateSearchText) || (p.code || '').includes(templateSearchText));
    });
  }, [permissions, templateSearchText]);

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
      toast.success('配置同步成功'); setModalVisible(false); fetchRoles();
    } catch (e) { toast.error('保存失败'); }
  };

  const handleSaveUserAssignment = async () => {
    try {
      const values = await userForm.validateFields();
      await apiPut(`/api/roles/${selectedRole.id}/users`, { userIds: values.users });
      toast.success('成员授权成功'); setDrawerVisible(false); fetchRoles();
    } catch (e) { toast.error('授权失败'); }
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
            <span className="text-[15px] font-black text-slate-900">{r.name}</span>
            {r.is_system ? <span className="px-2 py-0.5 text-[9px] font-black bg-blue-100 text-blue-700 rounded-md uppercase border border-blue-100">系统内置</span> : null}
        </div>
    )},
    { title: '业务描述', dataIndex: 'description', key: 'description', align: 'center', render: (t) => <span className="text-[13px] font-bold text-slate-600">{t || '暂无描述'}</span> },
    { title: '部门权限范围', key: 'departments', align: 'center', render: (_, r) => {
        if (!r.departments || r.departments.length === 0) return <span className="text-[11px] font-bold text-slate-400">公开</span>;
        return (
            <div className="flex flex-wrap gap-1 justify-center">
                {r.departments.slice(0, 2).map(d => <span key={d.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px] font-black border border-indigo-100">{d.name}</span>)}
                {r.departments.length > 2 && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[11px] font-black">+{r.departments.length - 2}</span>}
            </div>
        );
    }},
    { title: '授权规模', key: 'permissions', align: 'center', render: (_, r) => <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100"><Lock size={12} /><span className="text-[13px] font-black">{(r.permissions || []).length} 项</span></div> },
    { title: '管理决策', key: 'action', align: 'center', render: (_, r) => (
        <div className="flex items-center justify-center gap-1">
            <button onClick={() => handleAssignUsers(r)} className="px-3 py-1.5 text-[11px] font-black text-blue-600 hover:bg-blue-50 rounded-lg">成员授权</button>
            <button onClick={() => handleManageDepartments(r)} className="px-3 py-1.5 text-[11px] font-black text-indigo-600 hover:bg-indigo-50 rounded-lg">范围定义</button>
            <button onClick={() => handleEdit(r)} disabled={r.name === '超级管理员'} className="px-3 py-1.5 text-[11px] font-black text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-30">修改</button>
            {!r.is_system && <button onClick={() => { setConfirmDialogConfig({ title: '物理销毁角色', message: `确定要彻底删除角色 "${r.name}" 吗？`, onConfirm: () => apiDelete(`/api/roles/${r.id}`).then(fetchRoles) }); setIsConfirmDialogOpen(true); }} className="px-3 py-1.5 text-[11px] font-black text-rose-600 hover:bg-rose-50 rounded-lg">移除</button>}
        </div>
    )}
  ];

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{i}</button>);
    return pages;
  };

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44 },
        components: { Select: { controlOutline: 'transparent', selectorBg: '#ffffff' } }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none animate-in fade-in duration-500 text-slate-900 text-left">
      {/* 1. 顶栏 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><ShieldCheck size={26} /></div>
            <div className="flex flex-col text-left">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">权限体系架构</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1">系统角色定义与资源访问管控</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} className="h-11 px-8 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black shadow-lg flex items-center gap-2"><Plus size={16} /> 创建新角色</button>
            <button onClick={() => setIsCloneModalOpen(true)} className="h-11 px-6 bg-white border-2 border-slate-200 text-slate-900 font-black rounded-lg text-xs hover:bg-slate-50 flex items-center gap-2"><Copy size={16} /> 角色克隆</button>
            <button onClick={() => setIsTemplateManageOpen(true)} className="h-11 px-6 bg-white border-2 border-slate-200 text-slate-900 font-black rounded-lg text-xs hover:bg-slate-50 flex items-center gap-2"><Settings size={16} /> 模板管控</button>
            <button onClick={fetchRoles} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><RefreshCcw size={18} /></button>
          </div>
        </div>
        <div className="bg-slate-50/40 px-10 py-6">
            <div className="flex items-center gap-4 max-w-2xl text-left">
                <div className="flex-1 relative group">
                    <input type="text" placeholder="检索角色名称或描述..." value={searchText} onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                        className="w-full h-11 pl-12 pr-4 bg-white border-2 border-slate-200 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                </div>
                <button onClick={() => { setSearchText(''); setCurrentPage(1); }} className="h-11 px-8 bg-white border-2 border-slate-200 text-slate-600 text-xs font-black rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"><X size={14} /> 重置</button>
            </div>
        </div>
      </div>

      {/* 2. 看板 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
          {[
              { label: '注册角色总量', val: roles.length, color: 'indigo', icon: Activity, desc: '底层鉴权架构核心节点' },
              { label: '系统预置策略', val: roles.filter(r => r.is_system).length, color: 'blue', icon: Cpu, desc: '系统内建受保护策略' },
              { label: '业务自定义角色', val: roles.filter(r => !r.is_system).length, color: 'emerald', icon: ShieldCheck, desc: '灵活适配组织管控需求' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-${item.color}-50 text-${item.color}-600 flex items-center justify-center group-hover:scale-110 transition-transform`}><item.icon size={24} /></div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item.label}</p>
                        <h3 className="text-3xl font-black text-slate-900 mt-1">{item.val}</h3>
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.desc}</div>
            </div>
          ))}
      </div>

      {selectedRoleIds.length > 0 && (
        <div className="mb-6 p-4 bg-slate-900 rounded-2xl flex items-center justify-between px-10 animate-in slide-in-from-top-4 shadow-2xl">
            <div className="flex items-center gap-4">
                <span className="text-xs font-black text-white bg-white/10 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                    <Grid size={14} className="text-indigo-400" />
                    已锁定 {selectedRoleIds.length} 个目标角色
                </span>
            </div>
            <div className="flex gap-3">
                <button onClick={() => setIsTemplateModalOpen(true)} className="h-10 px-6 bg-indigo-600 text-white font-black rounded-xl text-[11px] hover:bg-indigo-500 transition-all shadow-lg border border-indigo-400 flex items-center gap-2">
                    <Zap size={14} /> 批量注入模板
                </button>
                <button onClick={() => setIsCloneModalOpen(true)} className="h-10 px-6 bg-white/10 text-white font-black rounded-xl text-[11px] hover:bg-white/20 transition-all border border-white/20 flex items-center gap-2">
                    <Copy size={14} /> 级联克隆
                </button>
                <button onClick={() => setSelectedRoleIds([])} className="h-10 px-6 bg-transparent text-slate-400 font-black text-[11px] hover:text-white transition-colors">放弃选择</button>
            </div>
        </div>
      )}

      {/* 3. 列表容器 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <Table columns={columns} dataSource={getCurrentPageData()} rowKey="id" loading={loading} pagination={false}
          rowSelection={{ selectedRowKeys: selectedRoleIds, onChange: (keys) => setSelectedRoleIds(keys), columnWidth: 50 }} />
        
        {/* 4. 标准化分页器 */}
        {filteredRoles.length > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共计管理 <span className="text-indigo-600">{filteredRoles.length}</span> 个权限角色</span>
                  <div className="h-4 w-[1px] bg-slate-300 mx-2" />
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">单页展示</span>
                  <Select size="small" value={pageSize} onChange={handlePageSizeChange} variant="borderless" className="bg-white rounded-lg shadow-sm border border-slate-300 text-[12px] font-black text-slate-900 w-24" options={[10, 20, 50].map(v => ({ label: `${v} 条`, value: v }))} />
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">← 上一页</button>
                  <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">下一页 →</button>
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[11px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1 border-2 border-slate-200" controls={false} />
                      <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg"><ArrowRight size={16} /></button>
                  </div>
              </div>
          </div>
        )}
      </div>

      {/* Modals 保持样式与功能对齐 */}
      <AntdModal title={<div className="flex items-center gap-2 text-slate-900 font-black uppercase text-sm tracking-widest"><Settings size={18} className="text-indigo-600" />{editingRole ? '配置修订' : '创建新角色'}</div>}
        open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={900} styles={{ body: { padding: '24px' } }} zIndex={3000}>
        <Form form={form} layout="vertical" className="text-left font-black">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Form.Item name="name" label={<span className="text-[13px] font-black text-slate-700 uppercase tracking-widest">官方角色标识</span>} rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="输入官方名称..." className="h-11 rounded-lg border-2 border-slate-100 font-black text-[15px]" />
            </Form.Item>
            <Form.Item label={<span className="text-[13px] font-black text-indigo-600 uppercase tracking-widest">⚡ 快速应用模板 (可选)</span>}>
              <Select placeholder="选择预置或自定义模板进行快速赋权..." className="h-11 font-black" allowClear
                onChange={(val) => {
                  if (!val) return;
                  const pIds = getTemplatePermissionIds(val);
                  if (pIds.length === 0) {
                    toast.error('当前模板内无可用权限，请检查数据加载或模板配置');
                    return;
                  }
                  setCheckedKeys(pIds.map(id => id.toString()));
                  toast.success(`模板权限同步成功 (注入 ${pIds.length} 项)`);
                }}>
                <Select.OptGroup label="官方预置模板">
                  {BUILTIN_TEMPLATES.map(t => <Option key={t.key} value={t.key}>{t.name}</Option>)}
                </Select.OptGroup>
                {customTemplates.length > 0 && (
                  <Select.OptGroup label="团队自定义模板">
                    {customTemplates.map(t => <Option key={`custom:${t.id}`} value={`custom:${t.id}`}>{t.name}</Option>)}
                  </Select.OptGroup>
                )}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="description" label={<span className="text-[13px] font-black text-slate-700 uppercase tracking-widest">职能详细说明</span>}>
            <Input.TextArea placeholder="简述业务覆盖范围..." rows={2} className="rounded-lg border-2 border-slate-100 font-black text-[15px]" />
          </Form.Item>
          <Form.Item label={<span className="text-[13px] font-black text-slate-700 uppercase tracking-widest">核心授权地图</span>}>
            <div className="mb-4 relative"><Input placeholder="搜索权限点..." prefix={<Search size={16} className="text-slate-400" />} value={permissionSearchText} onChange={e => setPermissionSearchText(e.target.value)} allowClear className="h-11 rounded-lg border-2 border-slate-100 font-black" /></div>
            <div className="border-2 border-slate-100 rounded-xl p-6 bg-slate-50 shadow-inner max-h-[400px] overflow-y-auto"><Tree checkable defaultExpandAll={!permissionSearchText} onCheck={setCheckedKeys} checkedKeys={checkedKeys} treeData={filteredPermissionTreeData} virtual height={350} className="font-black text-[15px]" /></div>
          </Form.Item>
        </Form>
      </AntdModal>

      <Drawer title={<div className="flex items-center gap-2 font-black text-slate-900"><Users size={20} className="text-blue-600" /> 成员级联授权中枢</div>} width={520} onClose={() => setDrawerVisible(false)} open={drawerVisible} styles={{ body: { paddingBottom: 80 } }} zIndex={3000}>
        <div className="mb-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-100 text-left font-black"><p className="text-[10px] text-blue-400 uppercase mb-1">当前目标角色</p><h2 className="text-lg text-blue-900">{selectedRole?.name}</h2></div>
        <Form form={userForm} layout="vertical" className="text-left font-black">
          <Form.Item name="users" label={<span className="text-[13px] font-black text-slate-700 uppercase tracking-widest">选择受权成员</span>} rules={[{ required: true, message: '请选择人员' }]}>
            <Select mode="multiple" placeholder="通过姓名或账号检索..." optionLabelProp="label" showSearch className="w-full h-12" variant="borderless" style={{ border:'2px solid #f1f5f9', borderRadius:'8px', background:'#fff' }} filterOption={(i, o) => o.label.toLowerCase().indexOf(i.toLowerCase()) >= 0}>
              {users.map(user => <Option key={user.id} value={user.id} label={`${user.real_name} (${user.username})`}><div className="flex items-center gap-3 py-1 font-black"><div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-50">{user.real_name?.charAt(0)}</div><div><div className="text-sm text-slate-900">{user.real_name}</div><div className="text-[10px] text-slate-400">@{user.username}</div></div></div></Option>)}
            </Select>
          </Form.Item>
        </Form>
        <div className="absolute bottom-0 left-0 w-full p-6 bg-white border-t border-slate-100 flex gap-3 shadow-2xl"><button onClick={() => setDrawerVisible(false)} className="flex-1 h-11 bg-slate-100 text-slate-600 font-black rounded-lg hover:bg-slate-200 transition-all text-xs uppercase tracking-widest">取消</button><button onClick={handleSaveUserAssignment} className="flex-1 h-11 bg-slate-900 text-white font-black rounded-lg hover:bg-black shadow-lg transition-all text-xs uppercase tracking-widest">确认授权</button></div>
      </Drawer>

      <AntdModal title={<div className="flex items-center gap-2 text-slate-900 font-black uppercase text-sm tracking-widest"><Layout size={18} className="text-indigo-600" />权限模板管控中枢</div>} 
        open={isTemplateManageOpen} onCancel={() => setIsTemplateManageOpen(false)} footer={null} width={1000} zIndex={3000} styles={{ body: { padding: '24px' } }}>
        <div className="flex flex-col gap-6 py-4">
          <div className="flex gap-3 border-b border-slate-100 pb-6">
            <button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', description: '', permission_ids: [] }); }} className="h-11 px-6 bg-slate-900 text-white font-black rounded-lg text-xs flex items-center gap-2 shadow-lg hover:bg-black transition-all shadow-slate-200"><Plus size={16} /> 定义新模板</button>
            <button onClick={async () => { const res = await apiPost('/api/permission-templates/create-default', {}); if (res.success) { toast.success('预置模板同步成功'); fetchPermissionTemplates(); } }} className="h-11 px-6 bg-white border-2 border-slate-200 text-slate-900 font-black rounded-lg text-xs hover:bg-slate-50 flex items-center gap-2 transition-all"><Zap size={16} /> 预置对齐</button>
            <button onClick={fetchPermissionTemplates} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><RefreshCcw size={18} /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left font-black">
            <div>
              <label className="text-[10px] text-slate-400 uppercase ml-1 tracking-widest">已有定义</label>
              <div className="space-y-2 max-h-[500px] overflow-y-auto px-3 py-2 mt-4 custom-scrollbar">
                {customTemplates.map(tpl => (
                  <div key={tpl.id} onClick={() => { setEditingTemplate(tpl); setTemplateForm({ name: tpl.name, description: tpl.description || '', permission_ids: tpl.permission_ids || [] }); }}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${editingTemplate?.id === tpl.id ? 'border-indigo-500 bg-indigo-50/50 shadow-md scale-[1.01]' : 'border-slate-50 hover:border-slate-200 bg-white'}`}>
                    <div className="flex justify-between items-center"><span className="text-[15px] font-black text-slate-900">{tpl.name}</span><Tag color="indigo" className="m-0 font-black text-[10px] border-none bg-indigo-100">{(tpl.permission_ids || []).length} 项权限</Tag></div>
                    <p className="text-[12px] font-bold text-slate-500 mt-1 truncate">{tpl.description || '无职能描述'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-100/50 rounded-2xl p-6 border-2 border-white shadow-xl shadow-slate-200/50 space-y-4 text-left">
                <Input placeholder="模板名称" value={templateForm.name} onChange={e => setTemplateForm({...templateForm, name: e.target.value})} className="h-11 font-black rounded-lg border-2 border-slate-200 text-[15px]" />
                <Input placeholder="职能描述" value={templateForm.description} onChange={e => setTemplateForm({...templateForm, description: e.target.value})} className="h-11 font-black rounded-lg border-2 border-slate-200 text-[15px]" />
                <div className="pt-2"><div className="flex justify-between mb-2"><span className="text-[10px] font-black text-slate-900 uppercase">配置地图 (已选 {templateForm.permission_ids.length})</span><button onClick={() => setTemplateForm({...templateForm, permission_ids: templateForm.permission_ids.length === permissions.length ? [] : permissions.map(p => p.id)})} className="text-[10px] font-black text-indigo-600">全选反选</button></div>
                <Input placeholder="搜索权限项..." prefix={<Search size={14} className="text-slate-400" />} value={templateSearchText} onChange={e => setTemplateSearchText(e.target.value)} className="h-10 rounded-lg mb-2 border-2 border-slate-200 font-black text-[15px]" />
                <div className="max-h-[280px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {filteredModulesForTemplate.map(([key, name]) => (
                        <div key={key} className="bg-white p-3 rounded-xl border border-slate-200"><span className="text-[11px] font-black text-slate-900 uppercase">{name}</span><div className="grid grid-cols-1 gap-1 mt-2">
                            {permissions.filter(p => p.module === key && ((p.description || '').includes(templateSearchText) || (p.code || '').includes(templateSearchText))).map(p => (
                                <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer transition-all">
                                    <input type="checkbox" checked={templateForm.permission_ids.includes(p.id)} onChange={e => setTemplateForm({...templateForm, permission_ids: e.target.checked ? [...templateForm.permission_ids, p.id] : templateForm.permission_ids.filter(id => id !== p.id)})} className="w-4 h-4 rounded border-slate-300" />
                                    <span className="text-[13px] font-bold text-slate-700">{p.description || `未命名 (${p.code})`}</span>
                                </label>
                            ))}
                        </div></div>
                    ))}
                </div></div>
                <div className="flex justify-between pt-4 border-t border-slate-200">
                    {editingTemplate && <button onClick={() => { 
                        const tId = editingTemplate.id;
                        setConfirmDialogConfig({ 
                            title: '物理销毁模板', 
                            message: `确定要彻底移除模板 "${editingTemplate.name}" 吗？`, 
                            onConfirm: async () => { 
                                const res = await apiDelete(`/api/permission-templates/${tId}`); 
                                if (res.success) {
                                    setCustomTemplates(prev => prev.filter(t => t.id !== tId));
                                    setEditingTemplate(null); setTemplateForm({name:'', description:'', permission_ids:[]}); 
                                    toast.success('模板已物理销毁'); fetchPermissionTemplates(); 
                                } else { toast.error(res.message || '删除失败'); }
                            } 
                        }); 
                        setIsConfirmDialogOpen(true); 
                    }} className="px-4 py-2 text-xs font-black text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-100">删除模板</button>}
                    <div className="flex gap-2 ml-auto"><button onClick={() => { setEditingTemplate(null); setTemplateForm({name:'', description:'', permission_ids:[]}); }} className="px-6 py-2 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-lg text-xs hover:bg-slate-50">取消</button>
                    <button onClick={async () => { if (!templateForm.name.trim()) return toast.error('请输入名称'); try { const res = editingTemplate ? await apiPut(`/api/permission-templates/${editingTemplate.id}`, templateForm) : await apiPost('/api/permission-templates', templateForm); if(res.success){ fetchPermissionTemplates(); toast.success('保存成功'); } } catch(e){ toast.error('保存失败'); } }} className="px-8 py-2 bg-slate-900 text-white font-black rounded-lg text-xs shadow-lg hover:bg-black transition-all">确认入库</button></div>
                </div>
            </div>
          </div>
        </div>
      </AntdModal>

      <RoleDepartmentModal isOpen={isDepartmentModalOpen} onClose={() => { setIsDepartmentModalOpen(false); setSelectedRoleForDepartment(null); }} role={selectedRoleForDepartment} onSuccess={() => fetchRoles()} zIndex={3000} />
      <AntdModal title="角色体系快速克隆" open={isCloneModalOpen} onCancel={() => setIsCloneModalOpen(false)} onOk={handleCloneSelectedRoles} okText="立即克隆" cancelText="取消" width={480} zIndex={3000} styles={{ body: { padding: '24px' } }}><div className="space-y-4 py-4 text-left font-black"><div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-xs shadow-inner">已锁定 {selectedRoleIds.length} 个角色</div><div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] text-slate-400 uppercase ml-1">前缀</label><Input value={clonePrefix} onChange={e => setClonePrefix(e.target.value)} className="h-11 rounded-lg border-2 text-[15px]" /></div><div><label className="text-[10px] text-slate-400 uppercase ml-1">后缀</label><Input value={cloneSuffix} onChange={e => setCloneSuffix(e.target.value)} className="h-11 rounded-lg border-2 text-[15px]" /></div></div><label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer"><input type="checkbox" checked={cloneCopyDepartments} onChange={e => setCloneCopyDepartments(e.target.checked)} className="w-4 h-4 rounded" /> 物理复制部门可见范围</label></div></AntdModal>
      
      <AntdModal title={<div className="flex items-center gap-2 text-slate-900 font-black uppercase text-sm tracking-widest"><Zap size={18} className="text-indigo-600" />批量注入权限模板</div>} 
        open={isTemplateModalOpen} onCancel={() => setIsTemplateModalOpen(false)} onOk={handleApplyTemplateToSelectedRoles} okText="立即分发" cancelText="取消" width={480} zIndex={3000} styles={{ body: { padding: '24px' } }}>
        <div className="space-y-4 py-4 text-left font-black">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-800 text-[11px] shadow-inner font-black">已锁定 {selectedRoleIds.length} 个角色进行批量赋权</div>
            <div>
                <label className="text-[11px] text-slate-500 uppercase ml-1 font-black">请指定目标权限模板</label>
                <Select placeholder="选择模板..." value={selectedTemplateKey} onChange={setSelectedTemplateKey} className="w-full h-11 mt-1 font-black" allowClear>
                    <Select.OptGroup label="官方预置模板库">
                        {BUILTIN_TEMPLATES.map(t => <Option key={t.key} value={t.key}>{t.name}</Option>)}
                    </Select.OptGroup>
                    {customTemplates.length > 0 && (
                        <Select.OptGroup label="团队私有模板库">
                            {customTemplates.map(t => <Option key={`custom:${t.id}`} value={`custom:${t.id}`}>{t.name}</Option>)}
                        </Select.OptGroup>
                    )}
                </Select>
            </div>
            <div>
                <label className="text-[11px] text-slate-500 uppercase ml-1 font-black">应用逻辑模式</label>
                <Select value={templateApplyMode} onChange={setTemplateApplyMode} className="w-full h-11 mt-1 font-black">
                    <Option value="merge">增量合并 (保留现状，仅注入模板权限)</Option>
                    <Option value="replace">全量覆盖 (抹除现状，完全同步模板)</Option>
                </Select>
            </div>
        </div>
      </AntdModal>

      <ConfirmDialog isOpen={isConfirmDialogOpen} onClose={() => setIsConfirmDialogOpen(false)} onConfirm={confirmDialogConfig.onConfirm} title={confirmDialogConfig.title} message={confirmDialogConfig.message} zIndex={5000} />
    </div>
    </ConfigProvider>
  );
};

export default RoleManagement;
