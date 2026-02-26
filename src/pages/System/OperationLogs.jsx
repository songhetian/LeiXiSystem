import React, { useState, useEffect, useMemo } from 'react';
import { Table, Input, Select, DatePicker, ConfigProvider, Tag, Tooltip, InputNumber } from 'antd';
import { Search, X, RefreshCcw, Database, Info, Calendar, ArrowRight, Clock } from 'lucide-react';
import api from '../../api';
import dayjs from 'dayjs';
import { toast } from 'sonner';

const { RangePicker } = DatePicker;

const OperationLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState(null);
  
  const [filters, setFilters] = useState({
    username: '',
    module: undefined,
    status: undefined,
    dateRange: null
  });

  const modules = [
    { label: '用户管理', value: 'user' },
    { label: '权限管理', value: 'permission' },
    { label: '考勤管理', value: 'attendance' },
    { label: '假期管理', value: 'vacation' },
    { label: '报销管理', value: 'reimbursement' },
    { label: '财务资产', value: 'finance' },
    { label: '审批流配置', value: 'workflow' },
    { label: '信息系统', value: 'messaging' },
    { label: '质检管理', value: 'quality' },
    { label: '知识库', value: 'knowledge' },
    { label: '考核系统', value: 'assessment' },
    { label: '系统设置', value: 'system' }
  ];

  const moduleMap = modules.reduce((acc, curr) => { acc[curr.value] = curr.label; return acc; }, {});

  useEffect(() => { fetchLogs(); }, [currentPage, pageSize]);

  const fetchLogs = async (overrideFilters = null) => {
    setLoading(true);
    const activeFilters = overrideFilters || filters;
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        username: activeFilters.username,
        module: activeFilters.module,
        status: activeFilters.status,
        start_date: activeFilters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: activeFilters.dateRange?.[1]?.format('YYYY-MM-DD')
      };
      const response = await api.get('/system/logs', { params });
      if (response.data.success) {
        setLogs(response.data.data);
        setTotal(response.data.total);
      }
    } catch (error) { toast.error('同步审计日志失败'); } finally { setLoading(false) }
  };

  const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); }
  const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); }
  const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); }

  const totalPages = Math.ceil(total / pageSize);

  const handleDateQuickSelect = (type) => {
    let range = null;
    const now = dayjs();
    switch(type) {
      case 'today': range = [now, now]; break;
      case 'yesterday': range = [now.subtract(1, 'day'), now.subtract(1, 'day')]; break;
      case 'last7': range = [now.subtract(6, 'day'), now]; break;
      case 'last30': range = [now.subtract(29, 'day'), now]; break;
      case 'thisMonth': range = [now.startOf('month'), now]; break;
      default: range = null;
    }
    const newFilters = { ...filters, dateRange: range };
    setFilters(newFilters);
    setCurrentPage(1);
    fetchLogs(newFilters);
  };

  const isDateActive = (type) => {
    if (!filters.dateRange) return false;
    const now = dayjs();
    const [start, end] = filters.dateRange;
    const fmt = 'YYYY-MM-DD';
    switch(type) {
      case 'today': return start.format(fmt) === now.format(fmt) && end.format(fmt) === now.format(fmt);
      case 'yesterday': return start.format(fmt) === now.subtract(1, 'day').format(fmt) && end.format(fmt) === now.subtract(1, 'day').format(fmt);
      case 'last7': return start.format(fmt) === now.subtract(6, 'day').format(fmt) && end.format(fmt) === now.subtract(6, 'day').format(fmt) || (end.format(fmt) === now.format(fmt) && start.format(fmt) === now.subtract(6, 'day').format(fmt));
      case 'last30': return start.format(fmt) === now.subtract(29, 'day').format(fmt) && end.format(fmt) === now.format(fmt);
      case 'thisMonth': return start.format(fmt) === now.startOf('month').format(fmt) && end.format(fmt) === now.format(fmt);
      default: return false;
    }
  };

  const columns = [
    {
      title: '审计时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      align: 'center',
      render: (date) => <span className="text-[15px] font-black text-slate-900">{dayjs(date).format('YYYY-MM-DD HH:mm:ss')}</span>
    },
    {
      title: '执行者',
      key: 'user',
      width: 150,
      align: 'center',
      render: (_, record) => (
        <span className="text-[15px] font-black text-slate-900">
          {record.latest_real_name || record.real_name || '系统自动'}
        </span>
      )
    },
    {
      title: '业务域',
      dataIndex: 'module',
      key: 'module',
      width: 140,
      align: 'center',
      render: (m) => (
        <span className="inline-block px-3 py-1 bg-indigo-50 border-[1px] border-indigo-200 text-indigo-700 rounded-lg text-[13px] font-black">
          {moduleMap[m] || m}
        </span>
      )
    },
    {
      title: '行为明细',
      dataIndex: 'action',
      key: 'action',
      align: 'center',
      render: (text) => <span className="text-[13px] font-bold text-slate-700">{text}</span>
    },
    {
      title: '审计状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (s) => (
        <span className={`px-3 py-1 rounded-lg text-[11px] font-black border-[1px] ${s ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
          {s ? '成功' : '失败'}
        </span>
      )
    },
    {
      title: '详情',
      key: 'detail',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Tooltip title={
          <div className="text-xs p-2 font-bold">
            <div className="mb-1 text-indigo-300">[{record.method}] {record.url}</div>
            <div className="text-slate-400 font-black">IP: {record.ip}</div>
            {record.params && <div className="mt-1 break-all opacity-80 text-white font-black">Payload: {record.params}</div>}
          </div>
        } color="#0f172a" placement="left">
          <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600 border-[1px] border-transparent hover:border-slate-200"><Info size={18} /></button>
        </Tooltip>
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
            Select: { controlOutline: 'transparent', selectorBg: '#ffffff', colorBorder: '#64748b', colorBorderHover: '#4f46e5', optionSelectedBg: '#f5f3ff', optionSelectedColor: '#4f46e5', paddingSM: 12 }, 
            Input: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' },
            DatePicker: { colorBorder: '#64748b', colorBorderHover: '#4f46e5' }
        }
    }}>
    <div className="p-6 bg-[#f8fafc] min-h-screen select-none font-black text-left text-slate-900">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="px-10 py-6 border-b border-slate-50 flex justify-between items-center bg-white">
          <div className="flex items-center gap-5">
            <div className="w-14 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200"><Database size={26} /></div>
            <div className="flex flex-col text-left">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">全站操作审计</h1>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] mt-1 tracking-tighter">关键行为追踪与安全合规性记录</p>
            </div>
          </div>
          <button onClick={() => { setCurrentPage(1); fetchLogs(); }} className="h-11 px-8 bg-indigo-50 text-indigo-600 font-black rounded-lg text-xs hover:bg-indigo-100 transition-all flex items-center gap-2 border-[1px] border-indigo-200 shadow-sm"><RefreshCcw size={16} /> 刷新同步</button>
        </div>

        {/* 2. 旗舰全铺满·自适应单行搜索条 */}
        <div className="bg-slate-50/40 px-10 py-8">
            <div className="flex flex-wrap items-center gap-4 w-full">
                <div className="flex-[1.5] min-w-[150px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">执行者</label>
                    <Input placeholder="姓名/账号" value={filters.username} onChange={e => setFilters({...filters, username: e.target.value})} 
                        className="w-full h-11 px-3 font-black text-slate-900 rounded-lg shadow-sm border-[1px] border-slate-500" prefix={<Search size={14} className="text-slate-400" />} />
                </div>
                <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">业务域</label>
                    <Select placeholder="全部模块" allowClear options={modules} value={filters.module} onChange={val => setFilters({...filters, module: val})} className="w-full h-11 font-black" />
                </div>
                <div className="flex-[2.5] min-w-[240px]">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-widest ml-1">审计周期</label>
                    <RangePicker value={filters.dateRange} onChange={dates => setFilters({...filters, dateRange: dates})} className="w-full h-11 font-black shadow-sm" suffixIcon={<Calendar size={14} className="text-slate-400" />} />
                </div>
                
                {/* 物理合并：快捷日期按钮组 (自适应空间，且具备 1px slate-500 标准) */}
                <div className="flex items-center gap-1.5 mt-[19px]">
                    {[
                        { id: 'today', label: '今天' },
                        { id: 'yesterday', label: '昨天' },
                        { id: 'last7', label: '近7天' },
                        { id: 'thisMonth', label: '本月' }
                    ].map(btn => (
                        <button key={btn.id} onClick={() => handleDateQuickSelect(btn.id)}
                            className={`h-11 px-4 rounded-lg text-[11px] font-black transition-all ${isDateActive(btn.id) ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}>
                            {btn.label}
                        </button>
                    ))}
                </div>

                {/* 操作按钮区 (flex-none 保持固定宽度) */}
                <div className="flex gap-2 mt-[19px] flex-none">
                    <button onClick={() => { setCurrentPage(1); fetchLogs(); }} className="h-11 px-10 bg-slate-900 text-white font-black rounded-lg text-xs hover:bg-black transition-all shadow-lg border-[1px] border-slate-800">查询</button>
                    <button onClick={() => { setFilters({ username: '', module: undefined, status: undefined, dateRange: null }); setCurrentPage(1); }} className="h-11 px-6 bg-white border-[1px] border-slate-500 text-slate-600 font-black rounded-lg text-xs hover:bg-slate-50 transition-all shadow-sm">重置</button>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={logs} 
          rowKey="id"
          loading={loading}
          pagination={false}
        />
        
        <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-200 rounded-b-2xl shadow-inner">
            <div className="flex items-center gap-4 text-left font-black">
                <span className="text-[12px] font-black text-slate-900 uppercase tracking-widest">共审计 <span className="text-indigo-600">{total}</span> 条行为明细</span>
                <div className="h-4 w-[1px] bg-slate-400 mx-2" />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">展示条数</span>
                <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-24 font-black" options={[10, 20, 50].map(v => ({ label: `${v} 条`, value: v }))} />
            </div>
            <div className="flex items-center gap-3">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">← 上一页</button>
                <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 hover:text-indigo-600 font-black text-xs disabled:opacity-30 shadow-sm transition-all">下一页 →</button>
                <div className="flex items-center gap-2 ml-4 text-left">
                    <span className="text-[10px] font-black text-slate-500 uppercase">跳至</span>
                    <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-14 h-10 rounded-lg font-black text-center pt-1 border-[1px] border-slate-500" controls={false} />
                    <button onClick={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all shadow-lg shadow-slate-200"><ArrowRight size={16} /></button>
                </div>
            </div>
        </div>
      </div>
    </div>
    </ConfigProvider>
  );
};

export default OperationLogs;
