import { useState } from 'react';
import { toast } from 'sonner';
import { Fingerprint, Download } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useAttendance, useAttendanceStats, useCreateAttendance } from './hooks';
import type { AttendanceStatsRow } from '@leixi/shared';
import { downloadExport } from '../../lib/exportDownload';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Input } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';
import { Pagination } from '../../components/ui/pagination';

const PAGE_SIZE = 10;

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 打卡表单（部门由后端强制写入，前端不传） */
function AttendanceCreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAttendance();
  const [date, setDate] = useState(today());
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [note, setNote] = useState('');

  const submit = async () => {
    if (!date) return toast.error('请选择打卡日期');
    if (!checkIn && !checkOut) return toast.error('请至少填写上班或下班时间');
    try {
      await create.mutateAsync({
        date,
        checkIn: checkIn || null,
        checkOut: checkOut || null,
        note: note.trim() || undefined,
      });
      toast.success('打卡成功');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '打卡失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="考勤打卡"
      description="记录上下班时间与备注，部门由系统按当前账号自动记录"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? '提交中…' : '打卡'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="日期" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="上班时间（HH:mm）">
            <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </Field>
          <Field label="下班时间（HH:mm）">
            <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </Field>
        </div>
        <Field label="备注">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选，如：外出办公 / 加班" />
        </Field>
      </div>
    </Modal>
  );
}

export function AttendancesPage() {
  const attendanceQ = useAttendance();
  const attendance = attendanceQ.data?.attendance ?? [];
  const canPunch = useCan('attendance_punch');
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 导出打卡记录列表
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadExport('/api/export/attendances');
      toast.success('打卡记录已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const [page, setPage] = useState(1);
  const total = attendance.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = attendance.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const fmtTime = (t: string | null) => (t ? t : <span className="text-stone-300">—</span>);

  return (
    <PageShell>
      <PageHeader
        title="考勤管理"
        description="部门数据隔离 —— 仅展示「本部门 + 下属部门」的打卡记录，跨部门不可见。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? '导出中…' : '导出'}
            </Button>
            {canPunch && (
              <Button onClick={() => setModalOpen(true)}>
                <Fingerprint className="h-4 w-4" />
                考勤打卡
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader title="打卡记录" description={`当前作用域内共 ${attendance.length} 条`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>日期</TH>
            <TH>上班</TH>
            <TH>下班</TH>
            <TH>备注</TH>
            <TH>申请人</TH>
            <TH>所属部门</TH>
          </THead>
          <tbody>
            {paged.map((l) => (
              <Row key={l.id}>
                <TD className="font-mono text-xs text-stone-400">#{l.id}</TD>
                <TD className="whitespace-nowrap font-medium text-ink">{l.date}</TD>
                <TD className="whitespace-nowrap font-mono text-stone-700">{fmtTime(l.checkIn)}</TD>
                <TD className="whitespace-nowrap font-mono text-stone-700">{fmtTime(l.checkOut)}</TD>
                <TD className="max-w-xs truncate text-stone-600" title={l.note || undefined}>
                  {l.note || <span className="text-stone-300">—</span>}
                </TD>
                <TD className="font-medium text-ink">{l.applicantName}</TD>
                <TD className="text-stone-500">{l.departmentName}</TD>
              </Row>
            ))}
          </tbody>
        </Table>
        {attendance.length === 0 && <Empty>当前作用域内暂无打卡记录</Empty>}
        {attendance.length > 0 && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Panel>

      <AttendanceStatsPanel />

      {modalOpen && <AttendanceCreateModal onClose={() => setModalOpen(false)} />}
    </PageShell>
  );
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 考勤统计报表：按员工×月份聚合（对齐旧版部门统计） */
function AttendanceStatsPanel() {
  const [month, setMonth] = useState(currentMonth());
  const statsQ = useAttendanceStats(month);
  const stats: AttendanceStatsRow[] = statsQ.data?.stats ?? [];
  const [exportingStats, setExportingStats] = useState(false);

  // 导出所选月份的考勤统计报表
  const onExportStats = async () => {
    setExportingStats(true);
    try {
      await downloadExport(`/api/export/attendance-stats?month=${month}`);
      toast.success('考勤统计报表已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExportingStats(false);
    }
  };

  const summarize = (fn: (s: AttendanceStatsRow) => number) =>
    stats.reduce((acc, s) => acc + fn(s), 0);

  return (
    <Panel>
      <PanelHeader
        title="考勤统计报表"
        description={`${month} 员工出勤汇总（正常/迟到/早退/工时）`}
        extra={
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40"
            />
            <Button
              variant="secondary"
              onClick={onExportStats}
              disabled={exportingStats}
              className="whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              {exportingStats ? '导出中…' : '导出报表'}
            </Button>
          </div>
        }
      />
      {stats.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-3">
          <StatCard label="出勤人次" value={String(summarize((s) => s.presentDays))} />
          <StatCard label="正常出勤（人次）" value={String(summarize((s) => s.normalDays))} />
          <StatCard label="迟到（人次）" value={String(summarize((s) => s.lateCount))} />
          <StatCard label="早退（人次）" value={String(summarize((s) => s.earlyLeaveCount))} />
        </div>
      )}
      <Table>
        <THead>
          <TH>员工</TH>
          <TH>部门</TH>
          <TH>出勤天数</TH>
          <TH>正常</TH>
          <TH>迟到</TH>
          <TH>早退</TH>
          <TH>平均工时(h)</TH>
          <TH>累计工时(h)</TH>
        </THead>
        <tbody>
          {stats.map((s) => (
            <Row key={`${s.userId}-${s.month}`}>
              <TD className="font-medium text-ink">{s.userName}</TD>
              <TD className="text-stone-500">{s.departmentName}</TD>
              <TD className="font-mono text-stone-700">{s.presentDays}</TD>
              <TD className="font-mono text-stone-700">{s.normalDays}</TD>
              <TD className="font-mono text-stone-700">{s.lateCount}</TD>
              <TD className="font-mono text-stone-700">{s.earlyLeaveCount}</TD>
              <TD className="font-mono text-stone-700">{s.avgWorkHours}</TD>
              <TD className="font-mono text-stone-700">{s.totalWorkHours}</TD>
            </Row>
          ))}
        </tbody>
      </Table>
      {stats.length === 0 && !statsQ.isLoading && (
        <Empty>{month} 无考勤数据，无法生成统计</Empty>
      )}
    </Panel>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}