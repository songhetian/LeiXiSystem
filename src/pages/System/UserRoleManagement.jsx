import React, { useState, useEffect, useMemo } from 'react';
import { 
    Table, 
    Button, 
    Card, 
    Tag, 
    Space, 
    Modal, 
    message, 
    Input, 
    Checkbox, 
    Select, 
    Form, 
    Typography, 
    Badge, 
    Tooltip,
    ConfigProvider,
    InputNumber
} from 'antd';
import { 
    ShieldCheck, 
    Users, 
    Search, 
    X, 
    UserCheck, 
    ShieldAlert, 
    Lock, 
    RefreshCcw,
    ArrowRight,
    ArrowLeft,
    CheckCircle2,
    Eye,
    Shield,
    Smartphone,
    Mail
} from 'lucide-react';
import { getApiUrl } from '../../utils/apiConfig';
import { apiGet, apiPut, apiPost } from '../../utils/apiClient';
import UserDepartmentModal from '../../components/UserDepartmentModal';

const { Option } = Select;

const UserRoleManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);

  // 状态
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [selectedUserForDepartment, setSelectedUserForDepartment] = useState(null);
  const [displaySearchText, setDisplaySearchText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchDepartment, setSearchDepartment] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [isBatchAssignOpen, setIsBatchAssignOpen] = useState(false);
  const [isBatchRemoveOpen, setIsBatchRemoveOpen] = useState(false);
  const [batchAssignRoleId, setBatchAssignRoleId] = useState(null);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => { setSearchText(displaySearchText); setCurrentPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [displaySearchText]);

  useEffect(() => {
    fetchUsers(); fetchRoles(); fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiGet('/api/users-with-roles');
      if (response.success) setUsers(response.data || []);
    } catch (e) { message.error('获取用户列表失败'); } finally { setLoading(false); }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiGet('/api/roles');
      const rolesData = response.success ? (response.data || []) : (Array.isArray(response) ? response : []);
      setRoles(rolesData);
    } catch (e) {}
  };

  const fetchDepartments = async () => {
    try {
      const response = await apiGet('/api/departments');
      setDepartments(response.success ? (response.data || []) : (Array.isArray(response) ? response : []));
    } catch (e) {}
  };

  const handleManageRoles = (user) => {
    setSelectedUser(user);
    const userRoleId = user.roles && user.roles.length > 0 ? user.roles[0].id : null;
    setSelectedRoles(userRoleId ? [userRoleId] : []);
    setModalVisible(true);
  };

  const handleSaveRoles = async () => {
    try {
      await apiPut('/api/users/roles/batch', { userIds: [selectedUser.id], roleIds: selectedRoles });
      message.success('角色授权已更新'); setModalVisible(false); fetchUsers(); 
    } catch (e) { message.error('分配失败'); }
  };

  const handleBatchAssignRoles = async () => {
    if (!batchAssignRoleId) return message.error('请选择目标角色');
    setIsProcessingBatch(true);
    try {
      await apiPut('/api/users/roles/batch', { userIds: selectedUserIds, roleIds: [batchAssignRoleId] });
      message.success('批量授权成功'); setIsBatchAssignOpen(false); setBatchAssignRoleId(null); setSelectedUserIds([]); fetchUsers();
    } finally { setIsProcessingBatch(false); }
  };

  const handleBatchRemoveRoles = async () => {
    setIsProcessingBatch(true);
    try {
      await apiPut('/api/users/roles/batch', { userIds: selectedUserIds, roleIds: [] });
      message.success('已清空选中成员角色'); setIsBatchRemoveOpen(false); setSelectedUserIds([]); fetchUsers();
    } finally { setIsProcessingBatch(false); }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!u.real_name?.toLowerCase().includes(s) && !u.username?.toLowerCase().includes(s) && !u.phone?.includes(s)) return false;
      }
      if (searchDepartment && u.department_id !== parseInt(searchDepartment)) return false;
      return true;
    });
  }, [users, searchText, searchDepartment]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const getCurrentPageData = () => filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); };
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); };

  const columns = [
    { title: '授权成员信息', key: 'user', align: 'center', width: 220, render: (_, r) => (
        <div className="flex items-center justify-center gap-4 text-left">
            <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-slate-100 border-2 border-white shadow-sm overflow-hidden">
                    {r.avatar ? <img src={r.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 font-black">{r.real_name?.charAt(0)}</div>}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${r.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <div className="flex flex-col">
                <span className="text-[14px] font-black text-slate-900 leading-tight">{r.real_name}</span>
                <span className="text-[10px] font-bold text-slate-500 mt-0.5 tracking-tighter">@{r.username}</span>
            </div>
        </div>
    )},
    { title: '组织架构', dataIndex: 'department_name', key: 'dept', align: 'center', render: (t) => <span className="text-xs font-black text-slate-700 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">{t || '未分配部门'}</span> },
    { title: '当前权限角色', key: 'roles', align: 'center', render: (_, r) => (
        <div className="flex flex-wrap gap-1.5 justify-center">
            {r.roles?.length > 0 ? r.roles.map(role => (
                <Tag key={role.id} variant="borderless" className={`m-0 font-black text-[10px] px-2 py-0.5 rounded-md border ${role.name === '超级管理员' ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                    {role.name.toUpperCase()}
                </Tag>
            )) : <button onClick={() => handleManageRoles(r)} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-all italic">+ 点击分配角色</button>}
        </div>
    )},
    { title: '数据可见性', key: 'scope', align: 'center', render: (_, r) => (
        <div className="flex flex-wrap gap-1 justify-center">
            {r.departments?.length > 0 ? r.departments.slice(0, 2).map(d => <span key={d.id} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-black border border-purple-100">{d.name}</span>) : <span className="text-[10px] font-bold text-slate-400 italic">仅本人可见</span>}
            {r.departments?.length > 2 && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-black">+{r.departments.length - 2}</span>}
        </div>
    )},
    { title: '决策操作', key: 'action', align: 'center', width: 180, render: (_, r) => (
        <div className="flex items-center justify-center gap-1">
            <button onClick={() => handleManageRoles(r)} className="px-3 py-1.5 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">修改角色</button>
            <button onClick={() => { setSelectedUserForDepartment(r); setIsDepartmentModalOpen(true); }} className="px-3 py-1.5 text-[10px] font-black text-purple-600 hover:bg-purple-50 rounded-lg transition-all">部门权限</button>
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
      {/* 1. 顶栏 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-10 py-6 border-b border-slate-50">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-100"><UserCheck size={26} /></div>
            <div className="flex flex-col">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">成员授权管理</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1">企业人才权限分配与组织架构对齐</p>
            </div>
          </div>
          <button onClick={fetchUsers} className="h-11 w-11 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><RefreshCcw size={18} /></button>
        </div>

        {/* 2. 横向紧凑搜索条 */}
        <div className="bg-slate-50/40 px-10 py-6">
            <div className="flex items-center gap-4 max-w-4xl">
                <div className="flex-1 relative group">
                    <input type="text" placeholder="检索姓名、用户名或工号..." value={displaySearchText} onChange={e => setDisplaySearchText(e.target.value)}
                        className="w-full h-11 pl-12 pr-4 bg-white border-2 border-slate-200 rounded-lg text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={18} />
                </div>
                <div className="w-[200px]">
                    <Select showSearch allowClear placeholder="🏢 筛选部门" className="w-full h-11 font-black" variant="borderless" style={{ border:'2px solid #e2e8f0', borderRadius:'8px', background:'#fff' }}
                        value={searchDepartment || undefined} onChange={setSearchDepartment} options={departments.map(d => ({ label: d.name, value: String(d.id) }))} />
                </div>
                <button onClick={() => { setDisplaySearchText(''); setSearchDepartment(''); setCurrentPage(1); }} className="h-11 px-8 bg-indigo-50 text-indigo-600 text-xs font-black rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-2"><X size={14} /> 重置</button>
            </div>
        </div>
      </div>

      {/* 3. 看板 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
              { label: '注册成员总量', val: filteredUsers.length, color: 'blue', icon: Users, desc: '当前人才库活跃节点' },
              { label: '待处理批量项', val: selectedUserIds.length, color: 'indigo', icon: CheckCircle2, desc: '已锁定成员可执行批量操作' },
              { label: '注册角色种类', val: roles.length, color: 'emerald', icon: ShieldCheck, desc: '系统内建安全访问策略' }
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

      {/* 4. 批量操作条 */}
      {selectedUserIds.length > 0 && (
        <div className="mb-4 p-4 bg-slate-900 rounded-xl flex items-center justify-between px-10 animate-in slide-in-from-top-4">
            <span className="text-xs font-black text-white bg-white/10 px-4 py-1.5 rounded-full border border-white/10">已选中 {selectedUserIds.length} 名成员</span>
            <div className="flex gap-2">
                <button onClick={() => setIsBatchAssignOpen(true)} className="h-9 px-6 bg-indigo-600 text-white font-black rounded-lg text-[11px] hover:bg-indigo-500 transition-all">批量分配角色</button>
                <button onClick={() => setIsBatchRemoveOpen(true)} className="h-9 px-6 bg-rose-600 text-white font-black rounded-lg text-[11px] hover:bg-rose-500 transition-all">批量移除权限</button>
                <button onClick={() => setSelectedUserIds([])} className="h-9 px-6 bg-transparent text-slate-400 font-black text-[11px] hover:text-white">取消</button>
            </div>
        </div>
      )}

      {/* 5. 主表：全居中 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <Table columns={columns} dataSource={getCurrentPageData()} rowKey="id" loading={loading} pagination={false}
          rowSelection={{ selectedRowKeys: selectedUserIds, onChange: setSelectedUserIds, preserveSelectedRowKeys: true, columnWidth: 50 }} />
        
        {filteredUsers.length > 10 && (
          <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
              <div className="flex items-center gap-4 text-left">
                  <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest">共计发现 <span className="text-blue-600">{filteredUsers.length}</span> 名已注册成员</span>
                  <div className="h-4 w-[1px] bg-slate-300 mx-2" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">单页数量</span>
                  <Select size="small" value={pageSize} onChange={setPageSize} variant="borderless" className="bg-white rounded-lg shadow-sm border border-slate-300 text-[11px] font-black text-slate-900 w-24" options={[10, 20, 50].map(v => ({ label: `${v} 条`, value: v }))} />
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-blue-600 hover:border-blue-400 disabled:opacity-40 font-black text-xs">← 上一页</button>
                  <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                  <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-white border-2 border-slate-200 text-slate-900 hover:text-blue-600 hover:border-blue-400 disabled:opacity-40 font-black text-xs">下一页 →</button>
                  <div className="flex items-center gap-2 ml-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                      <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1" controls={false} />
                      <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg"><ArrowRight size={16} /></button>
                  </div>
              </div>
          </div>
        )}
      </div>

      {/* Modals 保持新标准圆角 */}
      <Modal title={`角色授权 - ${selectedUser?.real_name}`} open={modalVisible} onCancel={() => setModalVisible(false)} footer={null} width={480} centered>
        <div className="py-6 text-left space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">请选择目标职能角色</label>
            <Select placeholder="选择系统定义的权限角色" value={selectedRoles[0] || null} onChange={v => setSelectedRoles(v ? [v] : [])} className="w-full h-12 font-black" size="large" allowClear>
                {roles.map(r => <Option key={r.id} value={r.id}><div className="flex items-center justify-between"><span>{r.name}</span>{r.is_system && <span className="text-[9px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100">核心预置</span>}</div></Option>)}
            </Select>
            <div className="pt-4 flex gap-2">
                <button onClick={() => setModalVisible(false)} className="flex-1 h-11 border-2 border-slate-100 text-slate-600 font-black rounded-lg hover:bg-slate-50 transition-all uppercase text-xs">取消</button>
                <button onClick={handleSaveRoles} className="flex-1 h-11 bg-slate-900 text-white font-black rounded-lg hover:bg-black transition-all shadow-lg shadow-slate-200 uppercase text-xs">保存授权</button>
            </div>
        </div>
      </Modal>

      <Modal title="批量分配核心角色" open={isBatchAssignOpen} onCancel={() => setIsBatchAssignOpen(false)} footer={null} width={480} centered>
        <div className="py-6 text-left space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-xs font-black">已锁定 {selectedUserIds.length} 名成员进行批量处理</div>
            <Select placeholder="选择要授予的共同角色" value={batchAssignRoleId} onChange={setBatchAssignRoleId} className="w-full h-12 font-black" size="large">
                {roles.map(r => <Option key={r.id} value={r.id}>{r.name}</Option>)}
            </Select>
            <div className="pt-4 flex gap-2">
                <button onClick={() => setIsBatchAssignOpen(false)} className="flex-1 h-11 border-2 border-slate-100 text-slate-600 font-black rounded-lg hover:bg-slate-50">取消</button>
                <button onClick={handleBatchAssignRoles} disabled={isProcessingBatch} className="flex-1 h-11 bg-indigo-600 text-white font-black rounded-lg hover:bg-indigo-700 shadow-lg transition-all">执行分配</button>
            </div>
        </div>
      </Modal>

      <Modal title="批量销毁角色关联" open={isBatchRemoveOpen} onCancel={() => setIsBatchRemoveOpen(false)} footer={null} width={480} centered>
        <div className="py-6 text-left space-y-4">
            <p className="text-sm font-black text-slate-900 ml-1">确定要移除选中的 {selectedUserIds.length} 名成员的所有角色吗？</p>
            <div className="p-4 bg-rose-50 text-rose-700 text-xs font-black rounded-xl border border-rose-100">该操作将导致目标成员立即使所有受保护资源的访问权限，且无法撤销。</div>
            <div className="pt-4 flex gap-2">
                <button onClick={() => setIsBatchRemoveOpen(false)} className="flex-1 h-11 border-2 border-slate-100 text-slate-600 font-black rounded-lg hover:bg-slate-50">保留现状</button>
                <button onClick={handleBatchRemoveRoles} disabled={isProcessingBatch} className="flex-1 h-11 bg-rose-600 text-white font-black rounded-lg hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all">确认销毁</button>
            </div>
        </div>
      </Modal>

      <UserDepartmentModal isOpen={isDepartmentModalOpen} onClose={() => setIsDepartmentModalOpen(false)} onSuccess={handleUserDepartmentSuccess} user={selectedUserForDepartment} />
    </div>
    </ConfigProvider>
  );
};

export default UserRoleManagement;
