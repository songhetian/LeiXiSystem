import { useState } from 'react';
import { toast } from 'sonner';
import { ScanFace, Download } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useCreateMakeup, useMakeups, useSetMakeupStatus } from './hooks';
import { downloadExport } from '../../lib/exportDownload';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';

const STATUS: Record<string, { text: string; tone: string }> = {
  pending: { text: '待审批', tone: 'warning' },
  approved: { text: '已批准', tone: 'success' },
  rejected: { text: '已驳回', tone: 'danger' },
};

const CLOCK_TYPES: Record<string, { label: string; value: string }> = {
  check_in: { label: '上班打卡', value: 'check_in' },
  check_out: { label: '下班打卡', value: 'check_out' },
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** 补卡申请表单：日期 + 打卡类型 + 时间 + 事由；部门由后端强制写入 */
function MakeupCreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateMakeup();
  const [recordDate, setRecordDate] = useState(today());
  const [clockType, setClockType] = useState<'check_in' | 'check_out'>('check_in');
  const [clockTime, setClockTime] = useState('09:00');
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!recordDate) return toast.error('请选择补卡日期');
    if (!clockTime) return toast.error('请选择补卡时间');
    if (!reason.trim()) return toast.error('请填写补卡事由');
    try {
      await create.mutateAsync({ recordDate, clockType, clockTime, reason: reason.trim() });
      toast.success('补卡申请已提交');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="补卡申请"
      description="补充因请假、漏打等原因未记录的打卡；部门由后端强制写入"
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
        <Field label="补卡日期" required>
          <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
        </Field>
        <Field label="打卡类型" required>
          <Select
            value={clockType}
            onChange={(v) => setClockType(v as 'check_in' | 'check_out')}
            options={Object.values(CLOCK_TYPES)}
          />
        </Field>
        <Field label="补卡时间（HH:mm）" required>
          <Input type="time" value={clockTime} onChange={(e) => setClockTime(e.target.value)} />
        </Field>
        <Field label="补卡事由" required>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="如：设备故障漏打卡 / 出差补卡"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function MakeupsPage() {
  const makeupsQ = useMakeups();
  const makeups = makeupsQ.data?.makeups ?? [];
  const canCreate = useCan('makeup_create');
  const canApprove = useCan('makeup_approve');
  const setStatus = useSetMakeupStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 导出补卡记录列表
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadExport('/api/export/makeups');
      toast.success('补卡记录已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const onSetStatus = (id: number, status: 'approved' | 'rejected', label: string) => {
    if (!window.confirm(`确认${label}该补卡申请吗？`)) return;
    setStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast.success(`补卡申请${label}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : '操作失败'),
      },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="补卡管理"
        description="补卡申请与审批 —— 部门数据隔离，仅展示「本部门 + 下属部门」的补卡记录。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? '导出中…' : '导出'}
            </Button>
            {canCreate && (
              <Button onClick={() => setModalOpen(true)}>
                <ScanFace className="h-4 w-4" />
                补卡申请
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader title="补卡记录" description={`当前作用域内共 ${makeups.length} 条`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>补卡日期</TH>
            <TH>打卡类型</TH>
            <TH>补卡时间</TH>
            <TH>事由</TH>
            <TH>申请人</TH>
            <TH>所属部门</TH>
            <TH>状态</TH>
            <TH className="w-36">操作</TH>
          </THead>
          <tbody>
            {makeups.map((m) => {
              const st = STATUS[m.status] ?? { text: m.status, tone: 'neutral' as const };
              const ct = CLOCK_TYPES[m.clockType] ?? { label: m.clockType, value: m.clockType };
                return (
                <Row key={m.id}>
                  <TD className="font-mono text-xs text-stone-400">#{m.id}</TD>
                  <TD className="whitespace-nowrap font-medium text-ink">{m.recordDate}</TD>
                  <TD className="text-stone-700">{ct.label}</TD>
                  <TD className="font-mono text-stone-700">{m.clockTime}</TD>
                  <TD className="max-w-xs truncate text-stone-600" title={m.reason}>
                    {m.reason}
                  </TD>
                  <TD className="font-medium text-ink">{m.applicantName}</TD>
                  <TD className="text-stone-500">{m.departmentName}</TD>
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
                    {canApprove && m.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onSetStatus(m.id, 'approved', '批准')}
                        >
                          批准
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onSetStatus(m.id, 'rejected', '驳回')}
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
        {makeups.length === 0 && <Empty>当前作用域内暂无补卡记录</Empty>}
      </Panel>

      {modalOpen && <MakeupCreateModal onClose={() => setModalOpen(false)} />}
    </PageShell>
  );
}