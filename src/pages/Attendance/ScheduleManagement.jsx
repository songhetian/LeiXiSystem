import React, { useState, useEffect, useMemo, useCallback } from 'react'
import api from '../../api'
import { Table, Tag, Space, Card, Typography, Select, DatePicker, Button, ConfigProvider, Tooltip, InputNumber, Modal, Radio, Badge } from 'antd'
import { 
    CalendarOutlined, 
    DownloadOutlined, 
    CloudUploadOutlined,
    ExportOutlined,
    RocketOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    SyncOutlined,
    LeftOutlined,
    RightOutlined
} from '@ant-design/icons'
import { ArrowRight, ChevronLeft, ChevronRight, Search, Users, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { getApiUrl } from '../../utils/apiConfig'
import { formatDate, formatBeijingDate } from '../../utils/date'

const { Title, Text } = Typography
const { Option } = Select

// --- 增强型排班单元格 (旗舰版) ---
const ScheduleCell = React.memo(({ day, employee, schedule, conflict, onClick }) => {
  const isConflict = conflict && schedule && !schedule.is_rest_day;
  const isRest = schedule?.is_rest_day || schedule?.shift_name === '0' || schedule?.shift_name === '休息' || !schedule?.shift_name;
  
  const getShiftColor = (color) => {
    if (!color || isRest) return 'transparent';
    return `${color}22`; // 极其细腻的 12% 透明度
  };

  return (
    <td
      onClick={() => onClick(employee, day)}
      className={`px-0.5 py-2 text-center border-r cursor-pointer relative transition-all group ${
        isConflict ? 'bg-amber-100 ring-1 ring-inset ring-amber-500 z-10' : 'hover:bg-slate-50'
      }`}
      style={{ backgroundColor: schedule && !isConflict ? getShiftColor(schedule.color) : '' }}
    >
      <div className="flex flex-col items-center justify-center min-h-[28px]">
        <span className={`text-[10px] font-black ${
            isConflict ? 'text-amber-700' : 
            isRest ? 'text-slate-300 font-bold' : 'text-slate-800'
        }`}>
          {schedule ? (isRest ? '休' : schedule.shift_name) : '-'}
        </span>
        {isConflict && (
          <span className="text-[7px] bg-amber-500 text-white px-1 rounded mt-0.5 font-black scale-90">冲突</span>
        )}
      </div>
      {isRest && schedule && (
        <div className="absolute top-1 right-1 w-1 h-1 bg-slate-200 rounded-full"></div>
      )}
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
  const [selectedMonth, setSelectedMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  })

  // --- 数据索引 ---
  const scheduleMap = useMemo(() => {
    const map = new Map();
    schedules.forEach(s => {
      const dateStr = typeof s.schedule_date === 'string' ? s.schedule_date.split('T')[0] : '';
      map.set(`${s.employee_id}_${dateStr}`, s);
    });
    return map;
  }, [schedules]);

  const conflictMap = useMemo(() => {
    const map = new Map();
    leaves.forEach(l => {
      if (l.status !== 'approved') return;
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        map.set(`${l.employee_id}_${d.toISOString().split('T')[0]}`, l);
      }
    });
    return map;
  }, [leaves]);

  const getDaysInMonth = () => new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
  const getWeekday = (date) => ['日','一','二','三','四','五','六'][date.getDay()];

  useEffect(() => { fetchDepartments(); fetchShifts(); }, [])
  useEffect(() => {
    if (selectedDepartment) {
      fetchShifts(); fetchEmployees(); fetchSchedules();
    }
  }, [selectedDepartment, selectedMonth])

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/api/departments/list');
      if (response.data.success) {
        const activeDepts = response.data.data.filter(d => d.status === 'active');
        setDepartments(activeDepts);
        if (activeDepts.length > 0) setSelectedDepartment(activeDepts[0].id);
      }
    } catch (e) { toast.error('读取部门失败'); }
  };

  const fetchShifts = async () => {
    try {
      const res = await api.get('/api/shifts', {
        params: { is_active: 1, limit: 100 }
      });
      if (res.data.success) setShifts(res.data.data);
    } catch (e) {}
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/api/employees', {
        params: { department_id: selectedDepartment }
      });
      if (res.data) {
        // 后端可能直接返回数组，也可能包装在 data 中
        const list = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setEmployees(list.filter(e => e.status === 'active'));
      }
    } catch (e) {}
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const startDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedMonth.year, selectedMonth.month, 0).getDate();
      const endDate = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [sRes, lRes] = await Promise.all([
        api.get('/api/schedules', { 
          params: { department_id: selectedDepartment, start_date: startDate, end_date: endDate }
        }),
        api.get('/api/attendance/leave/records', {
          params: { department_id: selectedDepartment, start_date: startDate, end_date: endDate, status: 'approved' }
        })
      ]);

      if (sRes.data.success) setSchedules(sRes.data.data);
      if (lRes.data.success) setLeaves(lRes.data.data);
    } catch (e) { toast.error('排班加载失败'); }
    finally { setLoading(false); }
  };

  // --- 模态框逻辑 ---
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCellClick = (employee, day) => {
    const dateStr = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existing = scheduleMap.get(`${employee.id}_${dateStr}`);
    const conflict = conflictMap.get(`${employee.id}_${dateStr}`);
    setModalData({ employee, day, dateStr, existing, conflict, shiftId: existing?.shift_id || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
        const { employee, dateStr, existing, shiftId } = modalData;
        const payload = {
            employee_id: employee.id,
            shift_id: shiftId || null,
            schedule_date: dateStr,
            is_rest_day: !shiftId
        };
        if (existing) {
          await api.put(`/api/schedules/${existing.id}`, payload);
        } else {
          await api.post('/api/schedules', payload);
        }
        toast.success('排班更新成功');
        fetchSchedules();
        setShowModal(false);
    } catch (e) { toast.error('操作失败'); }
    finally { setSubmitting(false); }
  };

  const daysInMonth = getDaysInMonth();

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 38, colorBorder: '#cbd5e1' },
        components: { 
            Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900 }
        }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 font-black text-left">
      
      {/* 1. 物理缝合控制台 */}
      <div className="flex flex-wrap items-center gap-3 w-full">
          <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[38px]">
            <div className="px-4 h-full border-r border-slate-100 flex items-center gap-2 bg-slate-50">
                <Users size={14} className="text-slate-400" />
                <span className="text-[11px] font-black text-slate-600 uppercase">调度部门</span>
            </div>
            <Select 
                value={selectedDepartment} 
                onChange={setSelectedDepartment}
                className="w-48 !border-none flagship-select h-full"
                bordered={false}
                options={departments.map(d => ({ label: d.name, value: d.id }))}
            />
          </div>

          <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[38px]">
            <button onClick={() => setSelectedMonth(prev => prev.month === 1 ? {year:prev.year-1, month:12} : {year:prev.year, month:prev.month-1})} className="px-3 h-full border-r border-slate-100 hover:bg-slate-50 transition-all text-slate-400 hover:text-indigo-600"><ChevronLeft size={16}/></button>
            <DatePicker 
                picker="month" 
                variant="borderless"
                className="font-black text-slate-800 text-xs text-center min-w-[120px] h-full hover:bg-slate-50 transition-all cursor-pointer"
                allowClear={false}
                suffixIcon={null}
                value={dayjs(`${selectedMonth.year}-${selectedMonth.month}-01`)}
                onChange={(date) => {
                    if (date) {
                        setSelectedMonth({ year: date.year(), month: date.month() + 1 });
                    }
                }}
                format="YYYY年 MM月"
            />
            <button onClick={() => setSelectedMonth(prev => prev.month === 12 ? {year:prev.year+1, month:1} : {year:prev.year, month:prev.month+1})} className="px-3 h-full border-l border-slate-100 hover:bg-slate-50 transition-all text-slate-400 hover:text-indigo-600"><ChevronRight size={16}/></button>
          </div>

          <div className="flex gap-2 ml-auto">
            <Button icon={<CloudUploadOutlined />} className="h-[38px] font-black border-slate-200 rounded-lg text-xs">导入</Button>
            <Button icon={<ExportOutlined />} className="h-[38px] font-black border-slate-200 rounded-lg text-xs">导出</Button>
            <Button type="primary" icon={<RocketOutlined />} className="h-[38px] px-6 bg-indigo-600 font-black border-none rounded-lg text-xs shadow-md active:scale-95">批量排班</Button>
          </div>
      </div>

      {/* 2. 排班核心网格 */}
      <Card className="rounded-xl border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse border-spacing-0">
                <thead>
                    <tr className="bg-slate-50/50">
                        <th className="sticky left-0 z-20 bg-slate-50 px-4 py-3 text-center border-r border-slate-200 min-w-[100px] shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">成员姓名</span>
                        </th>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const date = new Date(selectedMonth.year, selectedMonth.month - 1, day);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            return (
                                <th key={day} className={`px-0.5 py-2 text-center border-r border-slate-100 min-w-[40px] ${isWeekend ? 'bg-rose-50/30' : ''}`}>
                                    <div className="flex flex-col">
                                        <span className={`text-[8px] font-black uppercase ${isWeekend ? 'text-rose-400' : 'text-slate-300'}`}>{getWeekday(date)}</span>
                                        <span className={`text-[12px] font-black ${isWeekend ? 'text-rose-500' : 'text-slate-700'}`}>{day}</span>
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {employees.map(emp => (
                        <tr key={emp.id} className="hover:bg-slate-50/20 transition-colors">
                            <td className="sticky left-0 z-10 bg-white px-4 py-3 text-center font-black border-r border-slate-200 text-slate-800 text-xs shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                {emp.real_name}
                            </td>
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                                <ScheduleCell 
                                    key={day}
                                    day={day}
                                    employee={emp}
                                    schedule={scheduleMap.get(`${emp.id}_${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
                                    conflict={conflictMap.get(`${emp.id}_${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
                                    onClick={handleCellClick}
                                />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </Card>

      {/* 3. 编辑模态框 */}
      <Modal
        title={<span className="font-black">单日排班调整</span>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={[
            <Button key="cancel" onClick={() => setShowModal(false)} className="font-black h-11 px-8">取消</Button>,
            <Button key="save" type="primary" onClick={handleSave} loading={submitting} className="font-black h-11 px-10 bg-slate-900 border-none">确认应用</Button>
        ]}
        width={450}
        centered
      >
        {modalData && (
            <div className="space-y-6 py-4">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">调整成员</span>
                        <Tag color="blue" className="font-black border-none">{modalData.employee.real_name}</Tag>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">日期标识</span>
                        <span className="text-sm font-black text-slate-900">{modalData.dateStr}</span>
                    </div>
                </div>

                {modalData.conflict && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                        <ShieldAlert className="text-rose-600 shrink-0" size={20} />
                        <div className="text-xs font-black text-rose-700">
                            排班冲突：该成员在此期间已有已审批的 [{modalData.conflict.leave_type}]。
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">物理班次指派</label>
                    <Select 
                        value={modalData.shiftId} 
                        onChange={val => setModalData({...modalData, shiftId: val})}
                        className="w-full font-black flagship-select h-[44px]"
                        placeholder="选择班次 (留空视为休息)"
                        allowClear
                    >
                        {shifts.map(s => <Option key={s.id} value={s.id}>{s.name} ({s.start_time}-{s.end_time})</Option>)}
                    </Select>
                </div>
            </div>
        )}
      </Modal>
    </div>
    </ConfigProvider>
  )
}
