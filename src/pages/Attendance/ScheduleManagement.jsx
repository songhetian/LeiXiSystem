import React, { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../../api'
import { Table, Tag, Space, Card, Typography, Select, DatePicker, Button, ConfigProvider, Tooltip, InputNumber, Modal, Radio, Badge, Avatar, Spin, Checkbox, Progress } from 'antd'
import { 
    CalendarOutlined, 
    CloudUploadOutlined,
    ExportOutlined,
    RocketOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    SyncOutlined,
    LeftOutlined,
    RightOutlined,
    UserOutlined,
    StopOutlined,
    PieChartOutlined,
    FileDoneOutlined,
    FileExcelOutlined
} from '@ant-design/icons'
import { ArrowRight, ChevronLeft, ChevronRight, Search, Users, ShieldAlert, Download, RefreshCcw, Info, MousePointer2, Paintbrush, Trash2, XCircle, BarChart3, ShieldCheck, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { getApiUrl } from '../../utils/apiConfig'
import logger from '@/utils/logger';

const { Option } = Select

// --- 极致高密度排班单元格 ---
const ScheduleCell = React.memo(({ day, employee, schedule, conflict, activeStamp, onCellClick }) => {
  const isConflict = conflict && schedule && !schedule.is_rest_day;
  const shiftColor = schedule?.color || '#ffffff';

  return (
    <td
      onClick={() => onCellClick(employee, day)}
      className={`px-0.5 py-1 text-center border-r border-slate-200 cursor-pointer relative transition-all group ${
        isConflict ? 'bg-amber-50 ring-1 ring-inset ring-amber-400 z-10' : 'hover:bg-indigo-50'
      }`}
      style={{ 
        backgroundColor: schedule && !isConflict ? shiftColor : '',
        cursor: activeStamp ? 'crosshair' : 'pointer'
      }}
    >
      <div className="flex flex-col items-center justify-center min-h-[32px]">
        <span className="text-[10px] font-black text-black leading-none">
          {schedule ? (schedule.is_rest_day ? '休' : schedule.shift_name) : '-'}
        </span>
        {isConflict && (
          <span className="text-[7px] bg-red-600 text-white px-1 rounded font-black scale-75 mt-0.5">冲突</span>
        )}
      </div>
    </td>
  );
});

export default function ScheduleManagement() {
  const [schedules, setSchedules] = useState([])
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(dayjs())
  const [activeStamp, setActiveStamp] = useState(null)

  // 统计与覆盖率弹窗状态
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [auditSelectedShifts, setAuditSelectedShifts] = useState([])
  const [statsViewTab, setStatsViewTab] = useState('member') // 'member' or 'shift'
  const [statsDateRange, setStatsDateRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')])

  // 当主页月份切换时，同步更新统计弹窗的默认范围
  useEffect(() => {
    if (selectedMonth) {
      setStatsDateRange([selectedMonth.startOf('month'), selectedMonth.endOf('month')]);
    }
  }, [selectedMonth]);

  const scheduleMap = useMemo(() => {
    const map = new Map();
    schedules.forEach(s => {
      const dateStr = dayjs(s.schedule_date).format('YYYY-MM-DD');
      map.set(`${s.employee_id}_${dateStr}`, s);
    });
    return map;
  }, [schedules]);

  const conflictMap = useMemo(() => {
    const map = new Map();
    leaves.forEach(l => {
      if (l.status !== 'approved' || !l.start_date || !l.end_date) return;
      try {
        const start = dayjs(l.start_date);
        const end = dayjs(l.end_date);
        if (!start.isValid() || !end.isValid()) return;
        for (let d = start; d.isBefore(end) || d.isSame(end, 'day'); d = d.add(1, 'day')) {
          map.set(`${l.employee_id}_${d.format('YYYY-MM-DD')}`, l);
        }
      } catch (e) {}
    });
    return map;
  }, [leaves]);

  useEffect(() => { 
    const init = async () => {
        await fetchDepartments(); 
    }
    init();
  }, [])

  useEffect(() => {
    if (selectedDepartment) {
      fetchShifts();
      fetchEmployees(); 
      fetchSchedules();
    }
  }, [selectedDepartment, selectedMonth])

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/departments');
      const list = Array.isArray(response.data) ? response.data : (response.data.data || []);
      const activeDepts = list.filter(d => d.status === 'active');
      setDepartments(activeDepts);
      if (activeDepts.length > 0 && !selectedDepartment) setSelectedDepartment(activeDepts[0].id);
    } catch (e) { toast.error('读取部门失败'); }
  };

  const fetchShifts = async () => {
    try {
      // 同时获取本部门班次和全公司通用班次
      const res = await api.get('/shifts', { params: { is_active: 1, limit: 100, department_id: selectedDepartment, include_global: 1 } });
      if (res.data.success) {
        setShifts(res.data.data);
        // 默认全选除“休”以外的班次用于审计
        setAuditSelectedShifts(res.data.data.filter(s => !s.name.includes('休')).map(s => s.id));
      }
    } catch (e) {}
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees', { params: { department_id: selectedDepartment } });
      const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
      setEmployees(list.filter(e => e.status === 'active'));
    } catch (e) {}
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const startDate = selectedMonth.startOf('month').format('YYYY-MM-DD');
      const endDate = selectedMonth.endOf('month').format('YYYY-MM-DD');
      const [sRes, lRes] = await Promise.all([
        api.get('/schedules', { params: { department_id: selectedDepartment, start_date: startDate, end_date: endDate } }),
        api.get('/attendance/leave/records', { params: { department_id: selectedDepartment, start_date: startDate, end_date: endDate, status: 'approved' } })
      ]);
      if (sRes.data.success) setSchedules(sRes.data.data);
      if (lRes.data.success) setLeaves(lRes.data.data);
    } catch (e) { toast.error('排班加载失败'); }
    finally { setLoading(false); }
  };

  const handleExport = () => {
    const url = getApiUrl(`/api/schedules/export?department_id=${selectedDepartment}&month=${selectedMonth.format('YYYY-MM')}`);
    window.open(url, '_blank');
    toast.success('正在准备导出文件...');
  };

  // 统计计算逻辑
  const employeeStats = useMemo(() => {
    if (!statsDateRange || !statsDateRange[0] || !statsDateRange[1]) return [];
    
    const stats = [];
    const start = statsDateRange[0];
    const end = statsDateRange[1];
    const days = end.diff(start, 'day') + 1;
    
    employees.forEach(emp => {
      let restDays = 0;
      let workDays = 0;
      let leaveDays = 0;
      const shiftCounts = {};

      for (let i = 0; i < days; i++) {
        const dateStr = start.add(i, 'day').format('YYYY-MM-DD');
        const schedule = scheduleMap.get(`${emp.id}_${dateStr}`);
        const leave = conflictMap.get(`${emp.id}_${dateStr}`);

        if (leave) leaveDays++;

        if (schedule) {
          if (schedule.is_rest_day) {
            restDays++;
          } else {
            workDays++;
            shiftCounts[schedule.shift_name] = (shiftCounts[schedule.shift_name] || 0) + 1;
          }
        }
      }

      stats.push({
        id: emp.id,
        name: emp.real_name,
        restDays,
        workDays,
        leaveDays,
        shiftCounts
      });
    });
    return stats;
  }, [employees, scheduleMap, conflictMap, statsDateRange]);

  // 新增：班次维度统计 (增强明细版)
  const shiftStats = useMemo(() => {
    if (!statsDateRange || !statsDateRange[0] || !statsDateRange[1]) return [];
    
    const start = statsDateRange[0];
    const end = statsDateRange[1];
    const days = end.diff(start, 'day') + 1;
    
    const statsMap = {};
    shifts.forEach(s => {
        statsMap[s.id] = {
            id: s.id,
            name: s.name,
            color: s.color,
            startTime: s.start_time,
            endTime: s.end_time,
            details: [], // 存储 { date, employeeName } 的明细
            uniqueEmployees: new Set()
        };
    });

    for (let i = 0; i < days; i++) {
        const currentDate = start.add(i, 'day');
        const dateStr = currentDate.format('YYYY-MM-DD');
        const displayDate = currentDate.format('MM-DD'); // 用于显示的简短日期
        
        employees.forEach(emp => {
            const schedule = scheduleMap.get(`${emp.id}_${dateStr}`);
            if (schedule && !schedule.is_rest_day && statsMap[schedule.shift_id]) {
                statsMap[schedule.shift_id].details.push({
                    date: dateStr,
                    shortDate: displayDate,
                    employeeName: emp.real_name
                });
                statsMap[schedule.shift_id].uniqueEmployees.add(emp.real_name);
            }
        });
    }

    return Object.values(statsMap).map(s => ({
        ...s,
        totalCount: s.details.length,
        employeeCount: s.uniqueEmployees.size
    }));
  }, [shifts, employees, scheduleMap, statsDateRange]);

  // 详情弹窗状态
  const [detailModal, setDetailModal] = useState({ visible: false, data: null });

  // 每日覆盖率审计
  const coverageAudit = useMemo(() => {
    if (!statsDateRange || !statsDateRange[0] || !statsDateRange[1]) return [];
    
    const start = statsDateRange[0];
    const end = statsDateRange[1];
    const days = end.diff(start, 'day') + 1;
    const dailyStatus = [];
    
    for (let i = 0; i < days; i++) {
      const currentDate = start.add(i, 'day');
      const dateStr = currentDate.format('YYYY-MM-DD');
      const dayShifts = schedules.filter(s => dayjs(s.schedule_date).format('YYYY-MM-DD') === dateStr && !s.is_rest_day);
      
      const missingShifts = auditSelectedShifts.filter(sid => {
        return !dayShifts.some(s => s.shift_id === sid);
      }).map(sid => shifts.find(s => s.id === sid)?.name).filter(Boolean);

      dailyStatus.push({
        day: currentDate.date(),
        dateStr,
        isCovered: missingShifts.length === 0,
        missing: missingShifts
      });
    }
    return dailyStatus;
  }, [schedules, auditSelectedShifts, shifts, statsDateRange]);

  const handleCellClick = (employee, day) => {
    if (activeStamp) {
        performSave(employee, day, activeStamp.id, activeStamp.name, activeStamp.color);
    } else {
        const dateStr = selectedMonth.date(day).format('YYYY-MM-DD');
        const existing = scheduleMap.get(`${employee.id}_${dateStr}`);
        const conflict = conflictMap.get(`${employee.id}_${dateStr}`);
        setModalData({ employee, day, dateStr, existing, conflict, shiftId: existing?.shift_id || '' });
        setShowModal(true);
    }
  };

  const performSave = async (employee, day, shiftId, shiftName, color) => {
    const dateStr = selectedMonth.date(day).format('YYYY-MM-DD');
    const existing = scheduleMap.get(`${employee.id}_${dateStr}`);
    if (existing && existing.shift_id === shiftId) return;

    try {
        const payload = {
            employee_id: employee.id,
            shift_id: shiftId || null,
            schedule_date: dateStr,
            is_rest_day: (shiftName?.includes('休') || !shiftId) ? 1 : 0
        };

        const localUpdate = {
            id: existing?.id || Math.random(),
            employee_id: employee.id,
            schedule_date: dateStr,
            shift_id: shiftId,
            shift_name: shiftName || '-',
            color: color || '#ffffff',
            is_rest_day: payload.is_rest_day
        };

        setSchedules(prev => {
            const filtered = prev.filter(s => !(s.employee_id === employee.id && dayjs(s.schedule_date).format('YYYY-MM-DD') === dateStr));
            return [...filtered, localUpdate];
        });

        if (existing) await api.put(`/schedules/${existing.id}`, payload);
        else await api.post('/schedules', payload);
    } catch (e) { fetchSchedules(); }
  };

  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleManualSave = async () => {
    setSubmitting(true);
    try {
        const { employee, day, shiftId } = modalData;
        const selectedShift = shifts.find(s => s.id === shiftId);
        await performSave(employee, day, shiftId, selectedShift?.name, selectedShift?.color);
        toast.success('排班已更新');
        setShowModal(false);
    } catch (e) { toast.error('保存失败'); }
    finally { setSubmitting(false); }
  };

  const handleRemoveSchedule = async () => {
    if (!modalData?.existing) return;
    setSubmitting(true);
    try {
        await api.delete(`/schedules/${modalData.existing.id}`);
        setSchedules(prev => prev.filter(s => s.id !== modalData.existing.id));
        toast.success('排班已移除');
        setShowModal(false);
    } catch (e) { toast.error('移除失败'); }
    finally { setSubmitting(false); }
  };

  const daysInMonth = selectedMonth.daysInMonth();
  const getWeekday = (date) => ['日','一','二','三','四','五','六'][date.day()];

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 32, colorBorder: '#e2e8f0', fontSize: 12 }
    }}>
    <div className="space-y-3 text-left">
      <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 px-2">
            <Users size={14} className="text-slate-400" />
            <Select value={selectedDepartment} onChange={setSelectedDepartment} className="w-40 flagship-clean-select" variant="borderless" options={departments.map(d => ({ label: d.name, value: d.id }))} />
          </div>
          <div className="w-px h-4 bg-slate-200"></div>
          <div className="flex items-center gap-2 px-2">
            <CalendarOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
            <DatePicker picker="month" variant="borderless" className="font-bold text-slate-700 text-xs w-28 cursor-pointer p-0" allowClear={false} value={selectedMonth} onChange={(val) => val && setSelectedMonth(val)} format="YYYY年 MM月" suffixIcon={null} />
          </div>
          <div className="flex gap-2 ml-auto">
            <Button size="small" icon={<RefreshCcw size={12}/>} onClick={fetchSchedules} className="h-8 px-3 font-bold border-slate-200 rounded-lg text-[11px] text-slate-600">刷新</Button>
            <Button size="small" icon={<Download size={12}/>} onClick={handleExport} className="h-8 px-3 font-bold border-slate-200 rounded-lg text-[11px] text-slate-600">导出</Button>
            <Button type="primary" size="small" icon={<BarChart3 size={14} />} onClick={() => setShowStatsModal(true)} className="h-8 px-4 bg-indigo-600 font-bold border-none rounded-lg text-[11px] shadow-sm">查看排班统计</Button>
          </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 bg-slate-50 rounded-xl border border-slate-200/60">
          <div className="flex items-center gap-2 px-2 border-r border-slate-200 mr-1">
              <Paintbrush size={14} className={activeStamp ? "text-indigo-600 animate-pulse" : "text-slate-400"} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${activeStamp ? "text-indigo-600" : "text-slate-400"}`}>极速印章:</span>
          </div>
          {shifts.map(s => (
              <button key={s.id} onClick={() => setActiveStamp(activeStamp?.id === s.id ? null : s)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border-2 ${activeStamp?.id === s.id ? 'border-indigo-600 bg-white shadow-md scale-105' : 'border-transparent bg-white/50 hover:bg-white hover:border-slate-300'}`}>
                  <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: s.color }}></div>
                  <span className="text-[11px] font-black text-slate-800">{s.name}</span>
              </button>
          ))}
          {activeStamp && (
              <button onClick={() => setActiveStamp(null)} className="ml-2 flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg hover:bg-rose-100 transition-all text-[10px] font-black"><XCircle size={12} /> 退出印章</button>
          )}
          <div className="ml-auto flex items-center gap-2 px-3">
              {activeStamp ? <span className="text-[10px] font-black text-indigo-500 flex items-center gap-1"><MousePointer2 size={12} /> 正在印章模式：直接点击表格应用 [{activeStamp.name}]</span> : <span className="text-[10px] font-black text-slate-400">点击上方班次开启极速排班</span>}
          </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center"><Spin /><p className="mt-4 text-black font-black text-[11px]">正在同步排班数据...</p></div>
        ) : (
          <div className="overflow-x-auto custom-micro-scrollbar">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-100/80">
                        <th className="sticky left-0 z-20 bg-slate-100 px-4 py-3 text-center border-r border-slate-200 min-w-[100px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">职员姓名</span>
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const date = selectedMonth.date(day);
                            const isWeekend = date.day() === 0 || date.day() === 6;
                            return (
                                <th key={day} className={`px-0.5 py-2 text-center border-r border-slate-200 min-w-[38px] ${isWeekend ? 'bg-rose-50' : ''}`}>
                                    <div className="flex flex-col"><span className={`text-[7px] font-black uppercase ${isWeekend ? 'text-rose-600' : 'text-slate-500'}`}>{getWeekday(date)}</span><span className={`text-[12px] font-black text-black`}>{day}</span></div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-center">
                    {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="sticky left-0 z-10 bg-white px-4 py-2 text-center font-black border-r border-slate-200 text-black text-[11px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{emp.real_name}</td>
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                                <ScheduleCell key={day} day={day} employee={emp} activeStamp={activeStamp} schedule={scheduleMap.get(`${emp.id}_${selectedMonth.date(day).format('YYYY-MM-DD')}`)} conflict={conflictMap.get(`${emp.id}_${selectedMonth.date(day).format('YYYY-MM-DD')}`)} onCellClick={handleCellClick} />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        title={null}
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={null}
        width={400}
        centered
        closable={false}
        styles={{ body: { padding: '24px' } }}
      >
        {modalData && (
            <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-black text-slate-800">精准调度调整</h3>
                    <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={20}/></button>
                </div>

                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-50"><UserOutlined /></div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-slate-900 truncate">{modalData.employee.real_name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{modalData.dateStr}</div>
                    </div>
                </div>

                {modalData.conflict && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3">
                        <ShieldAlert className="text-rose-600" size={16} />
                        <span className="text-[11px] font-bold text-rose-700">冲突：该时段已有已审批的 [{modalData.conflict.leave_type}]</span>
                    </div>
                )}

                <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">重新指派班次模板</p>
                    <Select value={modalData.shiftId} onChange={val => setModalData({...modalData, shiftId: val})} className="w-full flagship-select h-11" placeholder="选择班次 (留空视为公体/休息)" allowClear>
                        {shifts.map(s => (<Option key={s.id} value={s.id}><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div><span>{s.name} ({s.start_time}-{s.end_time})</span></div></Option>))}
                    </Select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                    <Button block danger ghost icon={<Trash2 size={14}/>} onClick={handleRemoveSchedule} disabled={!modalData?.existing} className="rounded-xl h-11 font-black text-xs border-rose-200 hover:bg-rose-50">移除排班</Button>
                    <Button block type="primary" onClick={handleManualSave} loading={submitting} className="rounded-xl h-11 bg-slate-900 border-none font-black text-xs shadow-lg">确认保存</Button>
                </div>
            </div>
        )}
      </Modal>

      {/* 排班统计弹窗 */}
      <Modal
        title={null}
        open={showStatsModal}
        onCancel={() => setShowStatsModal(false)}
        footer={null}
        width={1000}
        centered
        closable={false}
        styles={{ body: { padding: '0' } }}
      >
        <div className="flex flex-col h-[650px] overflow-hidden rounded-2xl bg-white border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div>
                        <h3 className="text-base font-bold text-slate-800">排班数据审计与统计</h3>
                    </div>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-slate-500">统计区间:</span>
                        <DatePicker.RangePicker 
                            size="small"
                            className="flagship-range-picker-flat"
                            value={statsDateRange}
                            onChange={v => setStatsDateRange(v)}
                            allowClear={false}
                            format="YYYY-MM-DD"
                        />
                    </div>
                </div>
                <button onClick={() => setShowStatsModal(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors">
                    <XCircle size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex">
                {/* 左侧：覆盖率审计 - 极简线框风 */}
                <div className="w-[260px] border-r border-slate-100 bg-white flex flex-col h-full">
                    <div className="p-5 space-y-6 overflow-y-auto custom-micro-scrollbar flex-1">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-600 uppercase">1. 覆盖班次定义</span>
                            </div>
                            <Checkbox.Group 
                                className="flex flex-col gap-2 w-full"
                                value={auditSelectedShifts} 
                                onChange={setAuditSelectedShifts}
                            >
                                {shifts.map(s => (
                                    <Checkbox key={s.id} value={s.id} className="m-0 text-[11px] font-medium text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                                            <span>{s.name}</span>
                                        </div>
                                    </Checkbox>
                                ))}
                            </Checkbox.Group>
                        </div>

                        <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold text-slate-600 uppercase">2. 每日合规状况</span>
                                {coverageAudit.filter(d => !d.isCovered).length > 0 ? (
                                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-3">
                                        <AlertCircle size={16} className="text-rose-500" />
                                        <div className="text-[11px] font-bold text-rose-600">缺失 {coverageAudit.filter(d => !d.isCovered).length} 天覆盖</div>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3">
                                        <ShieldCheck size={16} className="text-emerald-500" />
                                        <div className="text-[11px] font-bold text-emerald-600">逻辑审计通过</div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="pt-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">审计明细:</p>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {coverageAudit.map(audit => (
                                        <Tooltip key={audit.day} title={audit.isCovered ? '已覆盖' : `缺失: ${audit.missing.join(', ')}`}>
                                            <div className={`aspect-square rounded border flex items-center justify-center text-[10px] font-bold transition-all ${
                                                audit.isCovered 
                                                ? 'bg-white text-emerald-500 border-slate-100' 
                                                : 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                            }`}>
                                                {audit.day}
                                            </div>
                                        </Tooltip>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 右侧：统计展示核心 - 高对比度政企风格 */}
                <div className="flex-1 p-6 overflow-hidden flex flex-col bg-white">
                    <div className="mb-6 flex items-center justify-between border-b-2 border-slate-100">
                        <div className="flex gap-10">
                            <button 
                                onClick={() => setStatsViewTab('member')}
                                className={`pb-3 text-sm font-bold transition-all relative ${statsViewTab === 'member' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                按成员分布汇总
                                {statsViewTab === 'member' && <div className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-indigo-700 rounded-full"></div>}
                            </button>
                            <button 
                                onClick={() => setStatsViewTab('shift')}
                                className={`pb-3 text-sm font-bold transition-all relative ${statsViewTab === 'shift' ? 'text-indigo-700' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                按班次人力汇总
                                {statsViewTab === 'shift' && <div className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-indigo-700 rounded-full"></div>}
                            </button>
                        </div>
                        <div className="text-[11px] font-bold text-slate-700 flex items-center gap-2 pb-3">
                            数据更新：{dayjs().format('HH:mm:ss')}
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pr-2 custom-micro-scrollbar">
                        {statsViewTab === 'member' ? (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[11px] font-bold text-slate-800 uppercase tracking-wider bg-slate-50 border-y border-slate-200">
                                        <th className="py-2.5 px-3">姓名</th>
                                        <th className="py-2.5 px-3 text-center">区间休 (天)</th>
                                        <th className="py-2.5 px-3 text-center">请假 (天)</th>
                                        <th className="py-2.5 px-3">出勤班次明细</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {employeeStats.map(stat => (
                                        <tr key={stat.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="py-3 px-3">
                                                <span className="text-[13px] font-bold text-slate-900">{stat.name}</span>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className="text-[14px] font-bold text-emerald-700">{stat.restDays}</span>
                                            </td>
                                            <td className="py-3 px-3 text-center">
                                                <span className="text-[14px] font-bold text-amber-700">{stat.leaveDays}</span>
                                            </td>
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {Object.entries(stat.shiftCounts).map(([name, count]) => {
                                                        const shiftInfo = shifts.find(s => s.name === name);
                                                        return (
                                                            <div key={name} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300 shadow-sm">
                                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shiftInfo?.color || '#000' }}></div>
                                                                <span className="text-[11px] font-bold text-slate-800">{name}</span>
                                                                <span className="text-[11px] font-black text-indigo-700 ml-1">{count}</span>
                                                            </div>
                                                        )
                                                    })}
                                                    {stat.workDays === 0 && <span className="text-[11px] text-slate-400 italic">此区间暂无排班</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[11px] font-bold text-slate-800 uppercase tracking-wider bg-slate-50 border-y border-slate-200">
                                        <th className="py-2.5 px-3">班次名称</th>
                                        <th className="py-2.5 px-3 text-center">时间跨度</th>
                                        <th className="py-2.5 px-3 text-center">累计排班 (人次)</th>
                                        <th className="py-2.5 px-3 text-center">涉及总人数</th>
                                        <th className="py-2.5 px-3 text-center">操作</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {shiftStats.map(stat => (
                                        <tr key={stat.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="py-4 px-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: stat.color }}></div>
                                                    <span className="text-[13px] font-bold text-slate-900">{stat.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-3 text-center">
                                                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{stat.startTime} ~ {stat.endTime}</span>
                                            </td>
                                            <td className="py-4 px-3 text-center">
                                                <span className="text-base font-bold text-indigo-700">{stat.totalCount}</span>
                                            </td>
                                            <td className="py-4 px-3 text-center text-slate-700 font-bold">
                                                {stat.employeeCount} 人
                                            </td>
                                            <td className="py-4 px-3 text-center">
                                                <Button size="small" className="text-[11px] font-bold border-slate-300 hover:border-indigo-600 hover:text-indigo-600" onClick={() => setDetailModal({ visible: true, data: stat })}>查看排班明细</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </Modal>

      {/* 班次深度明细弹窗 - 解决显示器模糊问题 */}
      <Modal
        title={<div className="flex items-center gap-3 border-b border-slate-100 pb-4"><div className="w-2 h-5 bg-indigo-600 rounded-full"></div><span className="font-bold text-slate-800">班次排班执行明细: {detailModal.data?.name}</span></div>}
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, data: null })}
        footer={null}
        width={500}
        centered
        className="flatship-detail-modal"
      >
        <div className="max-h-[450px] overflow-y-auto pr-2 custom-micro-scrollbar">
            <table className="w-full">
                <thead>
                    <tr className="text-[11px] font-bold text-slate-500 text-left border-b border-slate-100">
                        <th className="py-2 px-2">执行日期</th>
                        <th className="py-2 px-2">排班成员</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {detailModal.data?.details.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-2 text-[12px] font-bold text-slate-700">{d.date}</td>
                            <td className="py-2.5 px-2">
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[12px] font-bold border border-indigo-100">{d.employeeName}</span>
                            </td>
                        </tr>
                    ))}
                    {(!detailModal.data?.details || detailModal.data.details.length === 0) && (
                        <tr><td colSpan="2" className="py-10 text-center text-slate-400 italic">此区间暂无人力部署记录</td></tr>
                    )}
                </tbody>
            </table>
        </div>
      </Modal>
    </div>
    <style dangerouslySetInnerHTML={{ __html: `
        .custom-micro-scrollbar::-webkit-scrollbar { height: 2px; width: 4px; }
        .custom-micro-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-micro-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-micro-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); }
        .flagship-clean-select .ant-select-selection-item { font-weight: 900 !important; color: black !important; }
        .ant-modal-content { border-radius: 32px !important; padding: 0 !important; overflow: hidden; }
        .flagship-checkbox .ant-checkbox-inner { border-radius: 6px; border-color: #e2e8f0; }
        .flagship-checkbox .ant-checkbox-checked .ant-checkbox-inner { background-color: #4f46e5; border-color: #4f46e5; }
        .flagship-range-picker { border-radius: 10px !important; border: 1px solid #f1f5f9 !important; background: #f8fafc !important; }
        .flagship-range-picker:hover { border-color: #4f46e5 !important; background: white !important; }
        .flagship-range-picker .ant-picker-input > input { font-weight: 900 !important; font-size: 11px !important; color: #1e293b !important; }
    `}} />
    </ConfigProvider>
  )
}
