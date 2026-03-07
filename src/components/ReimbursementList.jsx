import logger from '@/utils/logger';
/**
 * 报销记录列表组件 (雷犀旗舰办公版)
 *
 * 功能：
 * - 列表展示个人报销记录
 * - 物理缝合状态筛选与实时刷新
 * - 查看详情与草稿管理闭环
 */

import React, { useState, useEffect } from 'react';
import {
  EyeOutlined,
  DeleteOutlined,
  SendOutlined,
  ReloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { 
    Search, 
    Filter, 
    RefreshCcw, 
    CreditCard, 
    Calendar, 
    ChevronLeft, 
    ChevronRight,
    X,
    FileSpreadsheet,
    Clock,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Modal, Select, ConfigProvider, Tag, Badge, Empty, Spin, Tooltip } from 'antd';
import api from '../api';

// 状态选项
const STATUS_OPTIONS = [
  { value: 'all', label: '全部申请状态' },
  { value: 'draft', label: '未提交草稿' },
  { value: 'pending', label: '等待审批中' },
  { value: 'approving', label: '多级审批中' },
  { value: 'approved', label: '审批已通过' },
  { value: 'rejected', label: '申请被驳回' },
  { value: 'cancelled', label: '用户已撤销' }
];

// 类型映射
const TYPE_LABELS = {
  travel: '差旅报销',
  office: '办公费用',
  entertainment: '商务招待',
  training: '学习培训',
  other: '其它杂项'
};

// 状态样式映射
const STATUS_MAP = {
  draft: { label: '草稿', color: 'default', icon: <Clock size={10}/> },
  pending: { label: '待审', color: 'orange', icon: <Clock size={10}/> },
  approving: { label: '审批中', color: 'blue', icon: <RefreshCcw size={10}/> },
  approved: { label: '通过', color: 'green', icon: <CheckCircle2 size={10}/> },
  rejected: { label: '驳回', color: 'red', icon: <XCircle size={10}/> },
  cancelled: { label: '撤销', color: 'default', icon: <X size={10}/> }
};

const ReimbursementList = ({ user, onViewDetail, onEdit }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  });

  // 加载数据
  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const params = {
        user_id: user.id,
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: pagination.page,
        limit: pagination.limit
      };
      const response = await api.get('/reimbursement/list', { params });
      if (response.data.success) {
        setRecords(response.data.data || []);
        setPagination(prev => ({
          ...prev,
          total: response.data.pagination?.total || 0
        }));
      }
    } catch (error) {
      logger.error('获取报销记录失败:', error);
      toast.error('财务数据链路同步失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id, statusFilter, pagination.page]);

  // 提交草稿
  const handleSubmit = async (id) => {
    try {
      const response = await api.post(`/reimbursement/${id}/submit`);
      if (response.data.success) {
        toast.success('报销单已正式提交审批流');
        fetchData();
      }
    } catch (error) { toast.error('提交失败'); }
  };

  // 撤销申请
  const handleCancel = async (id) => {
    Modal.confirm({
      title: <span className="font-black">撤销申请确认</span>,
      content: <p className="text-xs font-bold text-slate-500 py-4">确定要撤销此报销申请吗？撤销后该单据将物理回退至草稿箱。</p>,
      okText: '物理撤销',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const response = await api.post(`/reimbursement/${id}/cancel`);
          if (response.data.success) {
            toast.success('单据已撤销至草稿箱');
            fetchData();
          }
        } catch (error) { toast.error('撤销失败'); }
      }
    });
  };

  // 删除草稿
  const handleDelete = async (id) => {
    Modal.confirm({
      title: <span className="font-black text-slate-900">物理删除确认</span>,
      content: <p className="text-xs font-bold text-slate-500 py-4">确定要彻底删除此报销草稿吗？删除后相关附件也将同步从云端抹除，无法恢复。</p>,
      okText: '彻底删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const response = await api.delete(`/reimbursement/${id}`);
          if (response.data.success) {
            toast.success('单据已物理抹除');
            fetchData();
          }
        } catch (error) { toast.error('删除失败'); }
      }
    });
  };

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 38, colorBorder: '#cbd5e1' },
        components: { 
            Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900, fontSize: 12 }
        }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen text-left font-black">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* 1. 物理缝合控制台 */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 pl-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <FileSpreadsheet size={20} />
                </div>
                <div>
                    <h1 className="text-base font-black text-slate-900 tracking-tight">我的报销申报记录</h1>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Financial Reimbursement Flow</p>
                </div>
            </div>

            <div className="flex items-center gap-3 pr-2">
                <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
                    <div className="px-3 h-full border-r border-slate-100 flex items-center bg-slate-100/50">
                        <Filter size={14} className="text-slate-400" />
                    </div>
                    <Select
                        className="w-44 !border-none flagship-select h-full"
                        bordered={false}
                        value={statusFilter}
                        onChange={(val) => { setStatusFilter(val); setPagination(p=>({...p, page:1})); }}
                        options={STATUS_OPTIONS}
                    />
                </div>
                <button className="h-9 w-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-white transition-all text-slate-400 hover:text-indigo-600" onClick={fetchData} disabled={loading}>
                    <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>

        {/* 2. 数据表格区 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {loading && records.length === 0 ? (
                <div className="py-24 text-center text-slate-400 font-black uppercase tracking-widest animate-pulse">正在同步物理账目流水...</div>
            ) : records.length === 0 ? (
                <div className="py-24 text-center">
                    <div className="text-4xl mb-4 opacity-20"><FileTextOutlined /></div>
                    <div className="text-slate-400 font-black text-xs uppercase tracking-widest">当前暂无任何报销申报记录</div>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse border-spacing-0">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-center border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">申报标题</th>
                                    <th className="px-6 py-4 text-center border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">业务类型</th>
                                    <th className="px-6 py-4 text-center border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">核销金额</th>
                                    <th className="px-6 py-4 text-center border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">当前状态</th>
                                    <th className="px-6 py-4 text-center border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">提交日期</th>
                                    <th className="px-6 py-4 text-center border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-widest">操作管理</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {records.map(record => {
                                    const statusCfg = STATUS_MAP[record.status] || STATUS_MAP.pending;
                                    return (
                                        <tr key={record.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-4 text-center font-black text-slate-800 text-xs">
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span>{record.title}</span>
                                                    <span className="text-[9px] text-slate-300 font-mono">#{record.reimbursement_no || record.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                                    {TYPE_LABELS[record.type] || record.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-sm font-black text-slate-900 font-mono tracking-tighter">
                                                    ¥ {parseFloat(record.total_amount || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Tag color={statusCfg.color} className="m-0 border-none font-black text-[9px] uppercase px-3 rounded-full shadow-sm flex items-center gap-1 justify-center mx-auto w-fit">
                                                    {statusCfg.icon}
                                                    {statusCfg.label}
                                                </Tag>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[11px] font-black text-slate-500">{new Date(record.created_at).toLocaleDateString()}</span>
                                                    <span className="text-[9px] text-slate-300 font-bold">{new Date(record.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-xs">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => onViewDetail?.(record)}
                                                        className="h-8 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm whitespace-nowrap">
                                                        详情明细
                                                    </button>

                                                    {record.status === 'draft' && (
                                                        <>
                                                            <button onClick={() => handleSubmit(record.id)}
                                                                className="h-8 px-4 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-all shadow-md active:scale-95 whitespace-nowrap">
                                                                推送提交
                                                            </button>
                                                            <button onClick={() => handleDelete(record.id)}
                                                                className="h-8 w-8 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-100">
                                                                <DeleteOutlined />
                                                            </button>
                                                        </>
                                                    )}

                                                    {['pending', 'approving'].includes(record.status) && (
                                                        <button onClick={() => handleCancel(record.id)}
                                                            className="h-8 px-4 bg-white border border-amber-200 text-amber-600 rounded-lg text-[10px] font-black uppercase hover:bg-amber-50 transition-all whitespace-nowrap">
                                                            撤销动作
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* 分页审计 */}
                    <div className="px-6 py-4 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">
                            AUDIT LOG: 共计计入 <span className="text-indigo-600 font-black">{pagination.total}</span> 条财务流水
                        </span>
                        <div className="flex items-center gap-2">
                            <button className="h-8 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black disabled:opacity-30 transition-all shadow-sm"
                                disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>
                                <ChevronLeft size={14} className="inline mr-1" /> 上一页
                            </button>
                            <div className="bg-white border border-slate-200 px-3 h-8 flex items-center rounded-lg shadow-sm">
                                <span className="text-[10px] font-black text-slate-900">{pagination.page} / {Math.ceil(pagination.total / pagination.limit) || 1}</span>
                            </div>
                            <button className="h-8 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black disabled:opacity-30 transition-all shadow-sm"
                                disabled={pagination.page * pagination.limit >= pagination.total} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>
                                下一页 <ChevronRight size={14} className="inline ml-1" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
    </ConfigProvider>
  );
};

export default ReimbursementList;
