import React, { useState, useEffect, useMemo } from 'react';
import { Table, Tag, Space, Card, Typography, Select, DatePicker, Button, ConfigProvider, Tooltip, InputNumber, Modal } from 'antd';
import { 
    CalendarOutlined, 
    DownloadOutlined, 
    ClockCircleOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    SyncOutlined,
    UnorderedListOutlined,
    HistoryOutlined,
    CloseCircleOutlined
} from '@ant-design/icons';
import { ChevronLeft, ChevronRight, ArrowRight, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import api from '../../api';
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig';
import { formatDate, formatBeijingDate } from '../../utils/date';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const AttendanceRecords = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({});
    const [viewMode, setViewMode] = useState('list'); // list, calendar, timeline
    
    // 物理分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [jumpPage, setJumpPage] = useState(null);

    // 详情模态框
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // 筛选状态
    const [dateRange, setDateRange] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    useEffect(() => {
        fetchRecords();
    }, [dateRange, statusFilter, pageSize, currentPage, selectedMonth, viewMode]);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const params = {
                page: currentPage,
                limit: viewMode === 'list' ? pageSize : 100, 
                employee_id: user.employee_id
            };

            if (dateRange) {
                params.start_date = dateRange[0].format('YYYY-MM-DD');
                params.end_date = dateRange[1].format('YYYY-MM-DD');
            }
            if (statusFilter !== 'all') params.status = statusFilter;

            const response = await api.get('/attendance/records', { params });
            if (response.data.success) {
                setRecords(response.data.data);
                setTotal(response.data.total || 0);
                setStats(response.data.stats || {});
            }
        } catch (error) {
            toast.error('物理读取考勤流水失败');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); setJumpPage(null); };
    const handlePageSizeChange = (s) => { setPageSize(s); setCurrentPage(1); };
    const handleJumpPage = () => { if (jumpPage >= 1 && jumpPage <= totalPages) setCurrentPage(jumpPage); setJumpPage(null); };

    const totalPages = Math.ceil(total / pageSize);
    const renderPageNumbers = () => {
        const pages = [];
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);
        for (let i = start; i <= end; i++) {
            pages.push(
                <button key={i} onClick={() => handlePageChange(i)} 
                    className={`w-10 h-10 rounded-lg text-sm font-black transition-all ${currentPage === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border-[1px] border-slate-500 text-slate-600 hover:border-slate-900'}`}
                >
                    {i}
                </button>
            );
        }
        return pages;
    };

    const getStatusBadge = (status) => {
        const map = {
            normal: { color: 'green', text: '正常' },
            late: { color: 'red', text: '迟到' },
            early: { color: 'orange', text: '早退' },
            early_leave: { color: 'orange', text: '早退' },
            absent: { color: 'error', text: '缺勤' },
            leave: { color: 'blue', text: '请假' },
            overtime: { color: 'purple', text: '加班' }
        };
        const config = map[status] || { color: 'default', text: status };
        return <Tag color={config.color} className="font-black border-slate-500">{config.text}</Tag>;
    };

    const renderCalendarView = () => {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();
        const days = [];
        for (let i = 0; i < startDayOfWeek; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);

        return (
            <div className="bg-white rounded-3xl border border-slate-500 p-8 shadow-sm animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setSelectedMonth(new Date(year, month - 1))} className="p-2.5 rounded-lg border border-slate-500 hover:bg-slate-900 hover:text-white transition-all"><ChevronLeft size={20}/></button>
                    <h3 className="text-xl font-black text-slate-900">{year}年 {month + 1}月 打卡历</h3>
                    <button onClick={() => setSelectedMonth(new Date(year, month + 1))} className="p-2.5 rounded-lg border border-slate-500 hover:bg-slate-900 hover:text-white transition-all"><ChevronRight size={20}/></button>
                </div>
                <div className="grid grid-cols-7 gap-3">
                    {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-center font-black text-slate-400 text-xs py-4 uppercase tracking-widest">{d}</div>)}
                    {days.map((day, idx) => {
                        if (!day) return <div key={`e-${idx}`} className="aspect-square bg-slate-50/30 rounded-xl"></div>;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const record = records.find(r => r.record_date?.split('T')[0] === dateStr);
                        return (
                            <div key={day} onClick={() => { if(record){ setSelectedRecord(record); setShowDetailModal(true); }}} 
                                className={`aspect-square border-[1px] rounded-xl p-3 flex flex-col justify-between transition-all cursor-pointer hover:shadow-lg ${record ? 'border-slate-500 bg-white' : 'border-slate-100 bg-slate-50/50 opacity-40'}`}>
                                <span className="font-black text-slate-900 text-sm">{day}</span>
                                {record && (
                                    <div className="flex flex-col gap-1 items-center">
                                        <div className={`w-1.5 h-1.5 rounded-full ${record.status === 'normal' ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
                                        <span className="text-[9px] font-black text-slate-400">{record.clock_in_time?.substring(11,16)}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderTimelineView = () => (
        <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
            {records.map((record, i) => (
                <div key={record.id} className="relative pl-12 group">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200 group-last:bottom-auto group-last:h-8"></div>
                    <div className="absolute left-0 top-2 w-8 h-8 rounded-full border-2 border-slate-500 bg-white flex items-center justify-center font-black text-xs text-slate-900 z-10 shadow-sm">
                        {new Date(record.record_date).getDate()}
                    </div>
                    <Card className="rounded-2xl border-slate-500 shadow-sm hover:border-indigo-500 transition-all cursor-pointer" onClick={() => { setSelectedRecord(record); setShowDetailModal(true); }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(record.record_date)}</p>
                                    <h4 className="text-[15px] font-black text-slate-900">{record.type === 'leave' ? `🌴 请假: ${record.leave_type}` : '⏰ 出勤打卡'}</h4>
                                </div>
                                <div className="h-10 w-px bg-slate-100"></div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400">上班</span><span className="text-sm font-black">{record.clock_in_time?.substring(11,16) || '--:--'}</span></div>
                                    <div className="flex flex-col"><span className="text-[9px] font-black text-slate-400">下班</span><span className="text-sm font-black">{record.clock_out_time?.substring(11,16) || '--:--'}</span></div>
                                </div>
                            </div>
                            {getStatusBadge(record.status)}
                        </div>
                    </Card>
                </div>
            ))}
        </div>
    );

    const columns = [
        {
            title: '日期',
            dataIndex: 'record_date',
            key: 'record_date',
            render: (text) => <span className="font-black text-slate-900">{formatDate(text)}</span>
        },
        {
            title: '打卡时间',
            key: 'clock',
            render: (_, record) => (
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 rounded font-black border border-emerald-100">上</span>
                        <span className="text-[13px] font-black">{record.clock_in_time ? record.clock_in_time.substring(11, 16) : '--:--'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 rounded font-black border border-blue-100">下</span>
                        <span className="text-[13px] font-black">{record.clock_out_time ? record.clock_out_time.substring(11, 16) : '--:--'}</span>
                    </div>
                </div>
            )
        },
        {
            title: '时长',
            dataIndex: 'work_hours',
            key: 'work_hours',
            align: 'center',
            render: (h) => <span className="font-black text-indigo-600">{h ? `${h}h` : '--'}</span>
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            align: 'center',
            render: (s) => getStatusBadge(s)
        },
        {
            title: '备注',
            dataIndex: 'remark',
            key: 'remark',
            render: (t) => <span className="text-slate-400 text-xs font-bold truncate max-w-[150px] inline-block">{t || '-'}</span>
        },
        {
            title: '操作',
            key: 'action',
            align: 'center',
            render: (_, record) => (
                <Button type="text" size="small" onClick={() => { setSelectedRecord(record); setShowDetailModal(true); }} className="font-black text-indigo-600 hover:bg-indigo-50">详情</Button>
            )
        }
    ];

    const statsConfig = [
        { label: '总天数', value: stats.total_days || 0, color: 'slate', icon: <CalendarOutlined /> },
        { label: '正常', value: stats.normal_count || 0, color: 'emerald', icon: <CheckCircleOutlined /> },
        { label: '迟到', value: stats.late_count || 0, color: 'rose', icon: <ExclamationCircleOutlined /> },
        { label: '早退', value: stats.early_count || 0, color: 'orange', icon: <ExclamationCircleOutlined /> },
        { label: '缺勤', value: stats.absent_count || 0, color: 'red', icon: <CloseCircleOutlined /> },
        { label: '请假', value: stats.leave_count || 0, color: 'blue', icon: <ClockCircleOutlined /> },
        { label: '加班', value: stats.overtime_count || 0, color: 'purple', icon: <SyncOutlined /> },
        { label: '工时', value: stats.avg_work_hours || 0, color: 'indigo', icon: <ClockCircleOutlined />, unit: 'h' },
    ];

    return (
        <ConfigProvider theme={{
            token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
            components: { 
                Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900 },
                Select: { colorBorder: '#64748b' }
            }
        }}>
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* 增强型统计卡片 - 多彩透明 + 醒目字体 */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {statsConfig.map((s, i) => (
                    <div key={i} className={`bg-${s.color}-500/10 border border-${s.color}-500/30 p-4 rounded-2xl shadow-sm text-center transition-all hover:scale-105 hover:bg-${s.color}-500/20`}>
                        <div className={`flex items-center justify-center gap-1.5 text-[11px] font-black text-${s.color}-700 uppercase mb-1`}>
                            {s.icon} {s.label}
                        </div>
                        <div className={`text-2xl font-black text-${s.color}-900`}>
                            {s.value}<span className="text-xs ml-0.5 opacity-60">{s.unit || ''}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 搜索控制台 */}
            <div className="flex flex-wrap items-center gap-4 w-full">
                <div className="flex items-center bg-white rounded-lg shadow-sm border border-slate-500 overflow-hidden h-[44px]">
                    <div className="flex shrink-0 h-full border-r border-slate-200">
                        <button onClick={() => setDateRange(null)} className={`px-6 h-full text-[12px] font-black transition-all ${!dateRange ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>全部</button>
                    </div>
                    <RangePicker 
                        value={dateRange} 
                        onChange={setDateRange}
                        className="w-72 !border-none h-full font-black px-6 shadow-none" 
                        placeholder={['开始日期', '结束日期']}
                    />
                </div>

                <Select 
                    value={statusFilter} 
                    onChange={setStatusFilter}
                    className="w-44 font-black flagship-select h-[44px]"
                    options={[
                        { label: '💠 全部状态', value: 'all' },
                        { label: '🟢 正常', value: 'normal' },
                        { label: '🔴 迟到', value: 'late' },
                        { label: '🟠 早退', value: 'early' },
                        { label: '⚠️ 缺勤', value: 'absent' },
                        { label: '🌴 请假', value: 'leave' },
                    ]}
                />

                <div className="flex bg-white border border-slate-500 rounded-xl p-1 shadow-sm ml-auto">
                    {[
                        { id: 'list', icon: <UnorderedListOutlined />, label: '列表' },
                        { id: 'calendar', icon: <CalendarOutlined />, label: '日历' },
                        { id: 'timeline', icon: <HistoryOutlined />, label: '轴带' }
                    ].map(btn => (
                        <button key={btn.id} onClick={() => setViewMode(btn.id)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black transition-all ${viewMode === btn.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {btn.icon} <span>{btn.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* 内容渲染区 */}
            {viewMode === 'list' && (
                <Card className="rounded-3xl border-slate-500 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
                    <Table columns={columns} dataSource={records} rowKey="id" loading={loading} pagination={false} />
                    {total > pageSize && (
                        <div className="px-10 py-8 bg-slate-50/50 flex items-center justify-between border-t border-slate-500">
                            <div className="flex items-center gap-4 text-left font-black">
                                <span className="text-[12px] text-slate-900 uppercase tracking-widest">共找到 <span className="text-indigo-600">{total}</span> 条记录</span>
                                <Select size="small" value={pageSize} onChange={handlePageSizeChange} className="w-28 font-black" options={[10, 20, 50].map(v => ({ label: `${v} 条/页`, value: v }))} />
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 font-black text-xs disabled:opacity-30 transition-all">← 上一页</button>
                                <div className="flex gap-1.5 mx-2">{renderPageNumbers()}</div>
                                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="h-10 px-5 rounded-lg bg-white border-[1px] border-slate-500 text-slate-900 font-black text-xs disabled:opacity-30 transition-all">下一页 →</button>
                                <div className="flex items-center gap-2 ml-4">
                                    <span className="text-[10px] font-black text-slate-500 uppercase">跳转</span>
                                    <InputNumber min={1} max={totalPages} value={jumpPage} onChange={setJumpPage} onPressEnter={handleJumpPage} className="w-16 h-10 rounded-lg font-black border-slate-500 flagship-input-number" controls={false} />
                                    <button handleJumpPage={handleJumpPage} className="h-10 w-10 flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-lg hover:bg-black transition-all"><ArrowRight size={16} /></button>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {viewMode === 'calendar' && renderCalendarView()}
            {viewMode === 'timeline' && renderTimelineView()}

            {/* 详情模态框 */}
            <Modal
                title={<span className="font-black text-lg">打卡轨迹详情</span>}
                open={showDetailModal}
                onCancel={() => setShowDetailModal(false)}
                footer={[<Button key="close" onClick={() => setShowDetailModal(false)} className="font-black h-11 px-10 bg-slate-900 text-white border-none rounded-lg">我知道了</Button>]}
                width={600}
                centered
            >
                {selectedRecord && (
                    <div className="space-y-6 py-4">
                        <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-200">
                            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">考勤状态</p>{getStatusBadge(selectedRecord.status)}</div>
                            <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">打卡工时</p><span className="text-2xl font-black text-slate-900">{selectedRecord.work_hours || '0.0'} h</span></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 border border-slate-200 rounded-xl">
                                <div className="flex items-center gap-2 text-emerald-600 mb-2"><Clock size={16}/><span className="text-xs font-black">上班打卡</span></div>
                                <div className="text-lg font-black">{selectedRecord.clock_in_time?.substring(11,16) || '--:--'}</div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2"><MapPin size={10}/>{selectedRecord.clock_in_location || '位置未同步'}</div>
                            </div>
                            <div className="p-4 border border-slate-200 rounded-xl">
                                <div className="flex items-center gap-2 text-blue-600 mb-2"><Clock size={16}/><span className="text-xs font-black">下班打卡</span></div>
                                <div className="text-lg font-black">{selectedRecord.clock_out_time?.substring(11,16) || '--:--'}</div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2"><MapPin size={10}/>{selectedRecord.clock_out_location || '位置未同步'}</div>
                            </div>
                        </div>
                        {selectedRecord.remark && <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-sm font-bold text-amber-900">{selectedRecord.remark}</div>}
                    </div>
                )}
            </Modal>
        </div>
        </ConfigProvider>
    );
};

export default AttendanceRecords;
