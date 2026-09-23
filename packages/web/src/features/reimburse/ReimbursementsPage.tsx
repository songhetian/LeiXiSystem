import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Plus, Receipt, Trash2, X, Download } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useReimburses, useCreateReimburse, useUpdateReimburseStatus, useCategories } from './hooks';
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

function fmtMoney(n: number): string {
  return `¥${n.toFixed(2)}`;
}

/** 空白分项行 */
interface ItemDraft {
  categoryId: number | '';
  amount: string;
  note: string;
}

function newItem(): ItemDraft {
  return { categoryId: '', amount: '', note: '' };
}

/** 发起报销表单（部门由后端强制写入，前端不传；分项类别由系统级类别下拉选择） */
function ReimburseCreateModal({ onClose }: { onClose: () => void }) {
  const create = useCreateReimburse();
  const categoriesQ = useCategories();
  // 只允许选择启用状态的类别
  const categories = (categoriesQ.data?.categories ?? []).filter((c) => c.isActive);
  const [reason, setReason] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);

  const setItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, newItem()]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!reason.trim()) return toast.error('请填写报销事由');
    if (items.length === 0) return toast.error('请至少添加一条分项');
    // 校验首个分项：类别必选、金额 > 0
    const first = items[0]!;
    if (!first.categoryId) return toast.error('请为分项选择报销类别');
    const firstAmt = Number(first.amount);
    if (!first.amount || Number.isNaN(firstAmt) || firstAmt <= 0) return toast.error('请填写正确的分项金额');
    // 构建要提交的分项：过滤掉未填写的空行
    const collected: ({ categoryId: number; amount: number; note?: string } | null)[] = items.map((it) => {
      const amt = Number(it.amount);
      if (!it.categoryId) {
        toast.error('存在未选择类别的分项');
        return null;
      }
      if (!it.amount || Number.isNaN(amt) || amt <= 0) {
        toast.error('存在金额无效的分项');
        return null;
      }
      return { categoryId: it.categoryId, amount: amt, note: it.note.trim() || undefined };
    });
    if (collected.some((v) => v === null)) return;
    const validItems = collected.filter((v): v is { categoryId: number; amount: number; note?: string } => v !== null);
    try {
      await create.mutateAsync({ reason: reason.trim(), items: validItems });
      toast.success('报销已提交');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="发起报销"
      description="部门由系统按当前账号自动记录；可添加多个分项，总额由系统按分项合计"
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
        <Field label="事由" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="请简述报销事由" />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-muted">
              报销分项 <span className="text-red-400">*</span>
            </span>
            <Button size="sm" variant="secondary" onClick={addItem}>
              <Plus className="h-3.5 w-3.5" />
              添加分项
            </Button>
          </div>
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="rounded-md border border-line bg-stone-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-500">分项 {idx + 1}</span>
                  <Button size="sm" variant="ghost" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                    <Trash2 className="h-3.5 w-3.5 text-stone-400" />
                    移除
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="类别" required>
                    <Select
                      value={it.categoryId}
                      onChange={(v) => setItem(idx, { categoryId: Number(v) })}
                      options={categories.map((c) => ({ value: c.id, label: c.name }))}
                      placeholder="选择类别"
                    />
                  </Field>
                  <Field label="金额（元）" required>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.amount}
                      onChange={(e) => setItem(idx, { amount: e.target.value })}
                      placeholder="如 128.50"
                    />
                  </Field>
                </div>
                <Field label="备注">
                  <Input value={it.note} onChange={(e) => setItem(idx, { note: e.target.value })} placeholder="选填" />
                </Field>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ReimbursementsPage() {
  const reimbursesQ = useReimburses();
  const reimburses = reimbursesQ.data?.reimburses ?? [];
  const canCreate = useCan('reimburse_create');
  const canApprove = useCan('reimburse_approve');
  const approve = useUpdateReimburseStatus();
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 导出报销记录列表
  const onExport = async () => {
    setExporting(true);
    try {
      await downloadExport('/api/export/reimburses');
      toast.success('报销记录已导出');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  // 展开的分项明细行 id
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const total = reimburses.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = reimburses.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const onSetStatus = (id: number, status: 'approved' | 'rejected', label: string) => {
    if (!window.confirm(`确认${label}该报销单吗？`)) return;
    approve.mutate(
      { id, status },
      { onSuccess: () => toast.success(`报销单已${label}`), onError: (e) => toast.error(e.message) },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="报销管理"
        description="部门数据隔离 —— 仅展示「本部门 + 下属部门」的报销单，跨部门不可见。"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onExport} disabled={exporting}>
              <Download className="h-4 w-4" />
              {exporting ? '导出中…' : '导出'}
            </Button>
            {canCreate && (
              <Button onClick={() => setModalOpen(true)}>
                <Receipt className="h-4 w-4" />
                发起报销
              </Button>
            )}
          </div>
        }
      />

      <Panel>
        <PanelHeader title="报销记录" description={`当前作用域内共 ${reimburses.length} 条`} />
        <Table>
          <THead>
            <TH className="w-10"></TH>
            <TH className="w-14">ID</TH>
            <TH>申请人</TH>
            <TH>所属部门</TH>
            <TH>类型</TH>
            <TH>事由</TH>
            <TH className="text-right">金额</TH>
            <TH>状态</TH>
            {canApprove && <TH className="text-right">操作</TH>}
          </THead>
          <tbody>
            {paged.map((l) => {
              const st = STATUS[l.status] ?? { text: l.status, tone: 'neutral' as const };
              const expanded = expandedId === l.id && l.items.length > 0;
              return (
                <>
                  <Row key={l.id}>
                    <TD className="w-10">
                      {l.items.length > 0 ? (
                        <button
                          onClick={() => setExpandedId(expanded ? null : l.id)}
                          className="text-stone-400 transition hover:text-ink"
                          aria-label="展开分项明细"
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </TD>
                    <TD className="font-mono text-xs text-stone-400">#{l.id}</TD>
                    <TD className="font-medium text-ink">{l.applicantName}</TD>
                    <TD className="text-stone-500">{l.departmentName}</TD>
                    <TD className="text-stone-700">{l.categoryName ?? '—'}</TD>
                    <TD className="max-w-xs truncate text-stone-600" title={l.reason}>
                      {l.reason}
                    </TD>
                    <TD className="whitespace-nowrap text-right font-mono text-sm font-semibold text-ink">
                      {fmtMoney(l.amount)}
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
                            <Button size="sm" variant="secondary" onClick={() => onSetStatus(l.id, 'approved', '批准')}>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              批准
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => onSetStatus(l.id, 'rejected', '驳回')}>
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
                  {expanded && (
                    <tr key={`items-${l.id}`}>
                      <td colSpan={canApprove ? 9 : 8} className="border-b border-line bg-stone-50/60 px-4 py-3">
                        <div className="rounded-md border border-line bg-panel">
                          <Table>
                            <THead>
                              <TH>类别</TH>
                              <TH>备注</TH>
                              <TH className="text-right">金额</TH>
                            </THead>
                            <tbody>
                              {l.items.map((it) => (
                                <Row key={it.id}>
                                  <TD className="font-medium text-ink">{it.categoryName}</TD>
                                  <TD className="max-w-xs truncate text-stone-500">{it.note ?? '—'}</TD>
                                  <TD className="whitespace-nowrap text-right font-mono text-sm text-stone-700">
                                    {fmtMoney(it.amount)}
                                  </TD>
                                </Row>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </Table>
        {reimburses.length === 0 && <Empty>当前作用域内暂无报销记录</Empty>}
        {reimburses.length > 0 && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Panel>

      {modalOpen && <ReimburseCreateModal onClose={() => setModalOpen(false)} />}
    </PageShell>
  );
}