import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, CalendarX2 } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useHolidays, useCreateHoliday, useUpdateHoliday, useDeleteHoliday } from './hooks';
import type { HolidayView } from '@leixi/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';

const TYPE_OPTIONS = [
  { label: '法定节假日', value: 'national' },
  { label: '公司自定义', value: 'company' },
  { label: '调休', value: 'rest' },
];

const TYPE_MAP: Record<string, { text: string; tone: string }> = {
  national: { text: '法定', tone: 'brand' },
  company: { text: '公司', tone: 'info' },
  rest: { text: '调休', tone: 'neutral' },
};

function currentYear(): number {
  return new Date().getFullYear();
}

function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const emptyForm = { date: today(), name: '', type: 'national' };

function HolidayModal({
  editing,
  onClose,
}: {
  editing: HolidayView | null;
  onClose: () => void;
}) {
  const create = useCreateHoliday();
  const update = useUpdateHoliday();
  const [date, setDate] = useState(editing?.date ?? emptyForm.date);
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState(editing?.type ?? 'national');

  const submit = async () => {
    if (!date) return toast.error('请选择日期');
    if (!name.trim()) return toast.error('请填写节假日名称');
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: { date, name: name.trim(), type } });
        toast.success('节假日已更新');
      } else {
        await create.mutateAsync({ date, name: name.trim(), type });
        toast.success('节假日已创建');
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
      title={editing ? '编辑节假日' : '新建节假日'}
      description="系统级配置，按具体日期管理；日期全局唯一"
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
        <Field label="日期" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="名称" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：国庆节 / 公司团建日"
          />
        </Field>
        <Field label="类型" required>
          <Select value={type} onChange={(v) => setType(String(v))} options={TYPE_OPTIONS} />
        </Field>
      </div>
    </Modal>
  );
}

export function HolidayPage() {
  const canManage = useCan('holiday_manage');
  const [year, setYear] = useState<number>(currentYear());
  const holidaysQ = useHolidays(year);
  const holidays = holidaysQ.data?.holidays ?? [];
  const del = useDeleteHoliday();
  const [modal, setModal] = useState<{ open: boolean; editing: HolidayView | null }>({
    open: false,
    editing: null,
  });

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = currentYear() + i - 2;
    return { label: `${y} 年`, value: y };
  });

  const onDelete = (id: number, name: string) => {
    if (!window.confirm(`确认删除节假日「${name}」吗？`)) return;
    del.mutate(id, {
      onSuccess: () => toast.success('节假日已删除'),
      onError: (e) => toast.error(e instanceof Error ? e.message : '删除失败'),
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="节假日"
        description="系统级休假日历设置 —— 按具体日期配置全年节假日/调休。"
        action={
          canManage && (
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <CalendarPlus className="h-4 w-4" />
              新建节假日
            </Button>
          )
        }
      />

      <Panel>
        <PanelHeader
          title="节假日列表"
          description={`${year} 年共 ${holidays.length} 天`}
          extra={
            <div className="w-40">
              <Select value={year} onChange={(v) => setYear(Number(v))} options={yearOptions} />
            </div>
          }
        />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>日期</TH>
            <TH>名称</TH>
            <TH>类型</TH>
            <TH className="w-36">操作</TH>
          </THead>
          <tbody>
            {holidays.map((h) => {
              const t = TYPE_MAP[h.type] ?? { text: h.type, tone: 'neutral' as const };
              return (
                <Row key={h.id}>
                  <TD className="font-mono text-xs text-stone-400">#{h.id}</TD>
                  <TD className="whitespace-nowrap font-medium text-ink">{h.date}</TD>
                  <TD className="max-w-xs truncate text-stone-700">{h.name}</TD>
                  <TD>
                    <span
                      className={
                        t.tone === 'brand'
                          ? 'rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700'
                          : t.tone === 'info'
                            ? 'rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700'
                            : 'rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600'
                      }
                    >
                      {t.text}
                    </span>
                  </TD>
                  <TD>
                    {canManage ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setModal({ open: true, editing: h })}
                        >
                          编辑
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => onDelete(h.id, h.name)}>
                          <CalendarX2 className="h-3.5 w-3.5" />
                          删除
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
        {holidays.length === 0 && <Empty>暂无节假日，点击右上角新建</Empty>}
      </Panel>

      {modal.open && (
        <HolidayModal editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />
      )}
    </PageShell>
  );
}