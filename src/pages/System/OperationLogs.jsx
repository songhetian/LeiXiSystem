import React, { useState, useEffect, useMemo } from 'react';
import { Table, Input, Select, DatePicker, ConfigProvider, Tag, Tooltip, InputNumber, Typography, Space, Button } from 'antd';
import { Search, X, RefreshCcw, Database, Info, Calendar, ArrowRight, Clock } from 'lucide-react';
import api from '../../api';
import dayjs from 'dayjs';
import { toast } from 'sonner';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

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
      title: <div className="text-slate-900 font-black text-center">审计时间</div>,
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      align: 'center',
      render: (date) => <Text className="text-[14px] font-black text-slate-900">{dayjs(date).format('YYYY-MM-DD HH:mm:ss')}</Text>
    },
    {
      title: <div className="text-slate-900 font-black text-center">执行者</div>,
      key: 'user',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Text className="text-[14px] font-black text-slate-900">
          {record.latest_real_name || record.real_name || '系统自动'}
        </Text>
      )
    },
    {
      title: <div className="text-slate-900 font-black text-center">业务域</div>,
      dataIndex: 'module',
      key: 'module',
      width: 120,
      align: 'center',
      render: (m) => (
        <Tag className="font-black border-slate-400 text-slate-900 bg-slate-100 px-3 py-1 rounded shadow-sm">
          {moduleMap[m] || m}
        </Tag>
      )
    },
    {
      title: <div className="text-slate-900 font-black text-center">行为明细</div>,
      dataIndex: 'action',
      key: 'action',
      align: 'center',
      render: (text) => <Text className="text-[13px] font-black text-slate-900">{text}</Text>
    },
    {
      title: <div className="text-slate-900 font-black text-center">审计状态</div>,
      dataIndex: 'status',
      key: 'status',
      width: 90,
      align: 'center',
      render: (s) => (
        <Tag className={`font-black border-none px-3 py-1 rounded shadow-sm ${s ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
          {s ? '成功' : '失败'}
        </Tag>
      )
    },
    {
      title: <div className="text-slate-900 font-black text-center">详情</div>,
      key: 'detail',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title={
          <div className="text-[11px] p-2 font-black">
            <div className="mb-1 text-indigo-200">[{record.method}] {record.url}</div>
            <div className="text-slate-300">操作人姓名: {record.latest_real_name || record.real_name || '系统'}</div>
            <div className="text-slate-300">IP: {record.ip}</div>
            {record.params && <div className="mt-1 break-all text-white/90">Payload: {record.params}</div>}
          </div>
        } color="#0f172a" placement="left">
          <Button type="text" size="small" icon={<Info size={16} className="text-slate-500" />} className="hover:bg-slate-100" />
        </Tooltip>
      )
    }
  ];

  const renderPageNumbers = () => {
    const pages = []; const start = Math.max(1, currentPage - 2); const end = Math.min(totalPages, currentPage + 2)
    for (let i = start; i <= end; i++) pages.push(<button key={i} onClick={() => handlePageChange(i)} className={`w-8 h-8 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-500 text-slate-700 hover:border-slate-900'}`}>{i}</button>)
    return pages
  }

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#000000', borderRadius: 6, controlHeight: 36, colorBorder: '#64748b' },
        components: { 
            Select: { colorBorder: '#64748b' }, 
            Input: { colorBorder: '#64748b' },
            DatePicker: { colorBorder: '#64748b' }
        }
    }}>
    <div className="p-4 bg-[#f8fafc] min-h-screen select-none font-black text-left">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="flex items-center gap-4">
            <div className="w-11 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-lg"><Database size={22} /></div>
            <div className="flex flex-col text-left">
                <Title level={4} className="m-0 font-black text-slate-900 tracking-tight">全站操作审计</Title>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mt-0.5">关键行为追踪与安全合规性记录</p>
            </div>
          </div>
          <Button onClick={() => { setCurrentPage(1); fetchLogs(); }} icon={<RefreshCcw size={14} />} className="font-black border-slate-400">刷新同步</Button>
        </div>

        <div className="bg-slate-50/40 px-6 py-4">
            <div className="flex items-center gap-3 w-full">
                <div className="w-[150px] flex-none">
                    <Input placeholder="执行者" value={filters.username} onChange={e => setFilters({...filters, username: e.target.value})} 
                        className="w-full h-9 font-black text-slate-900 border-slate-500" prefix={<Search size={14} className="text-slate-500" />} />
                </div>
                <div className="w-[150px] flex-none">
                    <Select placeholder="业务域" allowClear options={modules} value={filters.module} 
                        onChange={val => { const nf = {...filters, module: val}; setFilters(nf); setCurrentPage(1); fetchLogs(nf); }} 
                        className="w-full h-9 font-black" />
                </div>
                <div className="flex-grow">
                    <RangePicker value={filters.dateRange} 
                        onChange={dates => { const nf = {...filters, dateRange: dates}; setFilters(nf); setCurrentPage(1); fetchLogs(nf); }} 
                        className="w-full h-9 font-black border-slate-500" />
                </div>
                
                <div className="flex items-center gap-1 flex-none">
                    {['today', 'yesterday', 'last7', 'thisMonth'].map(type => (
                        <Button key={type} size="small" onClick={() => handleDateQuickSelect(type)}
                            className={`font-black ${isDateActive(type) ? 'bg-slate-900 text-white' : 'text-slate-700 border-slate-500'}`}>
                            {{today:'今天',yesterday:'昨天',last7:'近7天',thisMonth:'本月'}[type]}
                        </Button>
                    ))}
                </div>

                <div className="flex gap-2 flex-none ml-2">
                    <Button onClick={() => { setCurrentPage(1); fetchLogs(); }} type="primary" className="bg-slate-900 font-black h-9">检索</Button>
                    <Button onClick={() => { const nf = { username: '', module: undefined, status: undefined, dateRange: null }; setFilters(nf); setCurrentPage(1); fetchLogs(nf); }} 
                        className="font-black h-9 border-slate-500 text-slate-700">重置</Button>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <Table 
          columns={columns} 
          dataSource={logs} 
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
        />
        
        <div className="px-6 py-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-200">
            <div className="flex items-center gap-3 text-left font-black">
                <Text className="text-[11px] font-black text-slate-900 uppercase tracking-widest">共 <span className="text-indigo-700">{total}</span> 条日志</Text>
                <div className="h-3 w-[1px] bg-slate-300 mx-1" />
                <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-20 font-black" options={[10, 20, 50].map(v => ({ label: `${v}条`, value: v }))} />
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-8 px-3 rounded-lg bg-white border border-slate-400 text-slate-900 hover:text-indigo-700 font-black text-xs disabled:opacity-30 transition-all">←</button>
                <div className="flex gap-1 mx-1">{renderPageNumbers()}</div>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-8 px-3 rounded-lg bg-white border border-slate-400 text-slate-900 hover:text-indigo-700 font-black text-xs disabled:opacity-30 transition-all">→</button>
                <div className="flex items-center gap-2 ml-3">
                    <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-12 h-8 rounded-lg font-black text-center" controls={false} />
                    <button onClick={handleJumpPage} className="h-8 w-8 flex items-center justify-center rounded-lg bg-slate-900 text-white hover:bg-black transition-all"><ArrowRight size={14} /></button>
                </div>
            </div>
        </div>
      </div>
    </div>
    </ConfigProvider>
  );
};

export default OperationLogs;
