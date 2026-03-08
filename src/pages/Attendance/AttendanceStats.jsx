import api from '@/api';
import React, { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner';
import { getApiUrl } from '../../utils/apiConfig'
import { 
    Download, 
    RefreshCcw, 
    ArrowLeft, 
    Users,
    ChevronRight,
    Search,
    Calendar,
    LayoutGrid,
    Clock,
    CheckCircle2,
    TrendingUp,
    Timer,
    Building2,
    BarChart3
} from 'lucide-react';
import { ConfigProvider, Select, Card, Spin, message, Avatar, Empty, Table, Tag, Input, Button, DatePicker } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import logger from '@/utils/logger';

function AttendanceStats() {
  const [loading, setLoading] = useState(false)
  const [deptData, setDeptStats] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(dayjs())
  
  const [departments, setDepartments] = useState([])
  const [selectedDeptId, setSelectedDeptId] = useState(null)
  const [viewMode, setViewMode] = useState('dashboard') 
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [empReport, setEmpReport] = useState(null)
  const [dailyDetails, setDailyDetails] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [searchText, setSearchTerm] = useState('')

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments')
      if (res.data) {
        const list = Array.isArray(res.data) ? res.data : res.data.data || [];
        setDepartments(list)
        if (list.length > 0) setSelectedDeptId(list[0].id)
      }
    } catch (e) {
      logger.error('获取部门列表失败', e)
    }
  }

  useEffect(() => {
    if (selectedDeptId) {
      if (viewMode === 'dashboard') fetchDashboardData()
      else if (viewMode === 'detail' && selectedEmployee) fetchIndividualReport(selectedEmployee.id)
    }
  }, [selectedDeptId, selectedMonth, viewMode])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      // 🛡️ 路径对齐 V12
      const res = await api.get('/attendance/dashboard-summary', {
        params: { 
          department_id: selectedDeptId, 
          year: selectedMonth.year(), 
          month: selectedMonth.month() + 1 
        }
      })
      if (res.data && res.data.success) {
        setDeptStats(res.data.data)
      }
    } catch (error) {
      toast.error('获取部门统计失败')
    } finally { setLoading(false) }
  }

  const fetchIndividualReport = async (empId) => {
    setDetailsLoading(true)
    try {
      const params = { 
        employee_id: empId, 
        year: selectedMonth.year(), 
        month: selectedMonth.month() + 1 
      };
      
      const [reportRes, detailsRes] = await Promise.all([
        api.get('/attendance/personal-monthly-report', { params }),
        api.get('/attendance/daily-details', { params })
      ]);

      if (reportRes.data?.success) setEmpReport(reportRes.data.data)
      if (detailsRes.data?.success) setDailyDetails(detailsRes.data.data)
    } catch (e) { 
      toast.error('获取明细失败') 
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleEmpClick = (emp) => {
    setSelectedEmployee(emp)
    setViewMode('detail')
  }

  const mainColumns = [
    {
      title: '序号',
      key: 'index',
      align: 'center',
      width: 60,
      render: (_, __, index) => <span className="text-slate-900 font-bold">{(index + 1).toString().padStart(2, '0')}</span>
    },
    {
      title: '员工姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      align: 'center',
      width: 120,
      render: (text) => <span className="font-bold text-slate-900">{text}</span>
    },
    {
      title: '正常出勤',
      dataIndex: 'normal_days',
      key: 'normal_days',
      align: 'center',
      sorter: (a, b) => a.normal_days - b.normal_days,
      render: (val) => <span className="font-black text-emerald-600">{val}天</span>
    },
    {
      title: '异常次数',
      dataIndex: 'abnormal_days',
      key: 'abnormal_days',
      align: 'center',
      sorter: (a, b) => a.abnormal_days - b.abnormal_days,
      render: (val) => (
        <span className={`font-black ${val > 3 ? 'text-rose-600' : val > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
          {val} 次
        </span>
      )
    },
    {
      title: '累计请假',
      dataIndex: 'leave_days',
      key: 'leave_days',
      align: 'center',
      render: (val) => <span className="text-blue-600 font-black">{parseFloat(val || 0)}d</span>
    },
    {
      title: '月出勤率',
      key: 'rate',
      align: 'center',
      render: (_, record) => {
        const rate = record.normal_days > 0 ? (record.normal_days / 22 * 100).toFixed(1) : 0;
        return <span className="font-black text-slate-900">{rate}%</span>
      }
    },
    {
      title: '操作',
      key: 'action',
      align: 'center',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <button 
            onClick={() => handleEmpClick(record)} 
            className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 hover:underline transition-all"
        >
          查看详情
        </button>
      )
    }
  ];

  const detailColumns = [
    {
      title: '日期/周',
      dataIndex: 'record_date',
      key: 'record_date',
      align: 'center',
      width: 110,
      render: (text) => (
        <div className="flex flex-col">
            <span className="font-black text-slate-900">{dayjs(text).format('MM-DD')}</span>
            <span className="text-[9px] text-indigo-600 font-black uppercase">{dayjs(text).format('ddd')}</span>
        </div>
      )
    },
    {
      title: '排班情况',
      key: 'shift_status',
      align: 'center',
      render: (_, record) => {
        // 🛡️ V12 终极判定：优先看排班物理存在标记
        if (record.shift_name) {
          return <Tag className="border border-indigo-100 bg-indigo-50 text-indigo-700 rounded font-black text-[10px] px-2">{record.shift_name}</Tag>
        }
        if (record.is_rest_day === 1) {
          return <Tag className="border border-slate-200 bg-slate-50 text-slate-500 font-black text-[10px] px-2">公休 / 休息</Tag>
        }
        if (record.schedule_id) {
          return <Tag className="border border-amber-100 bg-amber-50 text-amber-600 font-black text-[10px] px-2">已排班(无名称)</Tag>
        }
        return <Tag className="border border-rose-100 bg-rose-50 text-rose-600 font-black text-[10px] px-2">未排班 / 漏排</Tag>
      }
    },
    {
      title: '签到时间',
      dataIndex: 'clock_in_time',
      key: 'clock_in_time',
      align: 'center',
      render: (val) => <span className="font-black text-slate-900">{val ? dayjs(val).format('HH:mm') : '--:--'}</span>
    },
    {
      title: '签退时间',
      dataIndex: 'clock_out_time',
      key: 'clock_out_time',
      align: 'center',
      render: (val) => <span className="font-black text-slate-900">{val ? dayjs(val).format('HH:mm') : '--:--'}</span>
    },
    {
      title: '考勤结论',
      dataIndex: 'attendance_status',
      key: 'attendance_status',
      align: 'center',
      render: (val, record) => {
        if (record.leave_type) return <Tag color="blue" className="rounded-md font-black border-none px-2 text-[10px]">请假({record.leave_type})</Tag>
        if (record.is_rest_day === 1 && val) return <Tag color="purple" className="rounded-md font-black border-none px-2 text-[10px]">加班打卡</Tag>
        if (record.is_rest_day === 1 && !val) return <span className="text-slate-400">-</span>;
        
        const statusMap = {
          'normal': { color: 'green', text: '出勤正常' },
          'late': { color: 'orange', text: '迟到异常' },
          'early': { color: 'orange', text: '早退异常' },
          'absent': { color: 'red', text: '旷工缺勤' }
        };
        const config = statusMap[val] || { color: 'default', text: val || (record.schedule_id ? '未打卡' : '无流水') };
        return <Tag color={config.color} className="rounded-md font-black border-none px-2 text-[10px]">{config.text}</Tag>
      }
    },
    {
      title: '计薪工时',
      dataIndex: 'work_hours',
      key: 'work_hours',
      align: 'center',
      render: (val) => val > 0 ? <span className="font-black text-emerald-700">{parseFloat(val).toFixed(1)}h</span> : <span className="text-slate-900">0.0h</span>
    },
    {
      title: '加班核定',
      dataIndex: 'overtime_hours',
      key: 'overtime_hours',
      align: 'center',
      render: (val) => val > 0 ? <span className="text-purple-600 font-black">+{val}h</span> : <span className="text-slate-900">-</span>
    }
  ];

  const filteredEmployees = useMemo(() => {
    if (!deptData?.employeeDetails) return [];
    if (!searchText) return deptData.employeeDetails;
    return deptData.employeeDetails.filter(e => 
      e.real_name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [deptData, searchText]);

  const statsSummary = useMemo(() => {
    if (!deptData?.summary) return { total: 0, rate: 0, hours: 0 };
    const s = deptData.summary;
    return {
      total: s.total_employees || 0,
      rate: s.total_employees > 0 ? (s.normal_days / (s.total_employees * 22) * 100).toFixed(1) : 0,
      hours: s.total_employees > 0 ? (s.total_work_hours / s.total_employees / 22).toFixed(1) : 0
    };
  }, [deptData]);

  const renderDashboard = () => (
    <div className="space-y-3 animate-in fade-in duration-500">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-2">
            <div className="flex flex-wrap items-center gap-6 px-2">
                <div className="flex items-center gap-10 py-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">部门人数</span>
                        <span className="text-base font-black text-slate-900">{statsSummary.total}</span>
                        <span className="text-[10px] opacity-30 font-bold ml-0.5">人</span>
                    </div>
                    <div className="w-px h-4 bg-slate-100"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">平均出勤</span>
                        <span className="text-base font-black text-emerald-600">{statsSummary.rate}</span>
                        <span className="text-[10px] opacity-30 font-bold ml-0.5">%</span>
                    </div>
                    <div className="w-px h-4 bg-slate-100"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">人均日工时</span>
                        <span className="text-base font-black text-indigo-600">{statsSummary.hours}</span>
                        <span className="text-[10px] opacity-30 font-bold ml-0.5">h/d</span>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-end gap-3">
                    <Input 
                        placeholder="搜索员工..." 
                        prefix={<Search size={12} className="text-slate-400" />}
                        className="w-36 rounded-lg bg-slate-50 border-none h-8 text-[11px]"
                        onChange={(e) => setSearchTerm(e.target.value)}
                        value={searchText}
                    />
                    <Button 
                        type="primary" 
                        size="small"
                        icon={<Download size={12} />} 
                        className="h-8 bg-slate-900 hover:bg-black border-none rounded-lg text-[10px] font-black px-4 shadow-sm"
                    >
                        导出报表
                    </Button>
                </div>
            </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <Table 
                columns={mainColumns} 
                dataSource={filteredEmployees} 
                rowKey="id" 
                pagination={{ pageSize: 10, showSizeChanger: false, className: "px-6 pb-2 pt-2" }}
                className="flagship-micro-table"
                scroll={{ x: 'max-content' }}
            />
        </div>
    </div>
  )

  const renderDetail = () => (
    <div className="space-y-3 animate-in slide-in-from-right duration-500">
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={() => setViewMode('dashboard')} className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all text-slate-400 flex items-center gap-1 pr-3">
                    <ArrowLeft size={16}/>
                    <span className="text-xs font-black text-slate-900">返回列表</span>
                </button>
                <div className="w-px h-4 bg-slate-200"></div>
                <div className="flex items-center gap-3">
                    <Avatar src={selectedEmployee?.avatar} size={32} icon={<UserOutlined />} className="bg-indigo-50 text-indigo-600" />
                    <div>
                        <h2 className="text-sm font-black text-slate-800">{selectedEmployee?.real_name} · 考勤明细流水</h2>
                        <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest">{selectedMonth.format('YYYY-MM')} 核心数据报表</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Tag className="rounded-md font-black bg-indigo-600 text-white border-none text-[10px] px-3">{selectedMonth.format('YYYY / MM')}</Tag>
                <button onClick={() => fetchIndividualReport(selectedEmployee?.id)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-900 transition-colors"><RefreshCcw size={16}/></button>
            </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
            {[
                { label: '出勤天数', value: empReport?.attendance?.clock_in_days || 0, unit: '天', color: 'emerald' },
                { label: '计薪时长', value: (empReport?.attendance?.total_work_hours || 0).toFixed(1), unit: 'h', color: 'indigo' },
                { label: '核定加班', value: (empReport?.overtime?.total_hours || 0).toFixed(1), unit: 'h', color: 'purple' },
                { label: '异常修正', value: empReport?.attendance?.makeup_count || 0, unit: '次', color: 'rose' }
            ].map((s, i) => (
                <div key={i} className="bg-white border border-slate-200 px-4 py-3 rounded-xl shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-0.5">{s.label}</p>
                    <h2 className="text-lg font-black text-slate-800">{s.value}<span className="text-[10px] ml-1 opacity-30">{s.unit}</span></h2>
                </div>
            ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <Table 
                columns={detailColumns} 
                dataSource={dailyDetails} 
                rowKey="record_date" 
                loading={detailsLoading}
                pagination={{ pageSize: 10, showSizeChanger: false, className: "px-6 pb-2 pt-2", position: ['bottomCenter'] }}
                className="flagship-micro-table"
                scroll={{ y: 480 }}
            />
        </div>
    </div>
  )

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 32, colorBorder: '#e2e8f0', fontSize: 12 }
    }}>
    <div className="space-y-3 text-left pb-10">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-1.5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-4 px-3">
                <div className="flex items-center gap-2">
                    <BarChart3 size={16} className="text-indigo-600" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-800">考勤报表驾驶舱</span>
                </div>

                <div className="flex items-center gap-2">
                    <Select
                        value={selectedDeptId}
                        onChange={(val) => setSelectedDeptId(val)}
                        className="w-40 flagship-clean-select"
                        variant="borderless"
                        options={departments.map(d => ({ label: d.name, value: d.id }))}
                    />
                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <DatePicker picker="month" value={selectedMonth} onChange={(val) => val && setSelectedMonth(val)} className="flagship-clean-datepicker w-32" variant="borderless" allowClear={false} suffixIcon={<Calendar size={12} className="text-indigo-600" />} />
                    <button onClick={fetchDashboardData} className="ml-1 p-1.5 hover:text-indigo-600 text-slate-400 transition-colors"><RefreshCcw size={14}/></button>
                </div>
            </div>
        </div>

      {loading ? (
        <div className="py-32 text-center"><Spin /></div>
      ) : (
        viewMode === 'dashboard' ? renderDashboard() : renderDetail()
      )}
    </div>
    <style dangerouslySetInnerHTML={{ __html: `
        .flagship-micro-table .ant-table-thead > tr > th { background: #f8fafc; color: #1e293b; font-weight: 900; font-size: 10px; text-transform: uppercase; padding: 10px 20px !important; border-bottom: 1px solid #f1f5f9; text-align: center !important; }
        .flagship-micro-table .ant-table-tbody > tr > td { padding: 10px 20px !important; border-bottom: 1px solid #f8fafc; text-align: center !important; font-size: 11px; color: #1e293b !important; font-weight: 700; }
        .flagship-micro-table .ant-table-tbody > tr:hover > td { background: #f5f7ff !important; }
        .flagship-clean-select .ant-select-selection-item { color: #1e293b !important; font-weight: 900 !important; font-size: 12px !important; }
        .flagship-clean-datepicker input { color: #1e293b !important; font-weight: 900 !important; font-size: 12px !important; cursor: pointer; }
    `}} />
    </ConfigProvider>
  )
}

export default AttendanceStats;
