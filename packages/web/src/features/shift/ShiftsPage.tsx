import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CalendarClock, Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import type { WorkShiftView } from '@leixi/shared';
import { useCan } from '../auth/permission';
import {
  useShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  useToggleShift,
} from './hooks';
import { useDepartments } from '../dept/hooks';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty, RowActions } from '../../components/ui/table';
import { Pagination } from '../../components/ui/pagination';

const PAGE_SIZE = 10;
const DEFAULT_COLOR = '#3b82f6';

function fmtHours(n: number): string {
  return `${n}h`;
}

/** 简单开关：用于「是否使用全局阈值」 */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm"
    >
      <span
        className={
          'relative h-5 w-9 rounded-full transition-colors ' +
          (checked ? 'bg-brand-600' : 'bg-stone-300')
        }
      >
        <span
          className={
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ' +
            (checked ? 'left-[18px]' : 'left-0.5')
          }
        />
      </span>
      <span className="text-muted">{label}</span>
    </button>
  );
}

/** 新建/编辑班次 共用表单 */
function ShiftFormModal({
  editing,
  onClose,
}: {
  editing: WorkShiftView | null;
  onClose: () => void;
}) {
  const create = useCreateShift();
  const update = useUpdateShift();
  const { data: deptsQ } = useDepartments();
  const departments = deptsQ?.departments ?? [];

  const [name, setName] = useState(editing?.name ?? '');
  const [startTime, setStartTime] = useState(editing?.startTime ?? '');
  const [endTime, setEndTime] = useState(editing?.endTime ?? '');
  const [restDuration, setRestDuration] = useState(String(editing?.restDuration ?? 60));
  const [lateThreshold, setLateThreshold] = useState(editing?.lateThreshold?.toString() ?? '');
  const [earlyThreshold, setEarlyThreshold] = useState(editing?.earlyThreshold?.toString() ?? '');
  const [useGlobalThreshold, setUseGlobalThreshold] = useState(
    editing?.useGlobalThreshold ?? true,
  );
  const [departmentId, setDepartmentId] = useState<number | null>(editing?.departmentId ?? null);
  const [description, setDescription] = useState(editing?.description ?? '');
  const [color, setColor] = useState(editing?.color ?? DEFAULT_COLOR);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    const data: Parameters<typeof create.mutateAsync>[0] = {
      name: name.trim(),
      startTime,
      endTime,
      restDuration: Number(restDuration) || 0,
      lateThreshold: useGlobalThreshold ? undefined : lateThreshold ? Number(lateThreshold) : null,
      earlyThreshold: useGlobalThreshold ? undefined : earlyThreshold ? Number(earlyThreshold) : null,
      useGlobalThreshold,
      departmentId,
      description: description.trim() || null,
      color,
    };
    if (!data.name) return toast.error('请填写班次名称');
    if (!startTime || !endTime) return toast.error('请填写上下班时间');
    try {
      setPending(true);
      if (editing) {
        await update.mutateAsync({ id: editing.id, data });
        toast.success('班次已更新');
      } else {
        await create.mutateAsync(data);
        toast.success('班次已创建');
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      width="max-w-2xl"
      title={editing ? '编辑班次' : '新增班次'}
      description={editing ? `调整「${editing.name}」的排班规则` : '创建一条排班规则，可与部门绑定'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="班次名称" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 早班" autoFocus />
          </Field>
          <Field label="颜色标记">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-line-strong bg-panel"
              />
              <span className="text-xs text-faint">{color}</span>
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="上班时间" required>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="下班时间" required>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="休息时长（分钟）">
            <Input
              type="number"
              min="0"
              step="1"
              value={restDuration}
              onChange={(e) => setRestDuration(e.target.value)}
            />
          </Field>
          <Field label="归属部门">
            <Select
              value={departmentId ?? ''}
              onChange={(v) => setDepartmentId(v === '' ? null : Number(v))}
              options={[
                { value: '', label: '通用（全公司）' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </Field>
        </div>

        <div>
          <Toggle
            checked={useGlobalThreshold}
            onChange={setUseGlobalThreshold}
            label="使用全局迟到/早退阈值"
          />
        </div>

        {!useGlobalThreshold && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="迟到阈值（分钟）" hint="留空表示为 0">
              <Input
                type="number"
                min="0"
                value={lateThreshold}
                onChange={(e) => setLateThreshold(e.target.value)}
                placeholder="如 5"
              />
            </Field>
            <Field label="早退阈值（分钟）" hint="留空表示为 0">
              <Input
                type="number"
                min="0"
                value={earlyThreshold}
                onChange={(e) => setEarlyThreshold(e.target.value)}
                placeholder="如 5"
              />
            </Field>
          </div>
        )}

        <Field label="说明描述">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="可选，如 含午休 1 小时"
          />
        </Field>
      </div>
    </Modal>
  );
}

export function ShiftsPage() {
  const shiftsQ = useShifts();
  const shifts = shiftsQ.data?.shifts ?? [];
  const canManage = useCan('shift_manage');
  const del = useDeleteShift();
  const toggle = useToggleShift();

  const sorted = useMemo(
    () => [...shifts].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.id - b.id),
    [shifts],
  );

  const [page, setPage] = useState(1);
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const [modal, setModal] = useState<{ open: boolean; editing: WorkShiftView | null }>({
    open: false,
    editing: null,
  });

  const onDelete = (s: WorkShiftView) => {
    if (!window.confirm(`确认删除班次「${s.name}」？`)) return;
    del.mutate(s.id, {
      onSuccess: () => toast.success('班次已删除'),
      onError: (e) => toast.error(e.message),
    });
  };

  const onToggle = (s: WorkShiftView) => {
    toggle.mutate(s.id, {
      onSuccess: () => toast.success(s.isActive ? '班次已停用' : '班次已启用'),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="班次管理"
        description="定义排班规则；通用阈值未开启时，可为本班次单独设置迟到/早退宽限。"
        action={
          canManage && (
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <Plus className="h-4 w-4" />
              新增班次
            </Button>
          )
        }
      />

      <Panel>
        <PanelHeader title="班次列表" description={`共 ${total} 个班次`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>名称</TH>
            <TH>时段</TH>
            <TH>时长</TH>
            <TH>休息</TH>
            <TH>迟到宽限</TH>
            <TH>早退宽限</TH>
            <TH>阈值</TH>
            <TH>归属部门</TH>
            <TH>状态</TH>
            {canManage && <TH className="text-right">操作</TH>}
          </THead>
          <tbody>
            {paged.map((s) => (
              <Row key={s.id}>
                <TD className="font-mono text-xs text-faint">#{s.id}</TD>
                <TD>
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <span
                      className="inline-block h-3 w-3 rounded-full ring-1 ring-black/10"
                      style={{ background: s.color }}
                    />
                    {s.name}
                  </span>
                </TD>
                <TD className="whitespace-nowrap font-mono text-stone-700">
                  {s.startTime} - {s.endTime}
                </TD>
                <TD className="whitespace-nowrap font-mono text-stone-600">{fmtHours(s.workHours)}</TD>
                <TD className="whitespace-nowrap text-stone-500">{s.restDuration} 分钟</TD>
                <TD className="whitespace-nowrap text-stone-500">
                  {s.lateThreshold === null ? (
                    <span className="text-faint">—</span>
                  ) : (
                    `${s.lateThreshold} 分钟`
                  )}
                </TD>
                <TD className="whitespace-nowrap text-stone-500">
                  {s.earlyThreshold === null ? (
                    <span className="text-faint">—</span>
                  ) : (
                    `${s.earlyThreshold} 分钟`
                  )}
                </TD>
                <TD>
                  {s.useGlobalThreshold ? (
                    <Badge tone="brand" dot>
                      全局
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      自定义
                    </Badge>
                  )}
                </TD>
                <TD className="text-stone-500">{s.departmentName ?? <span className="text-faint">通用（全公司）</span>}</TD>
                <TD>
                  {s.isActive ? (
                    <Badge tone="success" dot>
                      启用
                    </Badge>
                  ) : (
                    <Badge tone="neutral" dot>
                      停用
                    </Badge>
                  )}
                </TD>
                {canManage && (
                  <TD>
                    <RowActions>
                      <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, editing: s })}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => onToggle(s)}>
                        {s.isActive ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )}
                        {s.isActive ? '停用' : '启用'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => onDelete(s)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </RowActions>
                  </TD>
                )}
              </Row>
            ))}
          </tbody>
        </Table>
        {sorted.length === 0 && <Empty>暂无班次数据</Empty>}
        {sorted.length > 0 && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Panel>

      {modal.open && <ShiftFormModal editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />}
    </PageShell>
  );
}