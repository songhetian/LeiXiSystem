import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, Button, Space, Modal, Input, Tag, 
  message, Tooltip, Popconfirm, Avatar, Badge,
  Checkbox, List as AntList, ConfigProvider, InputNumber, Select
} from 'antd';
import { 
  Search, 
  Plus, 
  RefreshCcw, 
  Users, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight,
  ArrowLeft,
  Edit3,
  Trash2,
  Info,
  Layout,
  MessageSquare
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../utils/apiClient';

const GroupManagement = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [memberSearchText, setMemberSearchText] = useState('');
  const [newGroupData, setNewGroupData] = useState({ name: '', memberIds: [] });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newName, setNewName] = useState('');

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState(null);

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/chat/admin/groups');
      if (res.success) setGroups(res.data);
    } catch (err) {
      message.error('获取群组列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiGet('/api/chat/users');
      if (res.success) setAllUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const filteredGroups = useMemo(() => {
    return groups.filter(g => 
      g.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      (g.department_name && g.department_name.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [groups, searchText]);

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const totalPages = Math.ceil(filteredGroups.length / pageSize);
  const currentTableData = filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleCreateGroup = async () => {
    if (!newGroupData.name || newGroupData.memberIds.length === 0) {
      return message.warning('请填写群名称并选择成员');
    }
    try {
      const res = await apiPost('/api/chat/groups', newGroupData);
      if (res.success) {
        message.success('群组创建成功');
        setIsCreateModalOpen(false);
        setNewGroupData({ name: '', memberIds: [] });
        fetchGroups();
      }
    } catch (err) { message.error('创建失败'); }
  };

  const handleUpdate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await apiPut(`/api/chat/groups/${editingGroup.id}`, { name: newName });
      if (res.success) {
        message.success('群组信息已更新');
        setIsEditModalOpen(false);
        fetchGroups();
      }
    } catch (err) { message.error('更新失败'); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await apiDelete(`/api/chat/groups/${id}`);
      if (res.success) {
        message.success('群组已解散');
        fetchGroups();
      }
    } catch (err) { message.error('操作失败'); }
  };

  const columns = [
    {
      title: '群组档案',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div className="flex items-center gap-4 px-2">
          <Avatar 
            shape="square" 
            src={record.avatar} 
            className="w-11 h-11 rounded-lg border-[1px] border-slate-200 shadow-sm"
          >
            {text?.charAt(0)}
          </Avatar>
          <div className="flex flex-col text-left">
            <span className="text-[15px] font-black text-slate-900 leading-tight">{text}</span>
            <div className="flex items-center gap-2 mt-1">
                {record.department_id ? (
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border-[1px] border-indigo-100 font-black uppercase">官方部门群</span>
                ) : (
                    <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border-[1px] border-slate-200 font-black uppercase">自定义讨论组</span>
                )}
            </div>
          </div>
        </div>
      )
    },
    {
      title: '所属业务域',
      dataIndex: 'department_name',
      key: 'department_name',
      align: 'center',
      render: (text) => <span className="text-[13px] font-black text-slate-700">{text || '开放域'}</span>
    },
    {
      title: '现有人数',
      dataIndex: 'member_count',
      key: 'member_count',
      align: 'center',
      render: (count) => (
        <div className="flex justify-center">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[13px] font-black border-[1px] border-emerald-200">
                {count} 名成员
            </span>
        </div>
      )
    },
    {
      title: '负责人',
      dataIndex: 'owner_name',
      key: 'owner_name',
      align: 'center',
      render: (text) => <span className="text-[13px] font-black text-slate-900">{text || '系统自动'}</span>
    },
    {
      title: '审计时间',
      dataIndex: 'created_at',
      key: 'created_at',
      align: 'center',
      render: (date) => <span className="text-[12px] font-bold text-slate-500">{new Date(date).toLocaleString()}</span>
    },
    {
      title: '审计操作',
      key: 'action',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <div className="flex items-center justify-center gap-2">
          <Tooltip title="重命名">
            <button 
                onClick={() => { setEditingGroup(record); setNewName(record.name); setIsEditModalOpen(true); }} 
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 border-[1px] border-transparent hover:border-slate-200"
            >
                <Edit3 size={16} />
            </button>
          </Tooltip>
          
          {!record.department_id && (
            <Popconfirm
              title="物理拆解群组"
              description="确定要永久解散该群组吗？所有聊天记录将从固件中物理抹除。"
              onConfirm={() => handleDelete(record.id)}
              okText="确认解散"
              cancelText="取消"
            >
              <button className="p-2 hover:bg-rose-50 rounded-lg transition-colors text-slate-400 hover:text-rose-600 border-[1px] border-transparent hover:border-rose-200">
                <Trash2 size={16} />
              </button>
            </Popconfirm>
          )}
        </div>
      )
    }
  ];

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>{i}</button>)
    return pages
  }

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
        components: { 
            Select: { controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b', colorBorderHover: '#4f46e5', paddingSM: 12 }, 
            Input: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' } 
        }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none font-black text-left text-slate-900 w-full">
      <div className="w-full space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="px-10 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><MessageSquare size={26} /></div>
                    <div className="flex flex-col text-left">
                        <h1 className="text-xl font-black text-slate-900 tracking-tight">通讯群组审计</h1>
                        <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">系统业务群组与自定义讨论组集中化管理</p>
                    </div>
                </div>
                <button onClick={fetchGroups} className="h-11 px-8 bg-indigo-50 text-indigo-600 font-black rounded-lg text-xs hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-200"><RefreshCcw size={16} /> 刷新同步</button>
            </div>

            {/* 旗舰单行全铺满搜索条 */}
            <div className="bg-slate-50/40 px-10 py-8">
                <div className="flex flex-wrap items-center gap-4 w-full">
                    <div className="flex-1 min-w-[300px]">
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">群组检索</label>
                        <Input 
                            placeholder="搜索群组名称、业务域关键字..." 
                            value={searchText} 
                            onChange={e => setSearchText(e.target.value)}
                            className="w-full h-11 px-3 font-black text-slate-900 rounded-lg shadow-sm border-[1px] border-slate-500" 
                            prefix={<Search size={16} className="text-slate-400" />} 
                        />
                    </div>
                    <div className="flex gap-2 mt-[19px] flex-none">
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="h-11 px-10 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black transition-all shadow-lg flex items-center gap-2 border-[1px] border-slate-800"
                        >
                            <Plus size={16} />
                            <span>创建群组</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <Table 
                columns={columns} 
                dataSource={currentTableData} 
                rowKey="id" 
                loading={loading}
                pagination={false}
                className="font-black flagship-table"
                rowClassName="hover:bg-slate-50/50 transition-colors"
            />

            {/* 标准化分页器物理植入 - 仅在数据超过 10 条时显示 */}
            {filteredGroups.length > 10 && (
                <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-500 rounded-b-2xl">
                    <div className="flex items-center gap-4 text-left font-black">
                        <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共审计 <span className="text-indigo-600">{filteredGroups.length}</span> 个通讯群组</span>
                        <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                        <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-28 font-black flagship-select" options={[10, 20, 50].map(v => ({ label: `${v} 条/页`, value: v }))} />
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">← 上一页</button>
                        <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">下一页 →</button>
                        <div className="flex items-center gap-2 ml-4">
                            <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                            <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-16 h-10 rounded-lg font-black text-center border-[1px] border-slate-500 flagship-input-number" controls={false} />
                            <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg shadow-slate-200"><ArrowRight size={16} /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* 创建群组 Modal - 同步旗舰风格 */}
      <Modal
        title="初始化通讯群组"
        open={isCreateModalOpen}
        onOk={handleCreateGroup}
        onCancel={() => setIsCreateModalOpen(false)}
        width={500}
        okText="确认创建"
        cancelText="取消"
        className="font-black"
      >
        <div className="space-y-6 py-6 text-left">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">群组命名 *</label>
            <Input 
              placeholder="请输入群组唯一标识名称" 
              value={newGroupData.name}
              onChange={e => setNewGroupData({...newGroupData, name: e.target.value})}
              className="h-11 font-black border-[1px] border-slate-500"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest">物理分配成员 ({newGroupData.memberIds.length})</label>
              <button onClick={() => {
                if (newGroupData.memberIds.length === allUsers.filter(u => u.name.toLowerCase().includes(memberSearchText.toLowerCase())).length) {
                  setNewGroupData({...newGroupData, memberIds: []});
                } else {
                  setNewGroupData({...newGroupData, memberIds: allUsers.filter(u => u.name.toLowerCase().includes(memberSearchText.toLowerCase())).map(u => u.id)});
                }
              }} className="text-[10px] font-black text-indigo-600 hover:underline uppercase">一键选择结果</button>
            </div>
            <Input 
              placeholder="快速检索姓名..." 
              value={memberSearchText}
              onChange={e => setMemberSearchText(e.target.value)}
              className="h-10 font-black mb-3 border-[1px] border-slate-300"
              prefix={<Search size={14} className="text-slate-400" />}
            />
            <div className="border-[1px] border-slate-500 rounded-xl max-h-64 overflow-y-auto p-3 bg-slate-50/30">
              <AntList
                dataSource={allUsers.filter(u => u.name.toLowerCase().includes(memberSearchText.toLowerCase()))}
                renderItem={u => (
                  <div 
                    key={u.id}
                    className="flex items-center p-3 hover:bg-white hover:shadow-sm cursor-pointer rounded-lg transition-all mb-1 group"
                    onClick={() => {
                      const ids = newGroupData.memberIds.includes(u.id)
                        ? newGroupData.memberIds.filter(id => id !== u.id)
                        : [...newGroupData.memberIds, u.id];
                      setNewGroupData({...newGroupData, memberIds: ids});
                    }}
                  >
                    <Checkbox checked={newGroupData.memberIds.includes(u.id)} className="mr-4" />
                    <Avatar size="small" src={u.avatar} className="mr-3 border-[1px] border-slate-200" />
                    <span className="text-[13px] font-black text-slate-700 group-hover:text-indigo-600">{u.name}</span>
                  </div>
                )}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* 修改群组 Modal */}
      <Modal
        title="调整群组属性"
        open={isEditModalOpen}
        onOk={handleUpdate}
        onCancel={() => setIsEditModalOpen(false)}
        className="font-black"
      >
        <div className="py-6 text-left">
          <label className="block text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">更新群组命名</label>
          <Input 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            placeholder="请输入新群名" 
            className="h-11 font-black border-[1px] border-slate-500"
          />
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  );
};

export default GroupManagement;
