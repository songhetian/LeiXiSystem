import { useState } from 'react';
import { toast } from 'sonner';
import { Clock, Download } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useCreateOvertime, useOvertimes, useOvertimeStats, useSetOvertimeStatus } from './hooks';
import { downloadExport } from '../../lib/exportDownload';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Input } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';
import type { OvertimeStats } from '@leixi/shared';

const STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待审批', tone: 'warning' },
  approved: { text: '已批准', tone: 'success' },
  rejected: { text: '已驳回', tone: 'danger' },
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 加班申请表单：部门由后端强制写入 */
function OvertimeCreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateOvertime();
  const [date, setDate] = useState(today());
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('20:00');
  const [reason, setReason] = useState('');

  const computeHours = () => {
    if (!startTime || !endTime) return 0;
    const toMin = (hm: string) => Number(hm.split(':')[0]) * 60 + Number(hm.split(':')[1]);
    const diff = Math.max(0, toMin(endTime) - toMin(startTime));
    return Math.round((diff / 60) * 10) / 10;
  };
  const hours = computeHours();

  const submit = async () => {
    if (!date) return toast.error('请选择加班日期');
    if (hours <= 0) return toast.error('结束时间需晚于开始时间');
    if (!reason.trim()) return toast.error('请填写加班事由');
    try {
      await create.mutateAsync({ date, startTime, endTime, hours, reason: reason.trim() });
      toast.success('加班申请已提交');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="加班申请"
      description="记录加班日期、时间段与事由；时长按时间段自动计算"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? '提交中…' : '提交申请'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="加班日期" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="开始时间（HH:mm）" required>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="结束时间（HH:mm）" required>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          预计加班时长：<span className="font-semibold text-ink">{hours} 小时</span>
        </div>
        <Field label="加班事由" required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：版本发布 / 紧急需求" />
        </Field>
      </div>
    </Modal>
  );
}

export function OvertimesPage() {
  const overtimesQ = useOvertimes();
  const overtimes = overtimesQ.data?.overtimes ?? [];
  const canCreate = useCan('overtime_create');
  const canApprove = useCan('overtime_approve');
  const setStatus = useSetOvertimeStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingStats, setExportingStats] = useState(false);

  // 导出加班记录列表 & 当月加班统计报表
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadExport('/api/export/overtimes');
      toast.success('加班记录已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };
  const onExportStats = async () => {
    setExportingStats(true);
    try {
      await downloadExport(`/api/export/overtime-stats?month=${month}`);
      toast.success('加班统计报表已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExportingStats(false);
    }
  };

  const [month, setMonth] = useState(currentMonth());
  const statsQ = useOvertimeStats(month);
  const stats: OvertimeStats | undefined = statsQ.data?.stats;

  const onSetStatus = (id: number, status: 'approved' | 'rejected', label: string) => {
    if (!window.confirm(`确认${label}该加班单吗？`)) return;
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`加班单${label}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : '操作失败'),
      },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="加班管理"
        description="加班申请与审批 —— 部门数据隔离，仅展示「本部门 + 下属部门」的加班单。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? '导出中…' : '导出'}
            </Button>
            <Button variant="secondary" onClick={onExportStats} disabled={exportingStats}>
              <Download className="h-4 w-4" />
              {exportingStats ? '导出中…' : '导出报表'}
            </Button>
            {canCreate && (
              <Button onClick={() => setModalOpen(true)}>
                <Clock className="h-4 w-4" />
                加班申请
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader
          title="加班统计"
          description={`${month} 加班汇总`}
          extra={
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-40"
            />
          }
        />
        {stats && (
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatCard label="已批加班时长(h)" value={String(stats.totalHours)} />
            <StatCard label="已批次数" value={String(stats.approvedCount)} />
            <StatCard label="待审批" value={String(stats.pendingCount)} />
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="加班记录" description={`当前作用域内共 ${overtimes.length} 条`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>日期</TH>
            <TH>时段</TH>
            <TH>时长</TH>
            <TH>事由</TH>
            <TH>申请人</TH>
            <TH>所属部门</TH>
            <TH>状态</TH>
            <TH className="w-36">操作</TH>
          </THead>
          <tbody>
            {overtimes.map((o) => {
              const st = STATUS[o.status] ?? { text: o.status, tone: 'neutral' as const };
              return (
                <Row key={o.id}>
                  <TD className="font-mono text-xs text-stone-400">#{o.id}</TD>
                  <TD className="whitespace-nowrap font-medium text-ink">{o.date}</TD>
                  <TD className="whitespace-nowrap font-mono text-stone-700">
                    {o.startTime} ~ {o.endTime}
                  </TD>
                  <TD className="font-mono text-stone-700">{o.hours} h</TD>
                  <TD className="max-w-xs truncate text-stone-600" title={o.reason}>
                    {o.reason}
                  </TD>
                  <TD className="font-medium text-ink">{o.applicantName}</TD>
                  <TD className="text-stone-500">{o.departmentName}</TD>
                  <TD>
                    <span
                      className={
                        st.tone === 'success'
                          ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          : st.tone === 'danger'
                            ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'
                            : 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700'
                      }
                    >
                      {st.text}
                    </span>
                  </TD>
                  <TD>
                    {canApprove && o.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onSetStatus(o.id, 'approved', '批准')}
                        >
                          批准
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onSetStatus(o.id, 'rejected', '驳回')}
                        >
                          驳回
                        </Button>
                      </div>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </TD>
                </Row>
              );
            })}
          </tbody>
        </Table>
        {overtimes.length === 0 && <Empty>当前作用域内暂无加班记录</Empty>}
      </Panel>

      {modalOpen && <OvertimeCreateModal onClose={() => setModalOpen(false)} />}
    </PageShell>
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