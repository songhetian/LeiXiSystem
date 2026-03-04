/**
 * Displays a statistical analysis page of each departments of
 */

import { useState, useEffect } from 'react'
import api from '../../api'
import { toast } from 'sonner';
import { getCurrentUser, isSystemAdmin } from '../../utils/auth'
import { getApiUrl } from '../../utils/apiConfig'
import { formatDate, formatDateTime } from '../../utils/date'
import { Table, Button, Input, Select, DatePicker, Space, Modal, ConfigProvider, Tag, Card, Skeleton, Empty } from 'antd'
import { SearchOutlined, ExportOutlined } from '@ant-design/icons'
import { ChevronLeft, ChevronRight, Users, CheckCircle2, Clock, TrendingUp, X } from 'lucide-react'


export default function DepartmentStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')

  // Date Selection Mode: 'month' or 'custom'
  const [dateMode, setDateMode] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })
  const [customDateRange, setCustomDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  // Search
  const [keyword, setKeyword] = useState('')

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  })

  // Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedEmployeeForDetails, setSelectedEmployeeForDetails] = useState(null)
  const [employeeDetails, setEmployeeDetails] = useState([])
  const [detailsLoading, setDetailsLoading] = useState(false)

  useEffect(() => {
    fetchDepartments()
  }, [])

  useEffect(() => {
    if (selectedDepartment) {
      fetchDepartmentStats()
    }
  }, [selectedDepartment, selectedMonth, customDateRange, dateMode, pagination.page, pagination.limit])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedDepartment) {
        setPagination(prev => ({ ...prev, page: 1 }))
        fetchDepartmentStats()
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [keyword])

  const fetchDepartments = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {}

      const response = await api.get('/api/departments/list')
      if (response.data.success) {
        const activeDepts = response.data.data.filter(d => d.status === 'active')

        setDepartments(activeDepts)
        if (activeDepts.length > 0) {
          setSelectedDepartment(activeDepts[0].id)
        } else {
          toast.warning('没有可用的部门，请联系管理员配置部门权限')
        }
      }
    } catch (error) {
      console.error('获取部门列表失败:', error)
      toast.error('获取部门列表失败')
    }
  }

  const fetchDepartmentStats = async () => {
    setLoading(true)
    try {
      const params = {
        department_id: selectedDepartment,
        page: pagination.page,
        limit: pagination.limit,
        keyword: keyword
      }

      if (dateMode === 'month') {
        params.year = selectedMonth.year
        params.month = selectedMonth.month
      } else {
        params.start_date = customDateRange.start
        params.end_date = customDateRange.end
      }

      const response = await api.get('/api/attendance/department-stats', {
        params
      })

      if (response.data.success) {
        setStats(response.data.data)
        if (response.data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.data.pagination.total
          }))
        }
      }
    } catch (error) {
      console.error('获取部门统计失败:', error)
      // toast.error('获取部门统计失败') // Prevent spamming toasts on search
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployeeDetails = async (employee) => {
    setSelectedEmployeeForDetails(employee)
    setShowDetailsModal(true)
    setDetailsLoading(true)
    setEmployeeDetails([])

    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      let startDate, endDate
      if (dateMode === 'month') {
        startDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`
        endDate = new Date(selectedMonth.year, selectedMonth.month, 0).toISOString().split('T')[0]
      } else {
        startDate = customDateRange.start
        endDate = customDateRange.end
      }

      const response = await api.get('/api/attendance/records', {
        params: {
          employee_id: employee.employee_id, // Use employee_id from stats
          start_date: startDate,
          end_date: endDate
        }
      })

      if (response.data.success) {
        setEmployeeDetails(response.data.data)
      }
    } catch (error) {
      console.error('获取详情失败:', error)
      toast.error('获取详情失败')
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleMonthChange = (year, month) => {
    setSelectedMonth({ year, month })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handlePrevMonth = () => {
    const newMonth = selectedMonth.month - 1
    if (newMonth < 1) {
      handleMonthChange(selectedMonth.year - 1, 12)
    } else {
      handleMonthChange(selectedMonth.year, newMonth)
    }
  }

  const handleNextMonth = () => {
    const newMonth = selectedMonth.month + 1
    if (newMonth > 12) {
      handleMonthChange(selectedMonth.year + 1, 1)
    } else {
      handleMonthChange(selectedMonth.year, newMonth)
    }
  }

  const handleThisMonth = () => {
    const now = new Date()
    handleMonthChange(now.getFullYear(), now.getMonth() + 1)
  }

  const handleExport = () => {
    let url = getApiUrl(`/api/export/department/${selectedDepartment}`)
    if (dateMode === 'month') {
      const month = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`
      url += `?month=${month}`
    } else {
      url += `?start_date=${customDateRange.start}&end_date=${customDateRange.end}`
    }

    if (keyword) {
        url += `&keyword=${encodeURIComponent(keyword)}`
    }

    window.open(url, '_blank')
    toast.success('正在导出...')
  }

  const isCurrentMonth = () => {
    const now = new Date()
    return selectedMonth.year === now.getFullYear() && selectedMonth.month === now.getMonth() + 1
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      align: 'center',
      width: 120
    },
    {
      title: '出勤天数',
      dataIndex: 'attendance_days',
      key: 'attendance_days',
      align: 'center',
      width: 100
    },
    {
      title: '出勤率',
      dataIndex: 'attendance_rate',
      key: 'attendance_rate',
      align: 'center',
      width: 100,
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
          value >= 95 ? 'bg-green-50 text-green-700 border border-green-200' :
          value >= 85 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
          'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {value}%
        </span>
      )
    },
    {
      title: '迟到',
      dataIndex: 'late_count',
      key: 'late_count',
      align: 'center',
      width: 80,
      render: (value) => {
        const count = Number(value) || 0
        return count > 0 ? count : '-'
      }
    },
    {
      title: '早退',
      dataIndex: 'early_count',
      key: 'early_count',
      align: 'center',
      width: 80,
      render: (value) => {
        const count = Number(value) || 0
        return count > 0 ? count : '-'
      }
    },
    {
      title: '缺勤',
      dataIndex: 'absent_count',
      key: 'absent_count',
      align: 'center',
      width: 80,
      render: (value) => {
        const count = Number(value) || 0
        return count > 0 ? count : '-'
      }
    },
    {
      title: '请假',
      dataIndex: 'leave_days',
      key: 'leave_days',
      align: 'center',
      width: 80,
      render: (value) => value > 0 ? value : '-'
    },
    {
      title: '工作时长',
      dataIndex: 'total_work_hours',
      key: 'total_work_hours',
      align: 'center',
      width: 100,
      render: (value) => `${value}h`
    }
  ]

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 36, colorBorder: '#cbd5e1' },
        components: { 
            Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900, fontSize: 12 }
        }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 font-black text-left">
      
      {/* 1. 物理缝合控制台 */}
      <div className="flex flex-wrap items-center gap-3 w-full bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
            <Select 
                value={selectedDepartment} 
                onChange={setSelectedDepartment}
                className="w-40 !border-none flagship-select h-full"
                bordered={false}
                options={departments.map(d => ({ label: d.name, value: d.id }))}
            />
          </div>

          <div className="flex bg-slate-50 rounded-lg border border-slate-100 p-0.5 h-[36px]">
            <button onClick={() => setDateMode('month')} className={`px-4 text-[11px] font-black rounded-md transition-all ${dateMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>按月统计</button>
            <button onClick={() => setDateMode('custom')} className={`px-4 text-[11px] font-black rounded-md transition-all ${dateMode === 'custom' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>自定义日期</button>
          </div>

          {dateMode === 'month' ? (
            <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
                <button onClick={handlePrevMonth} className="px-2 h-full border-r border-slate-100 hover:bg-white transition-all text-slate-400"><ChevronLeft size={14}/></button>
                <DatePicker.MonthPicker
                  variant="borderless"
                  placeholder={`${selectedMonth.year}年${selectedMonth.month}月`}
                  onChange={(date) => date && handleMonthChange(date.year(), date.month() + 1)}
                  format="YYYY年 MM月"
                  className="font-black text-slate-700 text-xs text-center w-28 h-full"
                  allowClear={false}
                  suffixIcon={null}
                />
                <button onClick={handleNextMonth} className="px-2 h-full border-l border-slate-100 hover:bg-white transition-all text-slate-400"><ChevronRight size={14}/></button>
            </div>
          ) : (
            <DatePicker.RangePicker 
                className="h-[36px] font-black text-xs border-slate-100 rounded-lg bg-slate-50"
                onChange={(dates) => dates && setCustomDateRange({ start: dates[0].format('YYYY-MM-DD'), end: dates[1].format('YYYY-MM-DD') })}
            />
          )}

          <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-100 px-3 h-[36px] min-w-[150px]">
            <SearchOutlined className="text-slate-300 mr-2" />
            <input 
                placeholder="搜索姓名或工号..." 
                className="w-full bg-transparent outline-none text-[11px] font-black placeholder:text-slate-300"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
            />
          </div>

          <Button type="primary" icon={<ExportOutlined />} onClick={handleExport} className="h-[36px] bg-indigo-600 border-none rounded-lg text-[11px] font-black shadow-md px-6">导出报表</Button>
      </div>

      {!stats ? (
        <div className="py-20 text-center bg-white border border-slate-200 rounded-2xl border-dashed">
            <span className="text-slate-400 font-black text-xs">请选择业务部门以加载效能分析数据</span>
        </div>
      ) : (
        <>
          {/* 2. 部门效能概览 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
                { label: '部门总人数', value: stats.summary.total_employees, unit: '人', color: 'blue', icon: <Users size={18}/> },
                { label: '平均出勤率', value: stats.summary.attendance_rate, unit: '%', color: 'emerald', icon: <CheckCircle2 size={18}/> },
                { label: '累计迟到次数', value: Number(stats.summary.total_late_count) || 0, unit: '次', color: 'rose', icon: <Clock size={18}/> },
                { label: '累计早退次数', value: Number(stats.summary.total_early_count) || 0, unit: '次', color: 'amber', icon: <TrendingUp size={18}/> }
            ].map((s, i) => (
                <div key={i} className={`bg-white border border-slate-200 p-5 rounded-2xl shadow-sm group transition-all hover:border-${s.color}-400`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className={`w-9 h-9 rounded-xl bg-${s.color}-50 text-${s.color}-600 flex items-center justify-center`}>{s.icon}</div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900 leading-none">{s.value}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{s.unit}</span>
                    </div>
                </div>
            ))}
          </div>

          {/* 3. 员工效能清单 */}
          <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
            <Table
                columns={columns}
                dataSource={stats?.employees || []}
                rowKey="user_id"
                loading={loading}
                size="small"
                onRow={(record) => ({
                    onClick: () => fetchEmployeeDetails(record),
                    className: 'cursor-pointer hover:bg-slate-50/50'
                })}
                pagination={{
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    showSizeChanger: true,
                    size: 'small',
                    showTotal: (t) => <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total {t} Employees</span>,
                    onChange: (page, pageSize) => setPagination({ page, limit: pageSize })
                }}
                className="flagship-table"
            />
          </Card>
        </>
      )}

      {/* 详情模态框：极致毛玻璃轻量化 */}
      <Modal
        open={showDetailsModal}
        onCancel={() => setShowDetailsModal(false)}
        footer={null}
        width={1000}
        centered
        closable={false}
        styles={{ 
            body: { padding: 0, overflowX: 'hidden', background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)' },
            mask: { backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.1)' }
        }}
      >
        <div className="flex flex-col">
            <div className="px-8 py-6 border-b border-white/20 bg-white/40 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-black text-slate-900 leading-tight">{selectedEmployeeForDetails?.real_name}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">考勤明细审计报告</p>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"><X size={20}/></button>
            </div>

            <div className="p-8 space-y-8">
                <div className="grid grid-cols-4 gap-4">
                    {[
                        { label: '出勤天数', value: selectedEmployeeForDetails?.attendance_days, unit: '天', color: 'indigo' },
                        { label: '整体出勤率', value: selectedEmployeeForDetails?.attendance_rate, unit: '%', color: 'emerald' },
                        { label: '迟到次数', value: selectedEmployeeForDetails?.late_count, unit: '次', color: 'rose' },
                        { label: '工作总时长', value: selectedEmployeeForDetails?.total_work_hours, unit: 'h', color: 'blue' }
                    ].map((item, i) => (
                        <div key={i} className="bg-white/50 border border-white p-4 rounded-xl shadow-sm">
                            <div className="text-[9px] font-black text-slate-400 uppercase mb-1">{item.label}</div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-black text-slate-800 leading-none">{item.value || 0}</span>
                                <span className="text-[9px] font-bold text-slate-400">{item.unit}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-white/50 border border-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/40 bg-white/20">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">全周期打卡流水</span>
                    </div>
                    <Table
                        dataSource={employeeDetails}
                        loading={detailsLoading}
                        rowKey={(r, i) => i}
                        size="small"
                        pagination={{ pageSize: 10, size: 'small' }}
                        columns={[
                            { title: '日期', dataIndex: 'record_date', render: v => <span className="text-xs font-black text-slate-700">{formatDate(v)}</span> },
                            { title: '班次', dataIndex: 'shift_name', render: v => <Tag className="m-0 border-none bg-blue-50 text-blue-600 font-black text-[10px] rounded-md">{v || '未排班'}</Tag> },
                            { title: '上班', dataIndex: 'clock_in_time', render: v => <span className="text-[11px] font-bold text-slate-500">{v ? formatDateTime(v).split(' ')[1] : '--:--'}</span> },
                            { title: '下班', dataIndex: 'clock_out_time', render: v => <span className="text-[11px] font-bold text-slate-500">{v ? formatDateTime(v).split(' ')[1] : '--:--'}</span> },
                            { title: '工时', dataIndex: 'work_hours', render: v => <span className="text-xs font-black text-slate-800">{v ? `${v}h` : '0h'}</span> },
                            { 
                                title: '状态', 
                                dataIndex: 'status', 
                                render: v => {
                                    const map = { normal: '正常', late: '迟到', early: '早退', early_leave: '早退', leave: '请假', rest: '休息', absent: '缺勤' };
                                    const colors = { normal: 'green', late: 'red', early: 'orange', early_leave: 'orange', leave: 'purple', rest: 'blue', absent: 'default' };
                                    return <Tag color={colors[v]} className="m-0 border-none font-black text-[10px] px-2 rounded-md uppercase">{map[v] || v}</Tag>;
                                }
                            }
                        ]}
                    />
                </div>
            </div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  )
}
