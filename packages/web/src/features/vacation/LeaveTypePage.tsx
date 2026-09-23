import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useLeaveTypes, useCreateLeaveType, useUpdateLeaveType, useDeleteLeaveType } from './hooks';
import type { LeaveTypeView } from '@leixi/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';

const UNIT_OPTIONS = [
  { label: '天', value: 'day' },
  { label: '小时', value: 'hour' },
];
const UNIT_MAP: Record<string, string> = { day: '天', hour: '小时' };

const emptyForm = { name: '', unit: 'day', allowance: 0, description: '' };

function LeaveTypeModal({
  editing,
  onClose,
}: {
  editing: LeaveTypeView | null;
  onClose: () => void;
}) {
  const create = useCreateLeaveType();
  const update = useUpdateLeaveType();
  const [name, setName] = useState(editing?.name ?? '');
  const [unit, setUnit] = useState(editing?.unit ?? 'day');
  const [allowance, setAllowance] = useState(editing?.allowance ?? 0);
  const [description, setDescription] = useState(editing?.description ?? '');

  const submit = async () => {
    if (!name.trim()) return toast.error('请填写类型名称');
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: { name: name.trim(), unit, allowance, description: description.trim() || null } });
        toast.success('请假类型已更新');
      } else {
        await create.mutateAsync({ name: name.trim(), unit, allowance, description: description.trim() || null });
        toast.success('请假类型已创建');
      }
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const pending = editing ? update.isPending : create.isPending;
  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? '编辑请假类型' : '新建请假类型'}
      description="系统级配置，定义请假类别及年度默认额度"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={pending}>{pending ? '保存中…' : '保存'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="名称" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：年假 / 事假 / 病假" />
        </Field>
        <Field label="计量单位" required>
          <Select value={unit} onChange={(v) => setUnit(String(v))} options={UNIT_OPTIONS} />
        </Field>
        <Field label={`年度默认额度（${UNIT_MAP[unit] ?? unit}）`} required>
          <Input type="number" min={0} step={0.5} value={String(allowance)} onChange={(e) => setAllowance(Number(e.target.value))} />
        </Field>
        <Field label="说明">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="选填" />
        </Field>
      </div>
    </Modal>
  );
}

export function LeaveTypePage() {
  const canManage = useCan('leave_type_manage');
  const leaveTypesQ = useLeaveTypes();
  const leaveTypes = leaveTypesQ.data?.leaveTypes ?? [];
  const del = useDeleteLeaveType();
  const [modal, setModal] = useState<{ open: boolean; editing: LeaveTypeView | null }>({ open: false, editing: null });

  const onDelete = (id: number, name: string) => {
    if (!window.confirm(`确认删除请假类型「${name}」吗？`)) return;
    del.mutate(id, {
      onSuccess: () => toast.success('请假类型已删除'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '删除失败'),
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="请假类型"
        description="系统级请假类别配置 —— 定义类别、计量单位与年度默认额度。"
        action={
          canManage && (
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <Plus className="h-4 w-4" />
              新建类型
            </Button>
          )
        }
      />
      <Panel>
        <PanelHeader title="类型列表" description={`共 ${leaveTypes.length} 类`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>名称</TH>
            <TH>单位</TH>
            <TH>年度默认额度</TH>
            <TH>状态</TH>
            <TH>说明</TH>
            <TH className="w-36">操作</TH>
          </THead>
          <tbody>
            {leaveTypes.map((t) => (
              <Row key={t.id}>
                <TD className="font-mono text-xs text-stone-400">#{t.id}</TD>
                <TD className="font-medium text-ink">{t.name}</TD>
                <TD className="text-stone-600">{UNIT_MAP[t.unit] ?? t.unit}</TD>
                <TD className="text-stone-700">{t.allowance}</TD>
                <TD>
                  <span className={t.isActive ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700' : 'rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500'}>
                    {t.isActive ? '启用' : '停用'}
                  </span>
                </TD>
                <TD className="max-w-xs truncate text-stone-500">{t.description ?? '—'}</TD>
                <TD>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, editing: t })}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => onDelete(t.id, t.name)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </div>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </TD>
              </Row>
            ))}
          </tbody>
        </Table>
        {leaveTypes.length === 0 && <Empty>暂无请假类型</Empty>}
      </Panel>
      {modal.open && <LeaveTypeModal editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />}
    </PageShell>
  );
}