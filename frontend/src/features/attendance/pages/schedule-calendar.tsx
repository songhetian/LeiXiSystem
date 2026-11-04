'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  Table,
  Button,
  Select,
  Modal,
  Tag,
  DatePicker,
  Message,
  Space,
  Input,
  Switch,
  Typography,
  type TableColumnProps,
} from '@arco-design/web-react';
import { IconLeft, IconRight, IconRefresh, IconPlus, IconSearch } from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import { PermissionGate } from '@/components/PermissionGate';
import { useThrottle } from '@/hooks/use-throttle';
import { useCachedData } from '@/hooks/use-cached-data';
import EmployeeSelect from '@/components/EmployeeSelect';
import {
  attendanceApi,
  type Schedule,
  type Shift,
  type LeaveRecord,
  type ScheduleCreateDto,
  type ScheduleMatrixEmployee,
} from '@/services/attendance';
import { useDepartments } from '@/hooks/use-departments';
import {
  planBatchApply,
  parseScheduleImportRows,
  batchConfirmMessage,
  filterSchedulesForEmployees,
  summarizeImport,
  formatBatchFailure,
  mergeUpsertItems,
  type BatchPlan,
} from '@/features/attendance/lib/schedule-plan';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';
import { leaveDateKeys } from '@/lib/leave-days';
import { getContrastColor } from '@/lib/contrast';
import * as XLSX from 'xlsx';
import LoaderDots from '@/components/LoaderDots';

const { Text } = Typography;

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 默认班次底色（当 shift.color 缺失时使用） */
const DEFAULT_SHIFT_COLOR = 'var(--lx-primary-weak)';

/** 印章值：数字 = 班次 ID，'clear' = 清除排班 */
type StampValue = number | 'clear';

/** 空数组兜底常量：data 为 null 时兜底，避免每次渲染生成新引用导致下游 useMemo 反复失效 */
const EMPTY: never[] = [];

/** 后端请假列表默认 pageSize 上限（超出部分会被静默截断） */
const LEAVE_PAGE_SIZE = 100;

/** 循环分页拉取区间内已审批请假，避免请假人数多时日历缺格 */
async function fetchApprovedLeaves(startDate: string, endDate: string): Promise<LeaveRecord[]> {
  const rows: LeaveRecord[] = [];
  let page = 1;
  while (true) {
    const res = await attendanceApi.getLeaveList({
      status: 'approved',
      startDate,
      endDate,
      page,
      pageSize: LEAVE_PAGE_SIZE,
    });
    if (res.code !== 0) throw new Error(res.message || '请假数据加载失败');
    const list = res.data?.list ?? [];
    rows.push(...list);
    const total = res.data?.total ?? 0;
    if (list.length === 0 || rows.length >= total) break;
    page += 1;
  }
  return rows;
}

/** 破坏性操作二次确认：返回 true 表示用户确认继续 */
function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '继续',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

/** 批量操作的中文文案（新建/更新/删除分别计数） */
function batchResultMessage(plan: BatchPlan, stamp: StampValue): string {
  const changed = plan.itemsToCreate.length + plan.toUpdate.length + plan.toDelete.length;
  const skipped = plan.skippedOnLeave > 0 ? `，跳过 ${plan.skippedOnLeave} 名请假员工` : '';
  if (stamp === 'clear') return `已清除当天 ${plan.toDelete.length} 条排班${skipped}`;
  return `已批量排班 ${changed} 人${skipped}`;
}

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

function fmtDate(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

function getDaysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
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
  return fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
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
  const { departments } = useDepartments();
  const [selectedDeptId, setSelectedDeptId] = useState<number | undefined>(undefined);
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

  // 单格写入成功后的本地乐观值：key = `${employeeId}_${dateStr}`，null 表示该格已清除。
  // 避免每点一格就整表重新拉取（大表 + 全量请求会让表格反复闪 loading）。
  const [overrides, setOverrides] = useState<Record<string, Schedule | null>>({});
  const revalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // roving tabindex：整张「员工 × 日期」网格只留一个 Tab 停靠点。
  // 默认给每格都加 tabIndex=0，100 人 × 31 天就是 3100 个停靠点，
  // Tab 键要穿过整张表才能到达下一个控件；改为方向键在网格内移动、Tab 一键离开。
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
  const [activeHeadDay, setActiveHeadDay] = useState(1);

  // ============ 数据加载（useCachedData SWR 共享缓存） ============

  // 月份起止（YYYY-MM-DD 稳定字符串，作为排班/请假缓存 key 的一部分，切换月份自动重拉）
  const daysInMonth = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthStart = useMemo(() => fmtDate(viewYear, viewMonth, 1), [viewYear, viewMonth]);
  const monthEnd = useMemo(
    () => fmtDate(viewYear, viewMonth, daysInMonth),
    [viewYear, viewMonth, daysInMonth],
  );

  // 月度排班矩阵：后端 /schedules/matrix 一次返回部门在职员工 + 区间内全部排班。
  // 不再用 /employees + /schedules 分页拼装——它们的 pageSize 上限（100 / 200）
  // 会在人多的公司里静默截断，导致日历缺格，点击“空”格实际会覆盖已有排班。
  const matrixKey = `attendance:schedule-matrix:${selectedDeptId ?? 'all'}:${monthStart}:${monthEnd}`;
  const {
    data: matrix,
    loading: matrixLoading,
    error: matrixError,
    revalidate: revalidateMatrix,
  } = useCachedData<{ employees: ScheduleMatrixEmployee[]; schedules: Schedule[] }>(
    matrixKey,
    async () => {
      const res = await attendanceApi.getScheduleMatrix({
        departmentId: selectedDeptId,
        startDate: monthStart,
        endDate: monthEnd,
      });
      if (res.code !== 0 || !res.data) throw new Error(res.message || '排班数据加载失败');
      return { employees: res.data.employees, schedules: res.data.schedules };
    },
  );

  // 班次列表
  const {
    data: shiftsData,
    loading: shiftsLoading,
    error: shiftsError,
    revalidate: revalidateShifts,
  } = useCachedData<Shift[]>(
    'attendance:shifts',
    async () => {
      const res = await attendanceApi.getShiftList();
      if (res.code === 0 && res.data) return res.data.list;
      throw new Error(res.message || '班次列表加载失败');
    },
  );

  // 当月已审批请假：后端默认 pageSize 上限 100，必须循环分页拉全量，
  // 否则请假人数一多，日历上的请假底色就会大面积缺失。
  const {
    data: leavesData,
    loading: leavesLoading,
    error: leavesError,
    revalidate: revalidateLeaves,
  } = useCachedData<LeaveRecord[]>(
    `attendance:leaves-approved:${monthStart}:${monthEnd}`,
    () => fetchApprovedLeaves(monthStart, monthEnd),
  );

  const employees = matrix?.employees ?? EMPTY;
  const shifts = shiftsData ?? EMPTY;
  const schedules = matrix?.schedules ?? EMPTY;
  const leaves = leavesData ?? EMPTY;

  // 首屏（还没有矩阵数据）显示加载态，避免先闪一下「当前部门暂无员工」
  const initialLoading = matrixLoading && matrix == null;
  // 页面内错误：统一用一个横幅 + 重试，不再只弹一次 toast
  const loadError = matrixError ?? leavesError ?? shiftsError;

  // ============ 派生数据 ============

  // 排班矩阵员工只含 id/employeeNo/name/departmentId（后端已按部门过滤），
  // 无 status 字段，无需再本地按部门/在职过滤，仅按搜索关键词过滤
  const filteredEmployees = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return employees;
    return employees.filter(
      (e) => e.name.toLowerCase().includes(kw) || e.employeeNo.toLowerCase().includes(kw),
    );
  }, [employees, keyword]);

  // 员工被搜索条件筛掉时，记录的活动格可能越界，渲染前统一夹到合法范围
  const focusRow = Math.min(activeCell.row, Math.max(0, filteredEmployees.length - 1));
  const focusCol = Math.min(activeCell.col, daysInMonth - 1);

  const shiftById = useMemo(() => {
    const m = new Map<number, Shift>();
    shifts.forEach((s) => m.set(s.id, s));
    return m;
  }, [shifts]);

  /** key = `${employeeId}_${workDate}`；叠加本地乐观写入（overrides）后再进日历 */
  const scheduleMap = useMemo(() => {
    const m = new Map<string, Schedule>();
    schedules.forEach((s) => {
      if (!s || !s.workDate) return;
      // 班次ID优先从班次列表回填，确保排班块获得完整班次信息（含颜色）。
      // 列表接口内嵌的 shift 关系可能缺少 color，若存在则以列表匹配为准。
      const shift = shiftById.get(s.shiftId) ?? s.shift;
      m.set(`${s.employeeId}_${dateOnly(s.workDate)}`, shift ? { ...s, shift } : s);
    });
    Object.entries(overrides).forEach(([key, s]) => {
      if (s === null) m.delete(key);
      else {
        const shift = shiftById.get(s.shiftId) ?? s.shift;
        m.set(key, shift ? { ...s, shift } : s);
      }
    });
    return m;
  }, [schedules, shiftById, overrides]);

  /** key = `${employeeId}_${dateStr}`，仅包含已审批通过的请假 */
  const leaveMap = useMemo(() => {
    const m = new Map<string, LeaveRecord>();
    leaves.forEach((l) => {
      if (l.status !== 'approved') return;
      leaveDateKeys(l.employeeId, l.startDate, l.endDate).forEach((k) => m.set(k, l));
    });
    return m;
  }, [leaves]);

  // 进入页面默认查看全部部门（selectedDeptId 为 undefined），
  // 不再自动选中部门列表第一项——那会让人误以为公司只有这一个部门的人。

  // 切换月份/部门后，本地乐观值属于旧视图，必须丢弃
  useEffect(() => {
    setOverrides({});
  }, [matrixKey]);

  // 卸载时清掉待触发的防抖刷新
  useEffect(
    () => () => {
      if (revalidateTimerRef.current) clearTimeout(revalidateTimerRef.current);
    },
    [],
  );

  /** 强制刷新排班与请假：导入/批量/弹窗保存成功后调用（绕过缓存） */
  const refetch = useCallback(async () => {
    // 与防抖刷新同一原则：拉取失败时保留乐观值，避免界面把刚写入的排班抹掉
    await Promise.all([
      revalidateMatrix().then((data) => {
        if (data) setOverrides({});
      }),
      revalidateLeaves(),
    ]);
  }, [revalidateMatrix, revalidateLeaves]);

  /**
   * 单格写入成功后的延迟刷新：连续打多个格子时合并成一次请求。
   * 刷新成功后再清掉本地乐观值，避免请求失败时界面「回退成旧排班」。
   */
  const scheduleRevalidate = useCallback(() => {
    if (revalidateTimerRef.current) clearTimeout(revalidateTimerRef.current);
    revalidateTimerRef.current = setTimeout(() => {
      // revalidate 失败时返回 null：此时不能清乐观值，否则用户刚点的格会凭空退回旧状态
      void revalidateMatrix().then((data) => {
        if (data) setOverrides({});
      });
    }, 800);
  }, [revalidateMatrix]);

  /** 错误横幅重试：三份数据一起重拉 */
  const retryAll = useCallback(async () => {
    await Promise.all([revalidateMatrix(), revalidateLeaves(), revalidateShifts()]);
  }, [revalidateMatrix, revalidateLeaves, revalidateShifts]);

  /** 导出当月排班明细到 Excel：范围跟随当前筛选（部门 + 搜索词） */
  const handleExport = useCallback(() => {
    const empById = new Map<number, ScheduleMatrixEmployee>();
    employees.forEach((e) => empById.set(e.id, e));
    const visibleIds = new Set(filteredEmployees.map((e) => e.id));
    // 用 scheduleMap 而不是原始 schedules：导出结果与日历上看到的一致（含本地乐观写入）
    const rows = filterSchedulesForEmployees(Array.from(scheduleMap.values()), visibleIds).map(
      (s) => ({
        emp: empById.get(s.employeeId) ?? s.employee,
        shift: s.shift,
        workDate: dateOnly(s.workDate),
      }),
    );
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
      Message.info('当前筛选范围暂无排班数据');
    }
  }, [scheduleMap, employees, filteredEmployees, viewYear, viewMonth]);

  /** 触发文件选择框 */
  const handleImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  /** 导出排班导入模板（示例日期用当前查看月份，避免用户照抄模板后被“不在当前月份”整批拦下） */
  const handleDownloadImportTemplate = useCallback(() => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['工号', '姓名', '日期', '班次'],
      ['E001', '张三', monthStart, '早班'],
      ['E002', '李四', monthStart, '晚班'],
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '排班导入');
    XLSX.writeFile(wb, '排班导入模板.xlsx');
  }, [monthStart]);

  /** 解析排班导入 Excel 并批量写入 */
  const handleImportFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const buf = await file.arrayBuffer();
        // cellDates: true 让日期单元格直接读成 Date，否则读到的是 Excel 序列号（如 46235），
        // 会被当成「日期格式错误」整批拒掉
        const wb = XLSX.read(buf, { cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

        const { items, errors } = parseScheduleImportRows(rows, employees, shifts, {
          startDate: monthStart,
          endDate: monthEnd,
        });

        if (items.length === 0) {
          Message.error(
            errors.length ? `没有可导入的有效数据：${errors.slice(0, 3).join('；')}` : '没有可导入的有效数据',
          );
          return;
        }
        // 导入实际是 upsert：同员工同日的已有排班会被静默覆盖，必须先让用户看到影响范围
        const summary = summarizeImport(items, scheduleMap);
        const overwriteText =
          summary.toOverwrite > 0
            ? `其中 ${summary.toOverwrite} 条会覆盖当天已有排班`
            : '';
        const ok = await confirmAction(
          '确认导入',
          `将导入 ${items.length} 条排班${overwriteText ? `，${overwriteText}` : ''}。是否继续？`,
        );
        if (!ok) return;

        const res = await attendanceApi.batchCreateSchedule({ items });
        if (res.code !== 0) {
          Message.error(res.message || '排班导入失败');
          return;
        }
        Message.success(
          `排班导入成功：${res.data?.count ?? items.length} 条${
            summary.toOverwrite > 0 ? `，覆盖 ${summary.toOverwrite} 条` : ''
          }`,
        );
        if (errors.length) {
          Message.warning(`忽略 ${errors.length} 条无效数据：${errors.slice(0, 3).join('；')}`);
        }
        await refetch();
      } catch {
        Message.error('导入失败，请检查文件格式');
      } finally {
        setImporting(false);
      }
    },
    [employees, shifts, monthStart, monthEnd, scheduleMap, refetch],
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
    // 单次绑定：bind() 返回 cleanup，无论何时成功绑定，最终都由 useEffect 的
    // cleanup 统一释放，避免 setTimeout 分支和即时分支各自添加 scroll 监听器
    // 后无人 removeEventListener 造成的累积泄漏（用户每次切月份/筛选时触发）。
    let cleanup: () => void = () => {};

    const bind = () => {
      const el = getHScrollEl();
      if (!el) return;
      const onScroll = () => throttledSyncHScroll();
      el.addEventListener('scroll', onScroll, { passive: true });
      syncHScroll();
      const ro = new ResizeObserver(syncHScroll);
      ro.observe(el);
      cleanup = () => {
        el.removeEventListener('scroll', onScroll);
        ro.disconnect();
      };
    };

    if (!getHScrollEl()) {
      // 数据/列数变化后表格可能尚未渲染，延迟绑定以确保拿到滚动容器
      // 注意：此分支 cleanup 只负责取消尚未触发的定时器；bind() 成功后会把
      // cleanup 重新赋值为「解绑监听 + 断开 ResizeObserver」，由 useEffect 统一调用
      const t = setTimeout(bind, 60);
      cleanup = () => {
        clearTimeout(t);
      };
    } else {
      bind();
    }
    return cleanup;
  }, [syncHScroll, getHScrollEl, throttledSyncHScroll, daysInMonth, filteredEmployees.length]);

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

  /** 印章模式：对单个员工/日期应用印章（新建或更新或清除），采用本地乐观更新 */
  const applyStamp = useCallback(
    async (employeeId: number, dateStr: string, stamp: StampValue) => {
      const key = `${employeeId}_${dateStr}`;
      const existing = scheduleMap.get(key);
      // 请假日不允许排班/清除（日历渲染请假优先，写入也看不见）
      if (leaveMap.has(key)) {
        Message.warning('该员工当日已请假，不能排班');
        return;
      }
      // 无变化直接跳过：印章与已有排班相同班次时不必再打 update 接口
      if (stamp !== 'clear' && existing && existing.shiftId === stamp) return;
      if (stamp === 'clear' && !existing) {
        // 静默返回会让用户以为清除没生效
        Message.info('该格本来就没有排班');
        return;
      }

      try {
        // savedId 用服务端返回的真实 ID，保证乐观值后续被点击删除时能命中记录
        let savedId = existing?.id;
        if (stamp === 'clear') {
          // 单格清除同样是破坏性操作，先让用户确认
          const ok = await confirmAction('清除排班', `将删除 ${dateStr} 的这条排班，此操作不可撤销。`);
          if (!ok) return;
          const res = await attendanceApi.deleteSchedule(existing!.id);
          if (res.code !== 0) {
            Message.error(res.message || '清除排班失败');
            return;
          }
        } else {
          const dto: ScheduleCreateDto = { employeeId, shiftId: stamp, workDate: dateStr };
          if (existing) {
            const res = await attendanceApi.updateSchedule(existing.id, dto);
            if (res.code !== 0 || !res.data) {
              Message.error(res.message || '排班失败');
              return;
            }
            savedId = res.data.id;
          } else {
            const res = await attendanceApi.createSchedule(dto);
            if (res.code !== 0 || !res.data) {
              Message.error(res.message || '排班失败');
              return;
            }
            savedId = res.data.id;
          }
        }
        // 本地乐观写入：立即反映到日历，稍后延迟刷新后端数据对齐
        setOverrides((prev) => {
          const next = { ...prev };
          if (stamp === 'clear') next[key] = null;
          else if (savedId !== undefined)
            next[key] = { id: savedId, employeeId, shiftId: stamp, workDate: dateStr };
          return next;
        });
        scheduleRevalidate();
      } catch {
        Message.error('操作失败，请重试');
      }
    },
    [scheduleMap, leaveMap, scheduleRevalidate],
  );

  /** 批量操作：对某一天的全部（过滤后）员工应用印章 */
  const batchApplyDate = useCallback(
    async (dateStr: string, stamp: StampValue) => {
      if (filteredEmployees.length === 0) {
        Message.info('当前没有可排班的员工');
        return;
      }
      // 请假日员工跳过、并统计跳过人数；计划与确认文案抽到纯函数里便于单测
      const plan = planBatchApply(
        filteredEmployees,
        dateStr,
        stamp,
        scheduleMap,
        new Set(leaveMap.keys()),
      );

      const changed = plan.itemsToCreate.length + plan.toUpdate.length + plan.toDelete.length;
      if (changed === 0) {
        Message.info(
          plan.skippedOnLeave > 0
            ? `无需变更（${plan.skippedOnLeave} 名员工当日请假，已跳过）`
            : '无需变更的排班',
        );
        return;
      }

      // 清除/覆盖是破坏性操作，先让用户看到影响范围
      const confirmText = batchConfirmMessage(plan, dateStr, stamp);
      if (confirmText) {
        const ok = await confirmAction(stamp === 'clear' ? '清除当日排班' : '覆盖当日排班', confirmText);
        if (!ok) return;
      }

      setBatchLoading(true);
      try {
        const tasks: { label: string; run: Promise<{ code: number; message?: string }> }[] = [];
        // 新建与覆盖合并成一次 batch（后端事务内 upsert）：100 人 1 次往返、整批原子
        const upsertItems = mergeUpsertItems(plan);
        if (upsertItems.length > 0) {
          const overwriteCount = plan.toUpdate.length;
          tasks.push({
            label:
              overwriteCount > 0
                ? `排班 ${upsertItems.length} 人（含覆盖 ${overwriteCount} 人）`
                : `新增 ${upsertItems.length} 人`,
            run: attendanceApi
              .batchCreateSchedule({ items: upsertItems })
              .then((r) => ({ code: r.code, message: r.message })),
          });
        }
        if (plan.toDelete.length > 0) {
          tasks.push({
            label: `清除 ${plan.toDelete.length} 条排班`,
            run: attendanceApi
              // 一次批量删除，避免「清除当日」按人数发 N 次 DELETE
              .batchDeleteSchedules(plan.toDelete)
              .then((r) => ({ code: r.code, message: r.message })),
          });
        }
        const results = await Promise.allSettled(tasks.map((t) => t.run));
        const failedLabels: string[] = [];
        results.forEach((r, i) => {
          if (r.status === 'rejected' || (r.status === 'fulfilled' && r.value.code !== 0)) {
            failedLabels.push(tasks[i].label);
          }
        });
        if (failedLabels.length > 0) {
          Message.warning(formatBatchFailure(failedLabels));
        } else {
          Message.success(batchResultMessage(plan, stamp));
        }
        await refetch();
      } catch {
        Message.error('批量操作失败');
      } finally {
        setBatchLoading(false);
      }
    },
    [filteredEmployees, scheduleMap, leaveMap, refetch],
  );

  // ============ 交互 ============

  const handleCellClick = useCallback(
    (employee: ScheduleMatrixEmployee, dateStr: string) => {
      // 只读用户点了没反应会以为功能坏了，需要明确说明
      if (!canManage) {
        Message.info('仅可查看排班，没有考勤管理权限');
        return;
      }
      const key = `${employee.id}_${dateStr}`;
      // 请假日日历显示「请假」，直接提示，避免打开弹窗后误排班
      if (leaveMap.has(key)) {
        Message.warning('该员工当日已请假，不能排班');
        return;
      }
      if (stampMode) {
        if (stampValue === undefined) {
          Message.info('请先在印章模式下选择班次');
          return;
        }
        applyStamp(employee.id, dateStr, stampValue);
      } else {
        const existing = scheduleMap.get(key);
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
    [canManage, leaveMap, stampMode, stampValue, applyStamp, scheduleMap],
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
    // 新增排班默认落到「今天」，但仅限当前查看的月份内；否则退回当月 1 号，
    // 避免默认日期落在看不见的月份导致保存后日历毫无变化
    const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());
    setModal({
      visible: true,
      source: 'create',
      workDate: todayStr >= monthStart && todayStr <= monthEnd ? todayStr : monthStart,
      shiftId: undefined,
      existingId: null,
    });
  }, [monthStart, monthEnd, today]);

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
    // 删除不可撤销：先确认再调用接口
    const ok = await confirmAction(
      '删除排班',
      `将删除 ${modal.employeeName ?? ''} 在 ${modal.workDate} 的排班，此操作不可撤销。`,
    );
    if (!ok) return;
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

  /**
   * 单元格键盘导航：方向键/Home/End 在同一「员工 × 日期」网格里移动焦点。
   * 焦点在格子内时，容器的左右键滚动逻辑必须让位（stopPropagation）。
   */
  const handleCellKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLButtonElement>, row: number, col: number) => {
      let nextRow = row;
      let nextCol = col;
      switch (e.key) {
        case 'ArrowLeft':
          nextCol = Math.max(0, col - 1);
          break;
        case 'ArrowRight':
          nextCol = Math.min(daysInMonth - 1, col + 1);
          break;
        case 'ArrowUp':
          nextRow = Math.max(0, row - 1);
          break;
        case 'ArrowDown':
          nextRow = Math.min(filteredEmployees.length - 1, row + 1);
          break;
        case 'Home':
          nextCol = 0;
          break;
        case 'End':
          nextCol = daysInMonth - 1;
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
      setActiveCell({ row: nextRow, col: nextCol });
      const next = tableWrapRef.current?.querySelector<HTMLButtonElement>(
        `[data-cal-row="${nextRow}"][data-cal-col="${nextCol}"]`,
      );
      next?.focus();
      // jsdom 未实现 scrollIntoView，这里做可选调用避免测试环境报错
      next?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    },
    [daysInMonth, filteredEmployees.length],
  );

  // ============ 表格 ============

  const columns = useMemo<TableColumnProps<ScheduleMatrixEmployee>[]>(() => {
    const cols: TableColumnProps<ScheduleMatrixEmployee>[] = [
      {
        title: '员工',
        dataIndex: 'name',
        key: 'employee',
        fixed: 'left',
        width: 140,
        align: 'left',
        render: (_v: unknown, record: ScheduleMatrixEmployee) => (
          <div>
            <div className="font-medium text-text-1">{record.name}</div>
            <div className="text-xs text-text-3">{record.employeeNo}</div>
          </div>
        ),
      },
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(viewYear, viewMonth, day);
      const dateStr = fmtDate(viewYear, viewMonth, day);
      const weekday = dateObj.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const isToday =
        dateStr ===
        fmtDate(today.getFullYear(), today.getMonth(), today.getDate());

      cols.push({
        title: (
          <div className="flex flex-col items-center leading-tight">
            <span className={`text-xs ${isWeekend ? 'text-danger' : 'text-text-3'}`}>
              {WEEKDAY_LABELS[weekday]}
            </span>
            <span
              className={`text-sm font-medium ${isWeekend ? 'text-danger' : 'text-text-1'} ${
                isToday ? 'cal-day-today' : ''
              }`}
            >
              {day}
            </span>
          </div>
        ),
        dataIndex: `d_${day}`,
        key: `d_${day}`,
        width: 52,
        align: 'center',
        // 周末底色走**列级 className**（Arco 用 cs() 合并），不能用 onHeaderCell 的
        // className —— 后者是 Object.assign 覆盖，会把 arco-table-th 整个顶掉，
        // 表头灰底/边框在那几格断开，.arco-table-th.cal-weekend-head 也永远匹配不到。
        className: isWeekend ? 'cal-weekend-head' : undefined,
        // td 内边距只能走 cellStyle：onCell 返回的 padding/style 会被 Arco 丢弃
        // （td.js 只 pick 事件与 onMouse*），52px 的列会被 16px 横向内边距吃掉一半。
        cellStyle: { padding: 0 },
        onHeaderCell: () => ({
          onClick: () => handleHeaderClick(dateStr),
          // 表头也是操作入口：键盘可聚焦，Enter/空格等同点击（onHeaderCell 的属性会整体透传到 th）
          tabIndex: canManage ? (day === activeHeadDay ? 0 : -1) : undefined,
          'aria-label': canManage ? `${dateStr} 对当前筛选的 ${filteredEmployees.length} 人批量排班` : undefined,
          'data-cal-head': day,
          onFocus: () => setActiveHeadDay(day),
          onKeyDown: (e: ReactKeyboardEvent<HTMLTableCellElement>) => {
            if (!canManage) return;
            if (e.key === 'Enter' || e.key === ' ') {
              // 空格默认会滚动页面，必须拦掉
              e.preventDefault();
              handleHeaderClick(dateStr);
              return;
            }
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              const target = day + (e.key === 'ArrowRight' ? 1 : -1);
              if (target < 1 || target > daysInMonth) return;
              setActiveHeadDay(target);
              tableWrapRef.current
                ?.querySelector<HTMLTableCellElement>(`[data-cal-head="${target}"]`)
                ?.focus();
            }
          },
          // 这里的 style 会覆盖 headerCellStyle（同一 Object.assign），
          // 所以 padding 必须写在这里，否则周末表头比其它表头高 16px。
          style: { padding: '4px 0', cursor: canManage ? 'pointer' : 'default', userSelect: 'none' },
          title: canManage ? `对当日当前筛选的 ${filteredEmployees.length} 人批量排班` : '',
        }),
        onCell: (record: ScheduleMatrixEmployee) => ({
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
        render: (_v: unknown, record: ScheduleMatrixEmployee, rowIndex?: number) => {
          const schedule = scheduleMap.get(`${record.id}_${dateStr}`);
          const leave = leaveMap.get(`${record.id}_${dateStr}`);
          const row = rowIndex ?? 0;
          const label = leave
            ? `${record.name} ${dateStr} 已请假`
            : schedule?.shift
              ? `${record.name} ${dateStr} ${schedule.shift.name}`
              : `${record.name} ${dateStr} 未排班`;

          let content: JSX.Element;
          if (leave) {
            // 请假优先：请假日用浅橙底，避免与班次底色冲突
            content = (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'var(--lx-warning-light)' }}
              >
                <Tag color="orange" size="small" style={{ margin: 0, fontSize: 12 }}>
                  请假
                </Tag>
              </div>
            );
          } else if (schedule?.shift) {
            const color = schedule.shift.color || DEFAULT_SHIFT_COLOR;
            const textColor = getContrastColor(schedule.shift.color);
            content = (
              <div
                className="cal-sched w-full h-full flex items-center justify-center"
                style={{ background: color, borderRadius: 4 }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: textColor }}>
                  {shortShiftName(schedule.shift.name)}
                </span>
              </div>
            );
          } else {
            content = <span className="text-text-4 text-xs">-</span>;
          }

          // 整格是一个原生 button：可用 Tab 聚焦、指向键在格间移动、Enter/空格等同点击
          return (
            <button
              type="button"
              data-cal-row={row}
              data-cal-col={day - 1}
              aria-label={label}
              className="cal-cell"
              // roving tabindex：只有活动格可 Tab 到达，其余靠方向键移动
              tabIndex={row === focusRow && day - 1 === focusCol ? 0 : -1}
              onFocus={() => setActiveCell({ row, col: day - 1 })}
              onClick={(e) => {
                // td 上还挂着 onClick，这里阻止冒泡避免一次点击触发两次操作
                e.stopPropagation();
                handleCellClick(record, dateStr);
              }}
              onKeyDown={(e) => handleCellKeyDown(e, row, day - 1)}
            >
              {content}
            </button>
          );
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
    filteredEmployees.length,
    focusRow,
    focusCol,
    activeHeadDay,
    handleHeaderClick,
    handleCellClick,
    handleCellKeyDown,
  ]);

  // ============ 渲染 ============

  const monthLabel = `${viewYear} 年 ${viewMonth + 1} 月`;

  return (
      <PageContainer >
        {/* 顶部工具栏（与全站 ProTable 工具栏一致的灰阶分区） */}
        <div className="pro-toolbar pro-toolbar-wrap pro-toolbar-rounded mb-3">
          <Space wrap>
            <Button
              icon={<IconLeft />}
              onClick={goPrevMonth}
              disabled={matrixLoading}
              aria-label="上一月"
            />
            <Text bold className="min-w-[110px] text-center inline-block">
              {monthLabel}
            </Text>
            <Button
              icon={<IconRight />}
              onClick={goNextMonth}
              disabled={matrixLoading}
              aria-label="下一月"
            />
            {/* 月份直选：翻十几个月时不用一格一格点箭头 */}
            <DatePicker.MonthPicker
              value={`${viewYear}-${pad2(viewMonth + 1)}`}
              format="YYYY-MM"
              allowClear={false}
              style={{ width: 120 }}
              onChange={(v: string) => {
                if (!v) return;
                const [y, m] = v.split('-').map(Number);
                if (!y || !m) return;
                setViewYear(y);
                setViewMonth(m - 1);
              }}
            />
            <Button
              onClick={() => {
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              disabled={matrixLoading || (viewYear === today.getFullYear() && viewMonth === today.getMonth())}
            >
              回到今天
            </Button>
            <Button
              icon={<IconRefresh />}
              onClick={retryAll}
              loading={matrixLoading || leavesLoading || shiftsLoading}
            >
              刷新
            </Button>
            {/* 导入排班是考勤管理写操作：无权限不渲染（下载模板/导出为查看类，不受限） */}
            <PermissionGate code="attendance:manage">
              <Button onClick={handleImport} loading={importing}>
                导入
              </Button>
            </PermissionGate>
            <Button onClick={handleDownloadImportTemplate}>下载模板</Button>
            <Button onClick={handleExport}>导出 Excel</Button>
          </Space>

          <Space wrap>
            <Text className="text-text-3">部门</Text>
            <Select
              value={selectedDeptId}
              onChange={(v: number | undefined) => setSelectedDeptId(v)}
              style={{ width: 180 }}
              placeholder="全部部门"
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
            {/* 印章模式是批量写排班入口：无 attendance:manage 不渲染 */}
            <PermissionGate code="attendance:manage">
              <Text className="text-text-3">印章模式</Text>
              <Switch checked={stampMode} onChange={setStampMode} />
            </PermissionGate>
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
                          border: '1px solid var(--lx-border-2)',
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
            {/* 新增排班是考勤管理写操作：无权限不渲染 */}
            <PermissionGate code="attendance:manage">
              {!stampMode && (
                <Button type="primary" icon={<IconPlus />} onClick={openCreateModal}>
                  新增排班
                </Button>
              )}
            </PermissionGate>
          </Space>
        </div>

        {/* 模式提示 + 班次图例 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 mb-3 bg-bg-page rounded-md">
          <Text className="text-xs text-text-3">
            {stampMode
              ? `印章模式：${stampValue === undefined ? '请选择班次印章' : stampValue === 'clear' ? '点击单元格清除排班，点击表头清除当日当前筛选的排班' : `点击单元格排班，点击表头对当日当前筛选的 ${filteredEmployees.length} 人批量排班`}`
              : `弹窗模式：点击单元格编辑单人排班，点击表头对当日当前筛选的 ${filteredEmployees.length} 人批量排班`}
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
              橙色底 = 已审批请假
            </Tag>
          </Space>
        </div>

        {/* 数据加载失败：页面内常驻横幅 + 重试（toast 一闪而过会让人以为真的没数据） */}
        {loadError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 mb-3 px-4 py-2.5 rounded-md border border-danger-2 bg-danger-light text-danger text-sm"
          >
            <span>{loadError}</span>
            <Button size="small" onClick={retryAll}>
              重试
            </Button>
          </div>
        )}

        {/* 日历表格（统一 Pro 卡片外壳） */}
        <div
          ref={tableWrapRef}
          className="bg-surface border border-border-1 rounded-md overflow-hidden shadow-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          tabIndex={0}
          role="region"
          aria-label="排班日历，可用左右方向键横向滚动"
          onKeyDown={(e) => {
            const el = getHScrollEl();
            if (!el) return;
            // 键盘用户无法拖动固定底部长条，这里用方向键横向浏览月份格子
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              el.scrollLeft += e.key === 'ArrowLeft' ? -120 : 120;
              syncHScroll();
            }
          }}
        >
          {initialLoading ? (
            <div className="py-16 flex justify-center">
              <LoaderDots text="正在加载排班数据" />
            </div>
          ) : matrix == null && matrixError ? (
            // 只有「从没成功加载过」才用错误占位；已有数据时后台刷新失败仍展示表格，
            // 否则一次网络抖动就会把整张表（和用户刚写入的排班）一起藏掉
            <div className="py-16 text-center text-text-3 text-sm">数据加载失败，请点击重试</div>
          ) : (
            <Table
              columns={columns}
              data={filteredEmployees}
              rowKey="id"
              loading={matrixLoading && filteredEmployees.length > 0}
              pagination={false}
              scroll={{ x: 140 + 52 * daysInMonth }}
              border={{ wrapper: true, cell: true }}
              size="small"
              hover={false}
              noDataElement={selectedDeptId === undefined ? '当前范围暂无员工' : '当前部门暂无员工'}
            />
          )}
        </div>

        {/* 固定底部横向滚动条：无需滚到表格底部即可切换日期 */}
        <HSyncBar
          visible={hScroll.scrollWidth > hScroll.clientWidth + 2}
          scrollLeft={hScroll.scrollLeft}
          scrollWidth={hScroll.scrollWidth}
          clientWidth={hScroll.clientWidth}
          onSeek={handleHSeek}
        />

        {batchLoading && (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-overlay-soft z-[1001]">
            <LoaderDots text="批量操作中..." />
          </div>
        )}

        {/* 排班编辑弹窗 */}
        <ScheduleEditModal
          modal={modal}
          shifts={shifts}
          monthStart={monthStart}
          monthEnd={monthEnd}
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

        {/* 导入用的隐藏文件选择器：之前只声明 ref 没渲染 input，导致「导入」按钮点了没反应 */}
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          aria-label="选择排班导入文件"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 清空 value，允许再次选择同一个文件
            e.target.value = '';
            if (file) void handleImportFile(file);
          }}
        />
      </PageContainer>
  );
}

// ============ 弹窗子组件 ============

interface ScheduleEditModalProps {
  modal: CellModalState;
  shifts: Shift[];
  /** 当前查看月份区间：新增排班的日期不能选到看不见的月份 */
  monthStart: string;
  monthEnd: string;
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
  monthStart,
  monthEnd,
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
      okText={isHeader ? '批量排班' : '保存'}
      cancelText="取消"
      maskClosable={false}
      style={{ width: 460 }}
    >
      <div className="flex flex-col gap-4 pt-1">
        {isHeader && (
          <div className="p-2.5 px-3 bg-bg-page rounded-md text-xs text-text-2">
            将对当前筛选范围内所有员工在 <b>{modal.workDate}</b> 批量排班；已有排班会被覆盖。          </div>
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
            <Input value={isCell ? modal.employeeName || '' : '当前筛选人员'} disabled />
          </FieldRow>
        )}

        {/* 日期 */}
        {isCreate ? (
          <FieldRow label="日期">
            <DatePicker
              style={{ width: '100%' }}
              value={modal.workDate}
              format="YYYY-MM-DD"
              disabledDate={(current) => {
                const d = current.format('YYYY-MM-DD');
                return d < monthStart || d > monthEnd;
              }}
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
                      border: '1px solid var(--lx-border-2)',
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
      aria-hidden="true"
      onPointerDown={(e) => {
        // setPointerCapture：快速拖动时指针移出长条不再中断拖拽，
        // 把后续 pointermove 事件持续锁在本元素上直到 pointerup
        e.currentTarget.setPointerCapture?.(e.pointerId);
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
      onPointerCancel={() => {
        draggingRef.current = false;
      }}
    >
      <div
        className="h-2 rounded-full bg-overlay-strong backdrop-blur border border-border-1 shadow-md flex items-center"
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
