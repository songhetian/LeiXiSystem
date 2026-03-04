import React from 'react';
import { Card, Button, Table, Tag, Space, Modal, Form, Select, ConfigProvider, Avatar, Tooltip } from 'antd';
import { ShieldCheck, UserCog, X, Save, Plus, Trash2, Key, HelpCircle, Eye, ShieldAlert, Lock, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

const { Option } = Select;

const VacationPermissions = () => {
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [editingRecord, setEditingRecord] = React.useState(null);

  const columns = [
    {
      title: '系统角色名称',
      dataIndex: 'role',
      key: 'role',
      width: 180,
      align: 'center',
      render: (t) => (
        <div className="flex items-center justify-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm"><Key size={14}/></div>
            <span className="text-[13px] font-black text-slate-800">{t}</span>
        </div>
      )
    },
    {
      title: '管理授权等级',
      dataIndex: 'permissionType',
      key: 'permissionType',
      width: 140,
      align: 'center',
      render: (text) => (
        <div className="flex flex-col items-center">
            {text === '编辑' ? (
                <Tag color="green" className="m-0 border-none font-black text-[9px] uppercase rounded-full px-3 flex items-center gap-1 shadow-sm shadow-emerald-100">
                    <ShieldCheck size={10} /> 全量管理
                </Tag>
            ) : (
                <Tag color="blue" className="m-0 border-none font-black text-[9px] uppercase rounded-full px-3 flex items-center gap-1 shadow-sm shadow-blue-100">
                    <Eye size={10} /> 仅限查看
                </Tag>
            )}
        </div>
      ),
    },
    {
      title: '实际操作权限说明',
      key: 'desc',
      align: 'center',
      render: (_, r) => (
        <div className="flex flex-col items-center gap-0.5">
            <div className="text-[11px] font-bold text-slate-600">
                {r.permissionType === '编辑' ? '可对全员假期余额进行物理调整、转换及同步' : '仅支持查阅员工假期明细，禁止修改物理数据'}
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">
                {r.role === '系统管理员' ? 'SCOPE: GLOBAL SYSTEM' : (r.role === '部门经理' ? 'SCOPE: DEPARTMENT ONLY' : 'SCOPE: LIMITED ACCESS')}
            </div>
        </div>
      )
    },
    {
      title: '配置管理',
      key: 'action',
      width: 180,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center gap-2">
          <button onClick={() => handleEdit(record)} 
            className="h-8 px-4 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-md active:scale-95 whitespace-nowrap">
            变更授权
          </button>
          <button onClick={() => handleDelete(record)} 
            className="h-8 px-4 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all border border-rose-100 whitespace-nowrap">
            移除授权
          </button>
        </div>
      ),
    },
  ];

  const data = [
    { key: '1', role: '系统管理员', permissionType: '编辑' },
    { key: '2', role: '人事专员', permissionType: '编辑' },
    { key: '3', role: '部门经理', permissionType: '查看' },
    { key: '4', role: '普通员工', permissionType: '查看' },
  ];

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      role: record.role,
      permissionType: record.permissionType
    });
    setIsModalVisible(true);
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      toast.success(`${values.role} 的假务授权配置已更新生效`);
      setIsModalVisible(false);
    } catch (e) {}
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: <span className="font-black text-slate-900">撤销管理授权</span>,
      icon: <ShieldAlert className="text-rose-500 mr-2 inline" size={20}/>,
      content: <p className="text-xs font-bold text-slate-500 py-4">确定要物理剥离角色 "{record.role}" 的假务管理权限吗？剥离后其将无法进入审计中心。</p>,
      okText: '确认移除',
      cancelText: '取消',
      centered: true,
      onOk() { toast.info('授权已物理移除'); },
    });
  };

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 38, colorBorder: '#cbd5e1' },
        components: { Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900, fontSize: 12 } }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 font-black text-left">
      
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 p-4 opacity-5 pointer-events-none"><ShieldCheck size={100} /></div>
        <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
                <UserCheck size={24}/>
            </div>
            <div>
                <h2 className="text-lg font-black text-slate-900 leading-tight">假期管理权限配置</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">授予定向角色对全员假期的查看与物理修改权限</p>
            </div>
        </div>
        <button onClick={handleAdd}
            className="h-10 px-6 bg-slate-900 text-white rounded-xl text-[11px] font-black shadow-lg shadow-slate-200 hover:bg-black transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap">
            <Plus size={16}/> 授予管理权限
        </button>
      </div>

      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={data} pagination={false} className="flagship-table" size="small" />
      </Card>

      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-start gap-3">
          <HelpCircle size={16} className="text-slate-400 mt-0.5" />
          <div>
              <p className="text-[11px] font-black text-slate-500 leading-relaxed m-0">
                  授权说明：此矩阵决定了系统各角色在“假期审计管理”模块下的数据能见度与操作深度。系统管理员与人事专员默认拥有最高物理修改权限。
              </p>
          </div>
      </div>

      {/* 权限编辑弹窗：轻量化性能优化 */}
      <Modal open={isModalVisible} onCancel={handleModalCancel} footer={null} width={420} centered closable={false}
        styles={{ 
            body: { padding: 0, overflowX: 'hidden', background: '#fff', borderRadius: '12px' },
            mask: { backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.2)' }
        }}
      >
        <div className="flex flex-col font-black text-left">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center text-slate-900">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg"><Lock size={20}/></div>
                    <div>
                        <h2 className="text-base font-black">{editingRecord ? "修改授权配置" : "新授权分配审计"}</h2>
                        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest">Permission Granularity Setup</p>
                    </div>
                </div>
                <button onClick={handleModalCancel} className="w-8 h-8 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center"><X size={18}/></button>
            </div>

            <div className="p-8 space-y-6">
                <Form form={form} layout="vertical">
                    <Form.Item name="role" label={<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">拟授予授权的系统角色</span>} required>
                        <Select placeholder="请选择系统角色" className="w-full font-black rounded-xl h-11">
                            <Option value="系统管理员">系统管理员 (全域权限)</Option>
                            <Option value="人事专员">人事专员 (假务专精)</Option>
                            <Option value="部门经理">部门经理 (本部门审计)</Option>
                            <Option value="普通员工">普通员工 (个人视图)</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="permissionType" label={<span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">授予授权深度</span>} required>
                        <Select placeholder="请选择授权级别" className="w-full font-black rounded-xl h-11">
                            <Option value="查看">只读模式 (仅限数据查阅)</Option>
                            <Option value="编辑">管理模式 (可修改物理额度)</Option>
                        </Select>
                    </Form.Item>
                </Form>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-start gap-3">
                    <ShieldAlert size={16} className="text-amber-600 mt-0.5" />
                    <p className="text-[10px] font-bold text-amber-700 leading-relaxed m-0">
                        安全提示：管理模式下的角色可以绕过请假流程直接调整全员余额，请谨慎授予。
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                    <button onClick={handleModalCancel} className="flex-1 h-11 rounded-xl font-black text-xs border border-slate-200 text-slate-500 uppercase">放弃</button>
                    <button onClick={handleModalOk} className="flex-1 h-11 rounded-xl font-black text-xs bg-slate-900 text-white shadow-lg shadow-slate-200 transition-all active:scale-95 uppercase">物理生效配置</button>
                </div>
            </div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  );
};

export default VacationPermissions;
