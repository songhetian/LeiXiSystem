import { Fragment, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarRange,
  Download,
  Upload,
  Users,
  Copy,
  Wand2,
  RefreshCw,
  BarChart3,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ScheduleView } from '@leixi/shared';
import { useCan } from '../auth/permission';
import {
  useSchedules,
  useShifts,
  useBatchSchedules,
  useCopyTemplate,
  useSmartSchedule,
  useDeleteSchedule,
  useUpsertSchedule,
  useScheduleStats,
  useValidateSchedules,
} from './hooks';
import { exportSchedules, exportScheduleStats, importSchedules, type ScheduleBatchIssue } from './api';
import { useUsers } from '../rbac/hooks';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function monthStart(): string {
  const d = new Date();
  return toStr(new Date(d.getFullYear(), d.getMonth(), 1));
}
function monthEnd(): string {
  const d = new Date();
  return toStr(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
/** 返回 [start,end] 每日的 YYYY-MM-DD 数组 */
function eachDate(start: string, end: string): string[] {
  const arr: string[] = [];
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  for (; cur <= last; cur.setDate(cur.getDate() + 1)) arr.push(toStr(cur));
  return arr;
}
/** 从 dateStr 起往前后偏移 days 天，返回 YYYY-MM-DD */
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toStr(d);
}

/** 员工下拉选项（激活状态） */
function useEmployeeOptions() {
  const { data: usersQ } = useUsers();
  const users = usersQ?.users ?? [];
  return users
    .filter((u) => u.status === 'active')
    .map((u) => ({ value: u.id, label: `${u.realName}（${u.username}）` }));
}

/** 班次下拉选项：null 值表示「休息日」 */
function useShiftOptions() {
  const shiftsQ = useShifts();
  const shifts = shiftsQ.data?.shifts ?? [];
  return [
    { value: '', label: '休息日' },
    ...shifts
      .filter((s) => s.isActive)
      .sort((a, b) => a.id - b.id)
      .map((s) => ({
        value: s.id,
        label: `${s.name}（${s.startTime}-${s.endTime}）`,
      })),
  ];
}

/** 日历格子点选 Modal：为某员工×某日期 选班次/设休息；已有排班可删除 */
function CellModal({
  user,
  date,
  record,
  onClose,
}: {
  user: { userId: number; userName: string };
  date: string;
  record: ScheduleView | null;
  onClose: () => void;
}) {
  const upsert = useUpsertSchedule();
  const del = useDeleteSchedule();
  const shifts = useShiftOptions();
  const [shiftId, setShiftId] = useState<number | ''>(
    record?.isRestDay ? '' : record?.shiftId ?? '',
  );

  const submit = async () => {
    try {
      const isRestDay = shiftId === '';
      await upsert.mutateAsync({
        userId: user.userId,
        shiftId: shiftId === '' ? null : Number(shiftId),
        scheduleDate: date,
        isRestDay,
      });
      toast.success('排班已更新');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  const onDelete = async () => {
    if (!record) return;
    try {
      await del.mutateAsync(record.id);
      toast.success('排班已删除');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="设置排班"
      description={`${user.userName} · ${date}`}
      footer={
        <>
          {record && (
            <Button variant="danger" onClick={onDelete} disabled={del.isPending}>
              删除该排班
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={upsert.isPending}>
            {upsert.isPending ? '提交中…' : '保存'}
          </Button>
        </>
      }
    >
      <Field label="班次 / 休息" required>
        <Select value={shiftId} onChange={(v) => setShiftId(Number(v))} options={shifts} placeholder="选择班次" />
      </Field>
    </Modal>
  );
}

/** 待提交排班草稿行：供生成后二次编辑（增删行）。key 用于去重/列表 key */
interface ScheduleDraft {
  key: string;
  userId: number;
  shiftId: number | null;
  scheduleDate: string;
  isRestDay: boolean;
}

/** validate 问题字段的中文提示 */
const issueFieldLabel: Record<ScheduleBatchIssue['field'], string> = {
  scheduleDate: '日期',
  shiftId: '班次',
  duplicateUserDate: '员工+日期重复',
};

/** 批量排班 Modal：多员工 × 班次 × 起始日期+持续天数 快速填充 → 可编辑待提交列表 → 预检/确认覆盖 → /batch */
function BatchModal({ onClose }: { onClose: () => void }) {
  const batch = useBatchSchedules();
  const validate = useValidateSchedules();
  const employees = useEmployeeOptions();
  const shifts = useShiftOptions();
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [shiftId, setShiftId] = useState<number | ''>('');
  const [start, setStart] = useState(monthStart());
  const [duration, setDuration] = useState(7);
  const [pending, setPending] = useState<ScheduleDraft[]>([]);
  const [issues, setIssues] = useState<ScheduleBatchIssue[]>([]);

  // 供列表展示的员工名/班次名映射
  const userLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(String(e.value), e.label);
    return m;
  }, [employees]);
  const shiftLabel = useMemo(() => {
    const m = new Map<string | number, { label: string }>();
    for (const s of shifts) m.set(s.value, { label: s.label });
    return m;
  }, [shifts]);

  const toggleUser = (id: number) =>
    setSelectedUsers((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /** B. 按班次填充：起始日期 + 持续天数 + 目标班次 + 一批员工 → 生成草稿行追加到列表 */
  const generate = () => {
    if (selectedUsers.length === 0) return toast.error('请至少选择一名员工');
    if (!start) return toast.error('请选择起始日期');
    if (!Number.isInteger(duration) || duration < 1) return toast.error('持续天数须为正整数');
    const dates = Array.from({ length: duration }, (_, i) => addDays(start, i));
    const seen = new Set(pending.map((r) => r.key));
    const next: ScheduleDraft[] = [];
    for (const userId of selectedUsers) {
      for (const d of dates) {
        const key = `${userId}_${d}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({
          key,
          userId,
          shiftId: shiftId === '' ? null : Number(shiftId),
          scheduleDate: d,
          isRestDay: shiftId === '',
        });
      }
    }
    if (next.length === 0) return toast.error('这些员工与日期均已存在，无需追加');
    setPending((p) => [...p, ...next]);
    toast.success(`已生成 ${next.length} 条，请二次确认后提交`);
  };

  const removeRow = (key: string) => setPending((p) => p.filter((r) => r.key !== key));
  const clearPending = () => setPending([]);

  /** A. 预检 + 覆盖确认 → C. 落地并回显 */
  const submit = async () => {
    if (pending.length === 0) return toast.error('请先生成并确认待提交排班');
    const schedules = pending.map(({ userId, shiftId: s, scheduleDate, isRestDay }) => ({
      userId,
      shiftId: s,
      scheduleDate,
      isRestDay,
    }));
    try {
      // A-1 预检：issues 逐条列在 Modal，阻断提交
      const v = await validate.mutateAsync({ schedules });
      if (!v.valid) {
        setIssues(v.issues);
        return;
      }
      // A-2 覆盖确认
      if (!window.confirm(`将写入 ${schedules.length} 条排班，确认覆盖？`)) return;
      // C 落地并回显数量
      const r = await batch.mutateAsync({ schedules });
      toast.success(`已写入 ${r.count} 条排班`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '批量排班失败');
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="批量排班"
        description="多员工按 起始日期+持续天数+班次 快速填充，可增删行；提交前预检并确认覆盖"
        width="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button variant="secondary" onClick={submit} disabled={batch.isPending || validate.isPending}>
              {validate.isPending ? '预检中…' : batch.isPending ? '提交中…' : '提交排班'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="目标员工（可多选）" required>
            {employees.length === 0 ? (
              <p className="text-sm text-muted">暂无可用员工</p>
            ) : (
              <div className="max-h-40 overflow-auto rounded-md border border-line-strong p-2">
                <div className="grid grid-cols-2 gap-1">
                  {employees.map((e) => {
                    const id = Number(e.value);
                    const checked = selectedUsers.includes(id);
                    return (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-ink hover:bg-panel-soft"
                      >
                        <input
                          type="checkbox"
                          className="accent-brand-600"
                          checked={checked}
                          onChange={() => toggleUser(id)}
                        />
                        <span className="min-w-0 truncate">{e.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </Field>
          <Field label="班次 / 休息">
            <Select value={shiftId} onChange={(v) => setShiftId(Number(v))} options={shifts} placeholder="选择班次（空=休息日）" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="起始日期" required>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="持续天数" required hint="从起始日期起连续生成几天">
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={generate} disabled={selectedUsers.length === 0}>
              <Plus className="h-4 w-4" />
              生成排班
            </Button>
            <span className="text-xs text-muted">已填 {pending.length} 条</span>
            {pending.length > 0 && (
              <Button variant="danger" size="sm" onClick={clearPending}>
                清空
              </Button>
            )}
          </div>

          {pending.length > 0 && (
            <div className="max-h-56 overflow-auto rounded-md border border-line-strong">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-strong text-left text-xs text-muted">
                    <th className="px-3 py-1.5 font-medium">员工</th>
                    <th className="px-3 py-1.5 font-medium">日期</th>
                    <th className="px-3 py-1.5 font-medium">班次</th>
                    <th className="px-3 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {pending.map((r) => (
                    <tr key={r.key} className="border-b border-line-soft">
                      <td className="whitespace-nowrap px-3 py-1.5 text-ink">
                        {userLabel.get(String(r.userId)) ?? `员工#${r.userId}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-muted">{r.scheduleDate}</td>
                      <td className="px-3 py-1.5 text-ink">
                        {shiftLabel.get(r.shiftId ?? '')?.label ?? '休息日'}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeRow(r.key)} title="删除该行">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* A-1 预检未通过：逐条列出问题，阻断提交 */}
      {issues.length > 0 && (
        <Modal
          open
          onClose={() => setIssues([])}
          title="预检未通过"
          description="下列排班无法提交，请修正后再试（可删除对应行）"
          width="max-w-lg"
          footer={
            <Button variant="secondary" onClick={() => setIssues([])}>
              知道了
            </Button>
          }
        >
          <div className="space-y-2">
            <p className="text-sm text-muted">共 {issues.length} 项问题：</p>
            <ul className="max-h-72 space-y-1 overflow-auto">
              {issues.map((it, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-md border border-line-soft px-3 py-2 text-sm text-ink"
                >
                  <span className="shrink-0 text-muted">第 {it.index + 1} 条</span>
                  <div className="min-w-0">
                    <span className="text-brand-700">[{issueFieldLabel[it.field]}]</span>
                    <span className="ml-1">{it.message}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Modal>
      )}
    </>
  );
}

/** 复制模板 Modal：source 区间复制到 target */
function CopyModal({ onClose }: { onClose: () => void }) {
  const copy = useCopyTemplate();
  const employees = useEmployeeOptions();
  const [sourceStart, setSourceStart] = useState('');
  const [sourceEnd, setSourceEnd] = useState('');
  const [targetStart, setTargetStart] = useState('');
  const [userId, setUserId] = useState<number | ''>('');

  const submit = async () => {
    if (!sourceStart || !sourceEnd || !targetStart) return toast.error('请填写完整的复制区间');
    if (targetStart < sourceStart) return toast.error('目标起始日期不能早于源起始日期');
    try {
      const r = await copy.mutateAsync({
        sourceStart,
        sourceEnd,
        targetStart,
        userIds: userId === '' ? undefined : [Number(userId)],
      });
      toast.success(`已复制 ${r.count} 条排班`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '复制失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="复制模板"
      description="将源日期区间的排班按顺序复制到目标日期"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={copy.isPending}>
            {copy.isPending ? '提交中…' : '复制'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="源开始日期" required>
            <Input type="date" value={sourceStart} onChange={(e) => setSourceStart(e.target.value)} />
          </Field>
          <Field label="源结束日期" required>
            <Input type="date" value={sourceEnd} onChange={(e) => setSourceEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="目标起始日期" required hint="源区间逐日复制到以此日为起点的区间">
          <Input type="date" value={targetStart} onChange={(e) => setTargetStart(e.target.value)} />
        </Field>
        <Field label="适用范围">
          <Select
            value={userId}
            onChange={(v) => setUserId(Number(v))}
            options={[{ value: '', label: '全部员工' }, ...employees]}
            placeholder="选择范围"
          />
        </Field>
      </div>
    </Modal>
  );
}

/** 智能生成 Modal：员工 × 班次/休息 × 日期区间 → /smart */
function SmartModal({ onClose }: { onClose: () => void }) {
  const smart = useSmartSchedule();
  const employees = useEmployeeOptions();
  const shifts = useShiftOptions();
  const [userId, setUserId] = useState<number | ''>('');
  const [shiftId, setShiftId] = useState<number | ''>('');
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(monthEnd());

  const submit = async () => {
    if (userId === '') return toast.error('请选择员工');
    if (!start || !end) return toast.error('请选择日期区间');
    if (end < start) return toast.error('结束日期不能早于开始日期');
    const rows = eachDate(start, end).map((d) => ({
      userId: Number(userId),
      shiftId: shiftId === '' ? null : Number(shiftId),
      scheduleDate: d,
      isRestDay: shiftId === '',
    }));
    try {
      const r = await smart.mutateAsync({ rows });
      toast.success(`已智能生成 ${r.count} 条排班`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '智能生成失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="智能生成"
      description="按 员工 + 班次/休息 + 日期区间 生成多行排班"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={smart.isPending}>
            {smart.isPending ? '提交中…' : '生成'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="目标员工" required>
          <Select value={userId} onChange={(v) => setUserId(Number(v))} options={employees} placeholder="选择员工" />
        </Field>
        <Field label="班次 / 休息" required>
          <Select value={shiftId} onChange={(v) => setShiftId(Number(v))} options={shifts} placeholder="选择班次" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="开始日期" required>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="结束日期" required>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** 排班统计报表 Modal：按月份聚合 出勤班次/休息/工时，支持导出 */
function StatsModal({ onClose }: { onClose: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const statsQ = useScheduleStats(month);
  const stats = statsQ.data?.stats ?? [];

  const exportNow = async (format: 'csv' | 'xlsx') => {
    try {
      const blob = await exportScheduleStats(month, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `排班统计_${month}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="排班统计"
      description="按员工 × 月份聚合出勤班次、休息天数与工时"
      width="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => void exportNow('csv')}>
            <Download className="h-4 w-4" />
            导出 CSV
          </Button>
          <Button onClick={() => void exportNow('xlsx')}>
            <Download className="h-4 w-4" />
            导出 Excel
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <span className="text-sm text-muted">
            {statsQ.isLoading ? '加载中…' : `共 ${stats.length} 名员工`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">员工</th>
                <th className="px-3 py-2 font-medium">部门</th>
                <th className="px-3 py-2 text-right font-medium">出勤班次</th>
                <th className="px-3 py-2 text-right font-medium">休息天数</th>
                <th className="px-3 py-2 text-right font-medium">总工时(小时)</th>
                <th className="px-3 py-2 text-right font-medium">平均工时(小时)</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.userId} className="border-b border-line-soft">
                  <td className="px-3 py-2 font-medium text-ink">{s.userName}</td>
                  <td className="px-3 py-2 text-muted">{s.departmentName}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.shiftDays}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.restDays}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink">{s.totalWorkHours}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{s.avgWorkHours}</td>
                </tr>
              ))}
              {stats.length === 0 && !statsQ.isLoading && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    该月份暂无排班统计
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

export function ScheduleBoardPage() {
  const canManage = useCan('shift_manage');
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(monthEnd());
  const [appliedStart, setAppliedStart] = useState(monthStart());
  const [appliedEnd, setAppliedEnd] = useState(monthEnd());

  const schedulesQ = useSchedules(appliedStart, appliedEnd);
  const schedules = schedulesQ.data?.schedules ?? [];

  const [modal, setModal] = useState<'batch' | 'copy' | 'smart' | 'stats' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // 排班矩阵：行=员工，列=日期
  const employees = useMemo(() => {
    const map = new Map<number, { userId: number; userName: string; departmentName: string }>();
    for (const s of schedules) {
      map.set(s.userId, { userId: s.userId, userName: s.userName, departmentName: s.departmentName });
    }
    return [...map.values()].sort((a, b) => a.userId - b.userId);
  }, [schedules]);

  const dates = useMemo(() => eachDate(appliedStart, appliedEnd), [appliedStart, appliedEnd]);

  const byKey = useMemo(() => {
    const m = new Map<string, ScheduleView>();
    for (const s of schedules) m.set(`${s.userId}_${s.scheduleDate}`, s);
    return m;
  }, [schedules]);

  const [cell, setCell] = useState<{
    user: { userId: number; userName: string };
    date: string;
    record: ScheduleView | null;
  } | null>(null);

  const apply = () => {
    if (!start || !end) return toast.error('请选择日期区间');
    if (end < start) return toast.error('结束日期不能早于开始日期');
    setAppliedStart(start);
    setAppliedEnd(end);
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const blob = await exportSchedules(appliedStart, appliedEnd);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `排班表_${appliedStart}_${appliedEnd}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const onImportFile = async (file: File) => {
    setImporting(true);
    try {
      const r = await importSchedules(file);
      toast.success(`导入完成：成功 ${r.count} 条，跳过 ${r.skipped} 条`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openCell = (emp: { userId: number; userName: string }, date: string) => {
    if (!canManage) return;
    setCell({ user: emp, date, record: byKey.get(`${emp.userId}_${date}`) ?? null });
  };

  return (
    <PageShell>
      <PageHeader
        title="排班管理"
        description="按日期区间维护每位员工的班次与休息日；点击日历格子即可调整，变更会实时通知对应员工。"
        action={
          <>
            <Button variant="secondary" onClick={() => setModal('stats')}>
              <BarChart3 className="h-4 w-4" />
              排班统计
            </Button>
            {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setModal('batch')}>
                <Users className="h-4 w-4" />
                批量排班
              </Button>
              <Button variant="secondary" onClick={() => setModal('copy')}>
                <Copy className="h-4 w-4" />
                复制模板
              </Button>
              <Button variant="secondary" onClick={() => setModal('smart')}>
                <Wand2 className="h-4 w-4" />
                智能生成
              </Button>
              <Button variant="secondary" onClick={onExport} disabled={exporting}>
                <Download className="h-4 w-4" />
                {exporting ? '导出中…' : '导出 Excel'}
              </Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
                <Upload className="h-4 w-4" />
                {importing ? '导入中…' : '导入 Excel'}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportFile(f);
                }}
              />
            </div>
            )}
          </>
        }
      />

      <Panel>
        <PanelHeader
          title="排班矩阵"
          description={`当前区间 ${appliedStart} ~ ${appliedEnd} · ${employees.length} 名员工 · ${schedules.length} 条排班`}
          extra={
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
              <span className="text-xs text-faint">至</span>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
              <Button variant="secondary" size="sm" onClick={apply}>
                <RefreshCw className="h-3.5 w-3.5" />
                查询
              </Button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <div
            className="grid gap-px bg-line-strong"
            style={{
              gridTemplateColumns: `150px repeat(${dates.length}, minmax(92px, 1fr))`,
              minWidth: 150 + dates.length * 92,
            }}
          >
            <div className="sticky left-0 z-10 bg-panel px-3 py-2 text-xs font-medium text-muted shadow-[1px_0_0_0_var(--color-line-strong)]">
              员工
            </div>
            {dates.map((d) => (
              <div key={d} className="bg-panel px-1 py-2 text-center">
                <div className="text-[11px] text-muted">{WEEK[new Date(`${d}T00:00:00`).getDay()]}</div>
                <div className="font-mono text-xs text-ink">{d.slice(5)}</div>
              </div>
            ))}
            {employees.map((emp) => (
              <Fragment key={emp.userId}>
                <div className="sticky left-0 z-10 bg-panel px-3 py-2 shadow-[1px_0_0_0_var(--color-line-strong)]">
                  <div className="text-sm font-medium text-ink">{emp.userName}</div>
                  <div className="text-[11px] text-muted">{emp.departmentName}</div>
                </div>
                {dates.map((d) => {
                  const rec = byKey.get(`${emp.userId}_${d}`);
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!canManage}
                      onClick={() => openCell(emp, d)}
                      className="group flex min-h-14 flex-col items-center justify-center gap-1 bg-panel px-1 py-1.5 text-center transition hover:bg-panel-soft"
                      title={canManage ? `点击设置 ${emp.userName} ${d} 的排班` : undefined}
                    >
                      {rec ? (
                        rec.isRestDay ? (
                          <Badge tone="warn" dot>
                            休
                          </Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                              style={{ background: rec.color ?? undefined }}
                            />
                            <span className="text-xs font-medium text-ink">{rec.shiftName}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-faint opacity-0 transition group-hover:opacity-100">
                          + 设置
                        </span>
                      )}
                      {rec && !rec.isRestDay && rec.startTime && (
                        <span className="text-[10px] text-muted">
                          {rec.startTime}-{rec.endTime}
                        </span>
                      )}
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        {employees.length === 0 && (
          <div className="p-6 text-center text-sm text-muted">
            {schedulesQ.isLoading ? '加载中…' : '该区间暂无排班记录'}
          </div>
        )}
      </Panel>

      {modal === 'batch' && <BatchModal onClose={() => setModal(null)} />}
      {modal === 'copy' && <CopyModal onClose={() => setModal(null)} />}
      {modal === 'smart' && <SmartModal onClose={() => setModal(null)} />}
      {modal === 'stats' && <StatsModal onClose={() => setModal(null)} />}
      {cell && (
        <CellModal user={cell.user} date={cell.date} record={cell.record} onClose={() => setCell(null)} />
      )}
    </PageShell>
  );
}