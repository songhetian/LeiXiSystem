'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Table,
  Button,
  Select,
  Modal,
  Tag,
  DatePicker,
  Spin,
  Message,
  Space,
  Input,
  Switch,
  Typography,
  type TableColumnProps,
} from '@arco-design/web-react';
import { IconLeft, IconRight, IconRefresh, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import { useThrottle } from '@/hooks/use-throttle';
import EmployeeSelect from '@/components/EmployeeSelect';
import {
  attendanceApi,
  type Schedule,
  type Shift,
  type LeaveRecord,
  type ScheduleCreateDto,
} from '@/services/attendance';
import { employeeApi, type Employee } from '@/services/employee';
import { systemApi, type SysDepartment } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import * as XLSX from 'xlsx';

const { Text } = Typography;

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 默认班次底色（当 shift.color 缺失时使用） */
const DEFAULT_SHIFT_COLOR = 'rgba(22, 93, 255, 0.15)';

/** 印章值：数字 = 班次 ID，'clear' = 清除排班 */
type StampValue = number | 'clear';

/** 弹窗来源 */
type ModalSource = 'cell' | 'header' | 'create';

interface CellModalState {
  visible: boolean;
  source: ModalSource;
  /** 'cell' 来源下固定的员工 */
  employeeId?: number;
  employeeName?: string;
  workDate: string;
  shiftId?: number;
  /** 是否已存在排班（用于显示“删除”按钮） */
  existingId?: number | null;
}

// ============ 工具函数 ============

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDate(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function getDaysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 将任意的日期值归一化为 `YYYY-MM-DD`。
 * 后端 workDate 返回的是完整 datetime 字符串（如 `2026-08-21T00:00:00.000Z`），
 * 与日历单元格的 `YYYY-MM-DD` 键不一致会导致排班无法匹配显示，此处统一归一化。
 */
function dateOnly(s?: string): string {
  if (!s) return '';
  if (DATE_RE.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 根据底色计算可读的文字颜色 */
function getContrastColor(hex?: string): string {
  if (!hex) return '#1d2129';
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }
  if (c.length !== 6) return '#1d2129';
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return '#1d2129';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? '#1d2129' : '#ffffff';
}

/** 截取班次简称（最多 2 个字符） */
function shortShiftName(name: string): string {
  if (!name) return '-';
  return name.length > 2 ? name.slice(0, 2) : name;
}

export default function ScheduleCalendarPage() {
  const { can } = usePermission();
  const canManage = can('attendance:manage');

  // 月份视图（year + month0）
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // 基础数据
  const [departments, setDepartments] = useState<SysDepartment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(undefined);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  // 印章模式
  const [stampMode, setStampMode] = useState(false);
  const [stampValue, setStampValue] = useState<StampValue | undefined>(undefined);

  // 弹窗
  const [modal, setModal] = useState<CellModalState>({
    visible: false,
    source: 'cell',
    workDate: '',
  });
  const [modalLoading, setModalLoading] = useState(false);

  // 表体横向滚动控制（用于固定底部长条，避免要滚到表格底部才能切换日期）
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [hScroll, setHScroll] = useState({ scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  // ============ 派生数据 ============

  const daysInMonth = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthStart = useMemo(() => formatDate(viewYear, viewMonth, 1), [viewYear, viewMonth]);
  const monthEnd = useMemo(
    () => formatDate(viewYear, viewMonth, daysInMonth),
    [viewYear, viewMonth, daysInMonth],
  );

  const shiftById = useMemo(() => {
    const m = new Map<number, Shift>();
    shifts.forEach((s) => m.set(s.id, s));
    return m;
  }, [shifts]);

  /** key = `${employeeId}_${workDate}` */
  const scheduleMap = useMemo(() => {
    const m = new Map<string, Schedule>();
    schedules.forEach((s) => {
      if (!s || !s.workDate) return;
      // 班次ID优先从班次列表回填，确保排班块获得完整班次信息（含颜色）。
      // 列表接口内嵌的 shift 关系可能缺少 color，若存在则以列表匹配为准。
      const shift = shiftById.get(s.shiftId) ?? s.shift;
      m.set(`${s.employeeId}_${dateOnly(s.workDate)}`, shift ? { ...s, shift } : s);
    });
    return m;
  }, [schedules, shiftById]);

  /** key = `${employeeId}_${dateStr}`，仅包含已审批通过的请假 */
  const leaveMap = useMemo(() => {
    const m = new Map<string, LeaveRecord>();
    leaves.forEach((l) => {
      if (l.status !== 'approved' || !l.startDate || !l.endDate) return;
      const start = parseDate(l.startDate);
      const end = parseDate(l.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
      const cursor = new Date(start);
      while (cursor.getTime() <= end.getTime()) {
        m.set(
          `${l.employeeId}_${formatDate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())}`,
          l,
        );
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return m;
  }, [leaves]);

  /** 按部门本地过滤后的在职员工 */
  const deptEmployees = useMemo(() => {
    const active = employees.filter((e) => e.status === 'active');
    if (selectedDeptId === undefined) return active;
    return active.filter((e) => e.departmentId === selectedDeptId);
  }, [employees, selectedDeptId]);

  const filteredEmployees = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return deptEmployees;
    return deptEmployees.filter(
      (e) => e.name.toLowerCase().includes(kw) || e.employeeNo.toLowerCase().includes(kw),
    );
  }, [deptEmployees, keyword]);

  // ============ 数据加载 ============

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await systemApi.listDepartments();
      if (res.code === 0 && res.data) {
        setDepartments(res.data);
      }
    } catch {
      // 忽略部门加载失败
    }
  }, []);

  const fetchShifts = useCallback(async () => {
    try {
      const res = await attendanceApi.getShiftList();
      if (res.code === 0 && res.data) {
        setShifts(res.data.list);
      }
    } catch {
      // 忽略班次加载失败
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      // 后端 /employees 接口未支持 departmentId 筛选，统一拉取后在本地按部门过滤
      const res = await employeeApi.getList({ pageSize: 500 });
      if (res.code === 0 && res.data) {
        setEmployees(res.data.list);
      } else {
        setEmployees([]);
      }
    } catch {
      setEmployees([]);
    }
  }, []);

  const fetchSchedulesAndLeaves = useCallback(
    async (start: string, end: string) => {
      setLoading(true);
      try {
        const [schedRes, leaveRes] = await Promise.all([
          attendanceApi.getScheduleList({ startDate: start, endDate: end, pageSize: 2000 }),
          attendanceApi.getLeaveList({
            startDate: start,
            endDate: end,
            status: 'approved',
            pageSize: 2000,
          }),
        ]);
        if (schedRes.code === 0 && schedRes.data) {
          setSchedules(schedRes.data.list);
        } else {
          setSchedules([]);
        }
        if (leaveRes.code === 0 && leaveRes.data) {
          setLeaves(leaveRes.data.list);
        } else {
          setLeaves([]);
        }
      } catch {
        Message.error('排班数据加载失败');
        setSchedules([]);
        setLeaves([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 首次加载：部门 + 班次 + 全部在职员工
  useEffect(() => {
    fetchDepartments();
    fetchShifts();
    fetchEmployees();
  }, [fetchDepartments, fetchShifts, fetchEmployees]);

  // 部门加载完成后默认选中第一个（仅初始化一次，允许用户清空以查看全部）
  const didInitDeptRef = useRef(false);
  useEffect(() => {
    if (!didInitDeptRef.current && departments.length > 0) {
      didInitDeptRef.current = true;
      setSelectedDeptId(departments[0].id);
    }
  }, [departments]);

  // 月份变化 → 重新拉取排班与请假
  useEffect(() => {
    fetchSchedulesAndLeaves(monthStart, monthEnd);
  }, [monthStart, monthEnd, fetchSchedulesAndLeaves]);

  const refetch = useCallback(() => {
    fetchSchedulesAndLeaves(monthStart, monthEnd);
  }, [fetchSchedulesAndLeaves, monthStart, monthEnd]);

  /** 导出当月排班明细到 Excel */
  const handleExport = useCallback(() => {
    const empById = new Map<number, Employee>();
    employees.forEach((e) => empById.set(e.id, e));
    const rows = schedules.map((s) => {
      const emp = empById.get(s.employeeId) ?? s.employee;
      const shift = shiftById.get(s.shiftId) ?? s.shift;
      return { emp, shift, workDate: dateOnly(s.workDate) };
    });
    if (!exportToExcel(
      `排班_${viewYear}年${viewMonth + 1}月.xlsx`,
      '排班',
      [
        { title: '工号', value: (r) => r.emp?.employeeNo ?? '' },
        { title: '姓名', value: (r) => r.emp?.name ?? '' },
        { title: '日期', dataIndex: 'workDate' },
        { title: '班次', value: (r) => r.shift?.name ?? '' },
        { title: '班次时间', value: (r) => (r.shift ? `${r.shift.startTime}-${r.shift.endTime}${r.shift.isNextDay ? ' 次日' : ''}` : '') },
        { title: '颜色', value: (r) => r.shift?.color ?? '' },
      ],
      rows,
    )) {
      Message.info('当月暂无排班数据');
    }
  }, [schedules, employees, shiftById]);

  /** 触发文件选择框 */
  const handleImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  /** 导出排班导入模板 */
  const handleDownloadImportTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['工号', '姓名', '日期', '班次'],
      ['E001', '张三', '2026-08-01', '早班'],
      ['E002', '李四', '2026-08-01', '晚班'],
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '排班导入');
    XLSX.writeFile(wb, '排班导入模板.xlsx');
  }, []);

  /** 解析排班导入 Excel 并批量写入 */
  const handleImportFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

        const empByNo = new Map<string, Employee>();
        const empByName = new Map<string, Employee>();
        employees.forEach((e) => {
          if (e.employeeNo) empByNo.set(String(e.employeeNo).toLowerCase(), e);
          if (e.name) empByName.set(e.name.trim(), e);
        });
        const shiftByName = new Map<string, Shift>();
        shifts.forEach((s) => shiftByName.set(s.name.trim(), s));

        const items: ScheduleCreateDto[] = [];
        const errors: string[] = [];
        rows.forEach((row, idx) => {
          const no = String(row['工号'] ?? row['employeeNo'] ?? row['员工工号'] ?? '').trim();
          const name = String(row['姓名'] ?? row['name'] ?? '').trim();
          const date = String(row['日期'] ?? row['date'] ?? row['workDate'] ?? '').slice(0, 10);
          const shiftName = String(row['班次'] ?? row['shift'] ?? row['shiftName'] ?? '').trim();
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            errors.push(`第 ${idx + 2} 行：日期格式应为 YYYY-MM-DD`);
            return;
          }
          const emp = (no && empByNo.get(no.toLowerCase())) || empByName.get(name);
          if (!emp) {
            errors.push(`第 ${idx + 2} 行：找不到员工（${no || name}）`);
            return;
          }
          const shift = shiftByName.get(shiftName);
          if (!shift) {
            errors.push(`第 ${idx + 2} 行：找不到班次「${shiftName}」`);
            return;
          }
          items.push({ employeeId: emp.id, shiftId: shift.id, workDate: date });
        });

        if (items.length === 0) {
          Message.error('没有可导入的有效数据');
          return;
        }
        const res = await attendanceApi.batchCreateSchedule({ items });
        if (res.code === 0) {
          Message.success(`排班导入成功：${res.data?.count ?? items.length} 条`);
        } else {
          Message.error(res.message || '排班导入失败');
        }
        if (errors.length) {
          Message.warning(`忽略 ${errors.length} 条无效数据（示例：${errors[0]}）`);
        }
        await refetch();
      } catch {
        Message.error('导入失败，请检查文件格式');
      } finally {
        setImporting(false);
      }
    },
    [employees, shifts, refetch],
  );

  /**
   * 获取排班大表真正可横向滚动的容器。
   * Arco Table 在设置 scroll.x 后，横向溢出发生在 .arco-table-content-inner 上，
   * .arco-table-body 并不发生横向滚动，需统一从这里取滚动容器。
   */
  const getHScrollEl = useCallback((): HTMLElement | null => {
    const wrap = tableWrapRef.current;
    if (!wrap) return null;
    return (
      wrap.querySelector<HTMLElement>('.arco-table-content-inner') ??
      wrap.querySelector<HTMLElement>('.arco-table-body')
    );
  }, []);

  // 同步表格横向滚动状态
  const syncHScroll = useCallback(() => {
    const el = getHScrollEl();
    if (!el) return;
    setHScroll({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  }, [getHScrollEl]);

  // 节流版：横向滚动时抑制高频 setHScroll（该表在日期较多时单元格数量大）
  const throttledSyncHScroll = useThrottle(syncHScroll, 80);

  useEffect(() => {
    const bind = () => {
      const el = getHScrollEl();
      if (!el) return false;
      const onScroll = () => throttledSyncHScroll();
      el.addEventListener('scroll', onScroll, { passive: true });
      syncHScroll();
      return true;
    };
    // 数据、列数变化后表格可能尚未渲染，延迟绑定以确保拿到滚动容器
    if (!bind()) {
      const t = setTimeout(() => {
        bind();
        const ro = new ResizeObserver(syncHScroll);
        const el = getHScrollEl();
        if (el) ro.observe(el);
      }, 60);
      return () => {
        clearTimeout(t);
      };
    }
    const el = getHScrollEl();
    const ro = new ResizeObserver(syncHScroll);
    if (el) ro.observe(el);
    return () => {
      if (el) ro.disconnect();
    };
  }, [syncHScroll, getHScrollEl, daysInMonth, filteredEmployees.length]);

  /** 固定长条：按比例(0~1)跳转到表格横向位置 */
  const handleHSeek = useCallback(
    (ratio: number) => {
      const el = getHScrollEl();
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      el.scrollLeft = Math.max(0, Math.min(1, ratio)) * max;
    },
    [getHScrollEl],
  );

  // ============ 月份导航 ============

  const goPrevMonth = useCallback(() => {
    setViewMonth((m: number) => {
      if (m === 0) {
        setViewYear((y: number) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setViewMonth((m: number) => {
      if (m === 11) {
        setViewYear((y: number) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  // ============ 排班写入 ============

  /** 印章模式：对单个员工/日期应用印章（新建或更新或清除），采用乐观更新 */
  const applyStamp = useCallback(
    async (employeeId: number, dateStr: string, stamp: StampValue) => {
      const existing = scheduleMap.get(`${employeeId}_${dateStr}`);
      // 无变化直接跳过      if (stamp !== 'clear' && existing && existing.shiftId === stamp) return;
      if (stamp === 'clear' && !existing) return;

      try {
        if (stamp === 'clear') {
          const res = await attendanceApi.deleteSchedule(existing!.id);
          if (res.code !== 0) {
            Message.error(res.message || '清除排班失败');
            return;
          }
          setSchedules((prev) => prev.filter((s) => s.id !== existing!.id));
        } else {
          const dto: ScheduleCreateDto = { employeeId, shiftId: stamp, workDate: dateStr };
          if (existing) {
            const res = await attendanceApi.updateSchedule(existing.id, dto);
            if (res.code !== 0 || !res.data) {
              Message.error(res.message || '排班失败');
              return;
            }
            const shift = shiftById.get(stamp);
            setSchedules((prev) =>
              prev.map((s) => (s.id === existing.id ? { ...res.data!, shift } : s)),
            );
          } else {
            const res = await attendanceApi.createSchedule(dto);
            if (res.code !== 0 || !res.data) {
              Message.error(res.message || '排班失败');
              return;
            }
            const shift = shiftById.get(stamp);
            setSchedules((prev) => [...prev, { ...res.data!, shift }]);
          }
        }
      } catch {
        Message.error('操作失败，已刷新数据');
        refetch();
      }
    },
    [scheduleMap, shiftById, refetch],
  );

  /** 批量操作：对某一天的全部（过滤后）员工应用印章 */
  const batchApplyDate = useCallback(
    async (dateStr: string, stamp: StampValue) => {
      if (filteredEmployees.length === 0) {
        Message.info('当前没有可排班的员工');
        return;
      }
      const itemsToCreate: ScheduleCreateDto[] = [];
      const toUpdate: { id: number; dto: ScheduleCreateDto }[] = [];
      const toDelete: number[] = [];

      filteredEmployees.forEach((emp) => {
        const existing = scheduleMap.get(`${emp.id}_${dateStr}`);
        if (stamp === 'clear') {
          if (existing) toDelete.push(existing.id);
        } else if (existing) {
          if (existing.shiftId !== stamp) {
            toUpdate.push({
              id: existing.id,
              dto: { employeeId: emp.id, shiftId: stamp, workDate: dateStr },
            });
          }
        } else {
          itemsToCreate.push({ employeeId: emp.id, shiftId: stamp, workDate: dateStr });
        }
      });

      const total = itemsToCreate.length + toUpdate.length + toDelete.length;
      if (total === 0) {
        Message.info('无需变更的排班');
        return;
      }

      setBatchLoading(true);
      try {
        const tasks: Promise<{ code: number; message?: string }>[] = [];
        if (itemsToCreate.length > 0) {
          tasks.push(
            attendanceApi
              .batchCreateSchedule({ items: itemsToCreate })
              .then((r) => ({ code: r.code, message: r.message })),
          );
        }
        toUpdate.forEach((u) =>
          tasks.push(
            attendanceApi
              .updateSchedule(u.id, u.dto)
              .then((r) => ({ code: r.code, message: r.message })),
          ),
        );
        toDelete.forEach((id) =>
          tasks.push(
            attendanceApi
              .deleteSchedule(id)
              .then((r) => ({ code: r.code, message: r.message })),
          ),
        );
        const results = await Promise.allSettled(tasks);
        const failed = results.filter(
          (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.code !== 0),
        ).length;
        if (failed > 0) {
          Message.warning(`批量操作完成，其中 ${failed} 项失败`);
        } else if (stamp === 'clear') {
          Message.success(`已清除当天 ${toDelete.length} 条排班`);
        } else {
          Message.success(`已批量排班 ${itemsToCreate.length + toUpdate.length} 人`);
        }
        await refetch();
      } catch {
        Message.error('批量操作失败');
      } finally {
        setBatchLoading(false);
      }
    },
    [filteredEmployees, scheduleMap, refetch],
  );

  // ============ 交互 ============

  const handleCellClick = useCallback(
    (employee: Employee, dateStr: string) => {
      if (!canManage) return;
      if (stampMode) {
        if (stampValue === undefined) {
          Message.info('请先在印章模式下选择班次');
          return;
        }
        applyStamp(employee.id, dateStr, stampValue);
      } else {
        const existing = scheduleMap.get(`${employee.id}_${dateStr}`);
        setModal({
          visible: true,
          source: 'cell',
          employeeId: employee.id,
          employeeName: `${employee.name}（${employee.employeeNo}）`,
          workDate: dateStr,
          shiftId: existing?.shiftId,
          existingId: existing?.id ?? null,
        });
      }
    },
    [canManage, stampMode, stampValue, applyStamp, scheduleMap],
  );

  const handleHeaderClick = useCallback(
    (dateStr: string) => {
      if (!canManage) return;
      if (stampMode) {
        if (stampValue === undefined) {
          Message.info('请先选择班次后再点击表头进行批量排班');
          return;
        }
        batchApplyDate(dateStr, stampValue);
      } else {
        // 弹窗模式：打开批量排班弹窗
        setModal({
          visible: true,
          source: 'header',
          workDate: dateStr,
          shiftId: undefined,
          existingId: null,
        });
      }
    },
    [canManage, stampMode, stampValue, batchApplyDate],
  );

  const openCreateModal = useCallback(() => {
    setModal({
      visible: true,
      source: 'create',
      workDate: monthStart,
      shiftId: undefined,
      existingId: null,
    });
  }, [monthStart]);

  const closeModal = useCallback(() => {
    setModal((m) => ({ ...m, visible: false }));
  }, []);

  const handleModalOk = useCallback(async () => {
    if (modal.source === 'header') {
      // 批量排班弹窗：shiftId 必填；提供“清除当日”由独立按钮处理
      if (modal.shiftId === undefined) {
        Message.error('请选择班次');
        return;
      }
      setModalLoading(true);
      try {
        await batchApplyDate(modal.workDate, modal.shiftId);
        closeModal();
      } finally {
        setModalLoading(false);
      }
      return;
    }

    // cell / create
    if (modal.shiftId === undefined) {
      Message.error('请选择班次');
      return;
    }
    if (modal.source === 'create' && modal.employeeId === undefined) {
      Message.error('请选择员工');
      return;
    }

    setModalLoading(true);
    try {
      const dto: ScheduleCreateDto = {
        employeeId: modal.employeeId!,
        shiftId: modal.shiftId,
        workDate: modal.workDate,
      };
      if (modal.existingId) {
        const res = await attendanceApi.updateSchedule(modal.existingId, dto);
        if (res.code !== 0) {
          Message.error(res.message || '保存失败');
          return;
        }
      } else {
        const res = await attendanceApi.createSchedule(dto);
        if (res.code !== 0) {
          Message.error(res.message || '保存失败');
          return;
        }
      }
      Message.success('保存成功');
      closeModal();
      await refetch();
    } catch {
      Message.error('保存失败');
    } finally {
      setModalLoading(false);
    }
  }, [modal, batchApplyDate, closeModal, refetch]);

  const handleModalDelete = useCallback(async () => {
    if (!modal.existingId) return;
    setModalLoading(true);
    try {
      const res = await attendanceApi.deleteSchedule(modal.existingId);
      if (res.code !== 0) {
        Message.error(res.message || '删除失败');
        return;
      }
      Message.success('已删除排班');
      closeModal();
      await refetch();
    } catch {
      Message.error('删除失败');
    } finally {
      setModalLoading(false);
    }
  }, [modal, closeModal, refetch]);

  /** 弹窗内批量清除当天 */
  const handleModalBatchClear = useCallback(async () => {
    if (modal.source !== 'header') return;
    setModalLoading(true);
    try {
      await batchApplyDate(modal.workDate, 'clear');
      closeModal();
    } finally {
      setModalLoading(false);
    }
  }, [modal, batchApplyDate, closeModal]);

  // ============ 表格 ============

  const columns = useMemo<TableColumnProps<Employee>[]>(() => {
    const cols: TableColumnProps<Employee>[] = [
      {
        title: '员工',
        dataIndex: 'name',
        key: 'employee',
        fixed: 'left',
        width: 140,
        align: 'left',
        render: (_v: unknown, record: Employee) => (
          <div>
            <div className="font-medium text-text-1">{record.name}</div>
            <div className="text-[11px] text-text-3">{record.employeeNo}</div>
          </div>
        ),
      },
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(viewYear, viewMonth, day);
      const dateStr = formatDate(viewYear, viewMonth, day);
      const weekday = dateObj.getDay();
      const isWeekend = weekday === 0 || weekday === 6;

      cols.push({
        title: (
          <div className="flex flex-col items-center leading-tight">
            <span className={`text-[10px] ${isWeekend ? 'text-danger' : 'text-text-3'}`}>
              {WEEKDAY_LABELS[weekday]}
            </span>
            <span className={`text-sm font-medium ${isWeekend ? 'text-danger' : 'text-text-1'}`}>
              {day}
            </span>
          </div>
        ),
        dataIndex: `d_${day}`,
        key: `d_${day}`,
        width: 52,
        align: 'center',
        headerCellStyle: { background: isWeekend ? '#fff7f0' : undefined, padding: '4px 0' },
        onHeaderCell: () => ({
          onClick: () => handleHeaderClick(dateStr),
          style: { cursor: canManage ? 'pointer' : 'default', userSelect: 'none' },
          title: canManage ? '点击对当日全员批量排班' : '',
        }),
        onCell: (record: Employee) => ({
          padding: 0,
          cursor: canManage ? (stampMode ? 'crosshair' : 'pointer') : 'default',
          onClick: () => handleCellClick(record, dateStr),
          title: (() => {
            const schedule = scheduleMap.get(`${record.id}_${dateStr}`);
            const leave = leaveMap.get(`${record.id}_${dateStr}`);
            if (leave) return `已请假：${leave.vacationType?.name || ''}`;
            return schedule?.shift
              ? `${schedule.shift.name} ${schedule.shift.startTime}-${schedule.shift.endTime}`
              : '';
          })(),
        }),
        render: (_v: unknown, record: Employee) => {
          const schedule = scheduleMap.get(`${record.id}_${dateStr}`);
          const leave = leaveMap.get(`${record.id}_${dateStr}`);
          // 请假优先：请假日用浅橙底，避免与班次底色冲突
          if (leave) {
            return (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: '#fff7e8' }}
              >
                <Tag color="orange" size="small" style={{ margin: 0, fontSize: 11 }}>
                  请假
                </Tag>
              </div>
            );
          }
          if (schedule?.shift) {
            const color = schedule.shift.color || DEFAULT_SHIFT_COLOR;
            const textColor = getContrastColor(schedule.shift.color);
            return (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: color, borderRadius: 4 }}
              >
                <span style={{ fontSize: 11, fontWeight: 500, color: textColor }}>
                  {shortShiftName(schedule.shift.name)}
                </span>
              </div>
            );
          }
          return <span className="text-text-4 text-[11px]">-</span>;
        },
      });
    }
    return cols;
  }, [
    daysInMonth,
    viewYear,
    viewMonth,
    scheduleMap,
    leaveMap,
    stampMode,
    canManage,
    handleHeaderClick,
    handleCellClick,
  ]);

  // ============ 渲染 ============

  const monthLabel = `${viewYear} 年 ${viewMonth + 1} 月`;

  return (
      <PageContainer title="排班管理">
        {/* 顶部工具栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface border border-border-1 rounded-md mb-3">
          <Space wrap>
            <Button
              icon={<IconLeft />}
              onClick={goPrevMonth}
              disabled={loading}
              aria-label="上一月"
            />
            <Text bold className="min-w-[110px] text-center inline-block">
              {monthLabel}
            </Text>
            <Button
              icon={<IconRight />}
              onClick={goNextMonth}
              disabled={loading}
              aria-label="下一月"
            />
            <Button
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              disabled={loading || (viewYear === today.getFullYear() && viewMonth === today.getMonth())}
            >
              回到今天
            </Button>
            <Button icon={<IconRefresh />} onClick={refetch} loading={loading}>
              刷新
            </Button>
            <Button onClick={handleImport} disabled={!canManage}>
              导入
            </Button>
            <Button onClick={handleDownloadImportTemplate}>下载模板</Button>
            <Button onClick={handleExport}>导出 Excel</Button>
          </Space>

          <Space wrap>
            <Text className="text-text-3">部门</Text>
            <Select
              value={selectedDeptId}
              onChange={(v: number) => setSelectedDeptId(v)}
              style={{ width: 180 }}
              placeholder="选择部门"
              showSearch
              allowClear
            >
              {departments.map((d) => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name}
                </Select.Option>
              ))}
            </Select>
            <Input
              prefix={<IconSearch />}
              value={keyword}
              onChange={setKeyword}
              placeholder="搜索员工姓名/工号"
              style={{ width: 200 }}
              allowClear
            />
          </Space>

          <Space wrap>
            <Text className="text-text-3">印章模式</Text>
            <Switch checked={stampMode} onChange={setStampMode} disabled={!canManage} />
            {stampMode && (
              <Select
                value={stampValue}
                onChange={(v: StampValue) => setStampValue(v)}
                style={{ width: 190 }}
                placeholder="选择班次印章"
                allowClear
                showSearch
                filterOption={(input: string, option: any) =>
                  String(option?.children ?? option?.label ?? '')
                    .toLowerCase()
                    .includes(String(input).toLowerCase())
                }
              >
                {shifts.map((s) => (
                  <Select.Option key={s.id} value={s.id}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: s.color || DEFAULT_SHIFT_COLOR,
                          border: '1px solid rgba(0,0,0,0.1)',
                        }}
                      />
                      {s.name}（{s.startTime}-{s.endTime}）
                    </span>
                  </Select.Option>
                ))}
                <Select.Option value="clear">
                  <span className="text-danger">清除排班</span>
                </Select.Option>
              </Select>
            )}
            {!stampMode && canManage && (
              <Button type="primary" icon={<IconPlus />} onClick={openCreateModal}>
                新增排班
              </Button>
            )}
          </Space>
        </div>

        {/* 模式提示 + 班次图例 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 mb-3 bg-bg-page rounded-md">
          <Text className="text-xs text-text-3">
            {stampMode
              ? `印章模式：${stampValue === undefined ? '请选择班次印章' : stampValue === 'clear' ? '点击单元格清除排班，点击表头清除当日全员排班' : '点击单元格排班，点击表头对当日全员批量排班'}`
              : '弹窗模式：点击单元格编辑单人排班，点击表头对当日全员批量排班'}
          </Text>
          <Space size={4} wrap>
            {shifts.slice(0, 10).map((s) => (
              <Tag
                key={s.id}
                size="small"
                style={{
                  margin: 0,
                  backgroundColor: s.color || DEFAULT_SHIFT_COLOR,
                  color: getContrastColor(s.color),
                  border: 'none',
                }}
              >
                {s.name}
              </Tag>
            ))}
            <Tag color="orange" size="small" style={{ margin: 0 }}>
              ● = 已审批请假            </Tag>
          </Space>
        </div>

        {/* 日历表格 */}
        <Spin loading={loading && schedules.length === 0} style={{ display: 'block' }}>
          <div ref={tableWrapRef}>
            <Table
              columns={columns}
              data={filteredEmployees}
              rowKey="id"
              loading={loading && filteredEmployees.length > 0}
              pagination={false}
              scroll={{ x: 140 + 52 * daysInMonth }}
              border={{ wrapper: true, cell: true }}
              size="small"
              hover={false}
              noDataElement={selectedDeptId === undefined ? '请选择部门' : '当前部门暂无员工'}
            />
          </div>
        </Spin>

        {/* 固定底部横向滚动条：无需滚到表格底部即可切换日期 */}
        <HSyncBar
          visible={hScroll.scrollWidth > hScroll.clientWidth + 2}
          scrollLeft={hScroll.scrollLeft}
          scrollWidth={hScroll.scrollWidth}
          clientWidth={hScroll.clientWidth}
          onSeek={handleHSeek}
        />

        {batchLoading && (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-white/50 z-[1001]">
            <Spin size={36} />
            <div className="mt-3 text-text-1">批量操作中...</div>
          </div>
        )}

        {/* 排班编辑弹窗 */}
        <ScheduleEditModal
          modal={modal}
          shifts={shifts}
          modalLoading={modalLoading}
          onShiftChange={(v) => setModal((m) => ({ ...m, shiftId: v }))}
          onEmployeeChange={(id, name) =>
            setModal((m) => ({ ...m, employeeId: id, employeeName: name }))
          }
          onDateChange={(d) => setModal((m) => ({ ...m, workDate: d }))}
          onOk={handleModalOk}
          onCancel={closeModal}
          onDelete={handleModalDelete}
          onBatchClear={handleModalBatchClear}
        />
      </PageContainer>
  );
}

// ============ 弹窗子组件 ============

interface ScheduleEditModalProps {
  modal: CellModalState;
  shifts: Shift[];
  modalLoading: boolean;
  onShiftChange: (v: number | undefined) => void;
  onEmployeeChange: (id: number | undefined, name?: string) => void;
  onDateChange: (date: string) => void;
  onOk: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onBatchClear: () => void;
}

function ScheduleEditModal({
  modal,
  shifts,
  modalLoading,
  onShiftChange,
  onEmployeeChange,
  onDateChange,
  onOk,
  onCancel,
  onDelete,
  onBatchClear,
}: ScheduleEditModalProps) {
  const isCell = modal.source === 'cell';
  const isHeader = modal.source === 'header';
  const isCreate = modal.source === 'create';

  const title = isHeader
    ? `批量排班 - ${modal.workDate}`
    : isCreate
      ? '新增排班'
      : `编辑排班 - ${modal.workDate}`;

  return (
    <Modal
      visible={modal.visible}
      title={title}
      onOk={onOk}
      onCancel={onCancel}
      confirmLoading={modalLoading}
      okText={isHeader ? '全员排班' : '保存'}
      cancelText="取消"
      maskClosable={false}
      style={{ width: 460 }}
    >
      <div className="flex flex-col gap-4 pt-1">
        {isHeader && (
          <div className="p-2.5 px-3 bg-bg-page rounded-md text-xs text-text-2">
            将对当前部门全部员工在 <b>{modal.workDate}</b> 批量排班；已有排班会被覆盖。          </div>
        )}

        {/* 员工 */}
        {isCreate ? (
          <FieldRow label="员工">
            <EmployeeSelect
              value={modal.employeeId}
              onChange={(v) => onEmployeeChange(v as number, undefined)}
              placeholder="搜索并选择员工"
            />
          </FieldRow>
        ) : (
          <FieldRow label="员工">
            <Input value={isCell ? modal.employeeName || '' : '当日全员'} disabled />
          </FieldRow>
        )}

        {/* 日期 */}
        {isCreate ? (
          <FieldRow label="日期">
            <DatePicker
              style={{ width: '100%' }}
              value={modal.workDate}
              format="YYYY-MM-DD"
              onChange={(dateString: string) => onDateChange(dateString)}
            />
          </FieldRow>
        ) : (
          <FieldRow label="日期">
            <Input value={modal.workDate} disabled />
          </FieldRow>
        )}

        {/* 班次 */}
        <FieldRow label="班次" required>
          <Select
            value={modal.shiftId}
            onChange={(v: number) => onShiftChange(v)}
            style={{ width: '100%' }}
            placeholder="搜索并选择班次"
            allowClear
            showSearch
            filterOption={(input: string, option: any) =>
              String(option?.children ?? option?.label ?? '')
                .toLowerCase()
                .includes(String(input).toLowerCase())
            }
          >
            {shifts.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: s.color || DEFAULT_SHIFT_COLOR,
                      border: '1px solid rgba(0,0,0,0.1)',
                    }}
                  />
                  {s.name}（{s.startTime}-{s.endTime}{s.isNextDay ? ' 次日' : ''}）                </span>
              </Select.Option>
            ))}
          </Select>
        </FieldRow>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 mt-1">
          {isCell && modal.existingId && (
            <Button status="danger" loading={modalLoading} onClick={onDelete}>
              删除该排班            </Button>
          )}
          {isHeader && (
            <Button status="danger" loading={modalLoading} onClick={onBatchClear}>
              清除当日排班
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="w-14 flex-shrink-0 text-right text-sm text-text-2">
        {required && <span className="text-danger mr-0.5">*</span>}
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ============ 固定底部横向滚动条 ============

interface HSyncBarProps {
  visible: boolean;
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
  onSeek: (ratio: number) => void;
}

/** 固定在视口底部的横向滚动条，镜像排班大表的横向位置 */
function HSyncBar({ visible, scrollLeft, scrollWidth, clientWidth, onSeek }: HSyncBarProps) {
  const draggingRef = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  if (!visible || clientWidth <= 0 || scrollWidth <= clientWidth) return null;

  const max = scrollWidth - clientWidth;
  const ratio = max > 0 ? scrollLeft / max : 0;
  const barWidth = Math.max(48, (clientWidth / scrollWidth) * 420);
  const offset = clamp(422 - barWidth) * ratio;

  const seekFromEvent = (clientX: number, rectLeft: number) => {
    const track = 422;
    const x = Math.max(0, Math.min(track, clientX - rectLeft));
    onSeek(x / track);
  };

  return (
    <div
      ref={barRef}
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[1100]"
      onPointerDown={(e) => {
        draggingRef.current = true;
        const rect = barRef.current?.getBoundingClientRect();
        if (rect) seekFromEvent(e.clientX, rect.left);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) {
          const rect = barRef.current?.getBoundingClientRect();
          if (rect) seekFromEvent(e.clientX, rect.left);
        }
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
    >
      <div
        className="h-2 rounded-full bg-white/80 backdrop-blur border border-black/10 shadow-md flex items-center"
        style={{ width: 422, cursor: 'pointer' }}
      >
        <div
          className="h-2 rounded-full bg-brand"
          style={{
            width: barWidth,
            transform: `translateX(${offset}px)`,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
}

function clamp(n: number): number {
  return Math.max(0, n);
}
