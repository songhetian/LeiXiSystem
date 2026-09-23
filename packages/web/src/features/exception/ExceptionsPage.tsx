import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldAlert, RefreshCw, Check, X, FileWarning, Download } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useExceptions, useScanExceptions, useSetExceptionStatus } from './hooks';
import { AT_EXCEPTION_TYPES, AT_EXCEPTION_STATUS } from './api';
import { downloadExport } from '../../lib/exportDownload';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';
import type { AttendanceExceptionView } from '@leixi/shared';

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  dismissed: 'bg-stone-100 text-stone-500',
};
const STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  confirmed: '已确认',
  dismissed: '已驳回',
};
const TYPE_LABEL: Record<string, string> = {
  late: '迟到',
  early_leave: '早退',
  missing_punch: '缺卡',
  absent: '缺勤',
};

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function firstDayOfMonth(): string {
  return `${today().slice(0, 8)}01`;
}

/** 扫描异常：选择日期区间，后端基于排班+打卡+设置自动判定 */
function ScanModal({ onClose }: { onClose: () => void }) {
  const scan = useScanExceptions();
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());

  const submit = async () => {
    if (!startDate || !endDate) return toast.error('请选择日期区间');
    if (endDate < startDate) return toast.error('结束日期不能早于开始日期');
    try {
      const r = await scan.mutateAsync({ startDate, endDate });
      toast.success(`扫描完成：新增 ${r.created} 条，更新 ${r.updated} 条`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '扫描失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="扫描考勤异常"
      description="仅对有排班的员工判定异常；休息日与无排班日期不判定"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={scan.isPending}>
            {scan.isPending ? '扫描中…' : '开始扫描'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="开始日期" required>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="结束日期" required>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-faint">
          判定规则：迟到/早退按排班预期时间与考勤设置阈值计算；到岗却缺上下班卡记「缺卡」；非休息日完全无打卡记「缺勤」。
        </p>
      </div>
    </Modal>
  );
}

export function ExceptionsPage() {
  const canManage = useCan('att_exception_manage');
  const [filters, setFilters] = useState<{ status?: string; type?: string }>({});
  const [scanOpen, setScanOpen] = useState(false);
  const exceptionsQ = useExceptions(filters);
  const exceptions = exceptionsQ.data?.exceptions ?? [];
  const setStatus = useSetExceptionStatus();

  const pendingCount = exceptions.filter((e) => e.status === 'pending').length;
  const [exporting, setExporting] = useState(false);

  // 导出异常记录列表
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadExport('/api/export/exceptions');
      toast.success('异常记录已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const onSetStatus = (e: AttendanceExceptionView, status: 'confirmed' | 'dismissed', remark?: string) => {
    const label = status === 'confirmed' ? '确认' : '驳回';
    if (!window.confirm(`确定${label}该考勤异常吗？`)) return;
    setStatus.mutate(
      { id: e.id, status, remark },
      {
        onSuccess: () => toast.success(`异常已${label}`),
        onError: (err) => toast.error(err instanceof Error ? err.message : '操作失败'),
      },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="考勤异常"
        description="基于排班与打卡自动判定迟到/早退/缺卡/缺勤，支持人工确认或驳回 —— 部门数据隔离。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? '导出中…' : '导出'}
            </Button>
            {canManage && (
              <Button onClick={() => setScanOpen(true)}>
                <FileWarning className="h-4 w-4" />
                扫描异常
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader
          title="异常记录"
          description={`当前作用域内 ${exceptions.length} 条，待处理 ${pendingCount} 条`}
          extra={
            <div className="flex w-80 gap-2">
              <Select
                value={filters.type ?? ''}
                onChange={(v) => setFilters((f) => ({ ...f, type: String(v) || undefined }))}
                options={[{ value: '', label: '全部类型' }, ...AT_EXCEPTION_TYPES]}
              />
              <Select
                value={filters.status ?? ''}
                onChange={(v) => setFilters((f) => ({ ...f, status: String(v) || undefined }))}
                options={AT_EXCEPTION_STATUS}
              />
            </div>
          }
        />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>日期</TH>
            <TH>类型</TH>
            <TH>详情</TH>
            <TH>员工</TH>
            <TH>所属部门</TH>
            <TH>状态</TH>
            <TH className="w-40">操作</TH>
          </THead>
          <tbody>
            {exceptions.map((e) => {
              const detail =
                e.minutes != null
                  ? `${e.minutes} 分钟`
                  : e.type === 'missing_punch'
                    ? '缺一次打卡'
                    : '无打卡记录';
              return (
                <Row key={e.id}>
                  <TD className="font-mono text-xs text-stone-400">#{e.id}</TD>
                  <TD className="whitespace-nowrap font-medium text-ink">{e.date}</TD>
                  <TD>
                    <span className="inline-flex items-center gap-1 font-medium text-ink">
                      <ShieldAlert className="h-3.5 w-3.5 text-stone-400" />
                      {TYPE_LABEL[e.type] ?? e.type}
                    </span>
                  </TD>
                  <TD className="text-stone-600">{detail}</TD>
                  <TD className="font-medium text-ink">{e.userName}</TD>
                  <TD className="text-stone-500">{e.departmentName}</TD>
                  <TD>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_TONE[e.status] ?? 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {STATUS_TEXT[e.status] ?? e.status}
                    </span>
                  </TD>
                  <TD>
                    {canManage && e.status === 'pending' ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => onSetStatus(e, 'confirmed')}>
                          <Check className="h-3.5 w-3.5" />
                          确认
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => onSetStatus(e, 'dismissed')}>
                          <X className="h-3.5 w-3.5" />
                          驳回
                        </Button>
                      </div>
                    ) : e.remark ? (
                      <span className="text-xs text-stone-400" title={e.remark}>
                        {e.remark}
                      </span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </TD>
                </Row>
              );
            })}
          </tbody>
        </Table>
        {exceptions.length === 0 && (
          <Empty>
            <RefreshCw className="mx-auto mb-2 h-8 w-8 text-stone-300" />
            暂无异常记录，可点击右上角「扫描异常」触发判定
          </Empty>
        )}
      </Panel>

      {scanOpen && <ScanModal onClose={() => setScanOpen(false)} />}
    </PageShell>
  );
}