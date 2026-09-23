import { useState } from 'react';
import { toast } from 'sonner';
import { Check, CalendarPlus, Download, X } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useLeaves, useCreateLeave, useUpdateLeaveStatus } from './hooks';
import { downloadExport } from '../../lib/exportDownload';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { Field, Select, Textarea, Input } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty, RowActions } from '../../components/ui/table';
import { Pagination } from '../../components/ui/pagination';

const PAGE_SIZE = 8;

const STATUS: Record<string, { text: string; tone: 'warn' | 'success' | 'danger' }> = {
  pending: { text: '待审批', tone: 'warn' },
  approved: { text: '已批准', tone: 'success' },
  rejected: { text: '已驳回', tone: 'danger' },
};

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

/** 发起请假表单（部门由后端强制写入，前端不传） */
function LeaveCreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateLeave();
  const [type, setType] = useState('事假');
  const [reason, setReason] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  const submit = async () => {
    if (!reason.trim()) return toast.error('请填写请假事由');
    if (!startAt || !endAt) return toast.error('请选择起止日期');
    try {
      await create.mutateAsync({ type, reason: reason.trim(), startAt, endAt });
      toast.success('请假已提交');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="发起请假"
      description="部门由系统按当前账号自动记录"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? '提交中…' : '提交'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="类型">
          <Select
            value={type}
            onChange={(v) => setType(String(v))}
            options={[
              { value: '事假', label: '事假' },
              { value: '病假', label: '病假' },
              { value: '年假', label: '年假' },
            ]}
          />
        </Field>
        <Field label="事由" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="请简述请假原因" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="开始日期" required>
            <Input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </Field>
          <Field label="结束日期" required>
            <Input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export function LeavePage() {
  const leavesQ = useLeaves();
  const leaves = leavesQ.data?.leaves ?? [];
  const canCreate = useCan('leave_create');
  const canApprove = useCan('leave_approve');
  const approve = useUpdateLeaveStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 导出请假记录（后端返回 CSV/xlsx 二进制流）
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadExport('/api/export/leaves');
      toast.success('请假记录已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const [page, setPage] = useState(1);
  const total = leaves.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = leaves.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const onApprove = (id: number) => onSetStatus(id, 'approved', '批准');
  const onReject = (id: number) => onSetStatus(id, 'rejected', '驳回');

  const onSetStatus = (id: number, status: 'approved' | 'rejected', label: string) => {
    if (!window.confirm(`确认${label}该请假单吗？`)) return;
    approve.mutate(
      { id, status },
      { onSuccess: () => toast.success(`请假单已${label}`), onError: (e) => toast.error(e.message) },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="请假管理"
        description="部门数据隔离 —— 仅展示「本部门 + 下属部门」的请假单，跨部门不可见。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? '导出中…' : '导出'}
            </Button>
            {canCreate && (
              <Button onClick={() => setModalOpen(true)}>
                <CalendarPlus className="h-4 w-4" />
                发起请假
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader title="请假记录" description={`当前作用域内共 ${leaves.length} 条`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>申请人</TH>
            <TH>所属部门</TH>
            <TH>类型</TH>
            <TH>事由</TH>
            <TH>日期区间</TH>
            <TH>状态</TH>
            {canApprove && <TH className="text-right">操作</TH>}
          </THead>
          <tbody>
            {paged.map((l) => {
              const st = STATUS[l.status] ?? { text: l.status, tone: 'neutral' as const };
              return (
                <Row key={l.id}>
                  <TD className="font-mono text-xs text-stone-400">#{l.id}</TD>
                  <TD className="font-medium text-ink">{l.applicantName}</TD>
                  <TD className="text-stone-500">{l.departmentName}</TD>
                  <TD className="text-stone-700">{l.type}</TD>
                  <TD className="max-w-xs truncate text-stone-600" title={l.reason}>
                    {l.reason}
                  </TD>
                  <TD className="whitespace-nowrap font-mono text-xs text-stone-500">
                    {fmtDate(l.startAt)} ~ {fmtDate(l.endAt)}
                  </TD>
                  <TD>
                    <Badge tone={st.tone} dot>
                      {st.text}
                    </Badge>
                  </TD>
                  {canApprove && (
                    <TD>
                      {l.status === 'pending' ? (
                        <RowActions>
                          <Button size="sm" variant="secondary" onClick={() => onApprove(l.id)}>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            批准
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => onReject(l.id)}>
                            <X className="h-3.5 w-3.5" />
                            驳回
                          </Button>
                        </RowActions>
                      ) : (
                        <div className="text-right text-xs text-stone-300">—</div>
                      )}
                    </TD>
                  )}
                </Row>
              );
            })}
          </tbody>
        </Table>
        {leaves.length === 0 && <Empty>当前作用域内暂无请假记录</Empty>}
        {leaves.length > 0 && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Panel>

      {modalOpen && <LeaveCreateModal onClose={() => setModalOpen(false)} />}
    </PageShell>
  );
}