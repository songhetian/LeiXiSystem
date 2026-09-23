import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ScheduleView } from '@leixi/shared';
import { useSelfSchedules, useSetSelfSchedule, useShifts } from './hooks';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function toStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function offsetMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** 自助排班 Modal：选班次或休息 */
function SelfModal({
  date,
  record,
  onClose,
}: {
  date: string;
  record: ScheduleView | null;
  onClose: () => void;
}) {
  const setSelf = useSetSelfSchedule();
  const shiftsQ = useShifts();
  const shifts = shiftsQ.data?.shifts ?? [];

  const options = useMemo(
    () => [
      { value: '', label: '休息日' },
      ...shifts
        .filter((s) => s.isActive)
        .sort((a, b) => a.id - b.id)
        .map((s) => ({
          value: s.id,
          label: `${s.name}（${s.startTime}-${s.endTime}）`,
        })),
    ],
    [shifts],
  );

  const [shiftId, setShiftId] = useState<number | ''>(() =>
    record && record.shiftId !== null ? record.shiftId : record && record.isRestDay ? '' : '',
  );

  const submit = async () => {
    try {
      await setSelf.mutateAsync({
        scheduleDate: date,
        shiftId: shiftId === '' ? null : Number(shiftId),
        isRestDay: shiftId === '',
      });
      toast.success('排班已更新');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败');
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="我的排班"
      description={`${date} 选择班次或设为休息日`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={submit} disabled={setSelf.isPending}>
            {setSelf.isPending ? '提交中…' : '保存'}
          </Button>
        </>
      }
    >
      <Field label="班次 / 休息" required>
        <Select value={shiftId} onChange={(v) => setShiftId(Number(v))} options={options} placeholder="选择班次" />
      </Field>
    </Modal>
  );
}

export function MySchedulePage() {
  const now = new Date();
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const start = toStr(new Date(view.year, view.month, 1));
  const end = toStr(new Date(view.year, view.month + 1, 0));

  const schedulesQ = useSelfSchedules(start, end);
  const schedules = schedulesQ.data?.schedules ?? [];

  const byDate = useMemo(() => {
    const m = new Map<string, ScheduleView>();
    for (const s of schedules) m.set(s.scheduleDate, s);
    return m;
  }, [schedules]);

  const [openDate, setOpenDate] = useState<string | null>(null);

  const firstDow = new Date(view.year, view.month, 1).getDay(); // 0=周日
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const todayStr = toStr(new Date());

  return (
    <PageShell>
      <PageHeader
        title="我的排班"
        description="按月查看个人排班，点击任意日期可自助选择班次或设为休息日。"
        action={
          <div className="flex items-center gap-1">
            <Button variant="secondary" onClick={() => setView((v) => offsetMonth(v.year, v.month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-32 text-center font-medium text-ink">
              {view.year} 年 {view.month + 1} 月
            </span>
            <Button variant="secondary" onClick={() => setView((v) => offsetMonth(v.year, v.month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <Panel>
        <PanelHeader title="月历视图" description={`共 ${schedules.length} 天有排班记录`} />
        <div className="p-5">
          <div
            className="grid grid-cols-7 gap-1 text-center"
            style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
          >
            {WEEK.map((w) => (
              <div key={w} className="pb-2 text-xs font-medium uppercase tracking-wide text-muted">
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} className="min-h-20" />;
              const dateStr = toStr(new Date(view.year, view.month, day));
              const rec = byDate.get(dateStr);
              const isToday = dateStr === todayStr;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => setOpenDate(dateStr)}
                  className={
                    'flex min-h-20 flex-col items-stretch gap-1 rounded-md border p-1.5 text-left transition ' +
                    (rec
                      ? 'border-line-strong bg-panel-soft hover:border-brand-400'
                      : 'border-transparent bg-panel-soft/50 hover:border-line-strong')
                  }
                >
                  <span
                    className={
                      'text-xs font-medium ' +
                      (isToday
                        ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white'
                        : 'text-stone-500')
                    }
                  >
                    {day}
                  </span>
                  {rec && (
                    <>
                      {rec.isRestDay ? (
                        <span className="mt-1 text-xs font-semibold text-ochre-ink">休息</span>
                      ) : (
                        <span className="mt-1 text-xs font-semibold" style={{ color: rec.color ?? undefined }}>
                          {rec.shiftName}
                        </span>
                      )}
                      {!rec.isRestDay && rec.startTime && (
                        <span className="text-[11px] text-muted">
                          {rec.startTime}-{rec.endTime}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Panel>

      {openDate && (
        <SelfModal
          date={openDate}
          record={byDate.get(openDate) ?? null}
          onClose={() => setOpenDate(null)}
        />
      )}
    </PageShell>
  );
}