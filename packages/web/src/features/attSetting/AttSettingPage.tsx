import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { useCan } from '../auth/permission';
import { useAttSetting, useUpdateAttSetting } from './hooks';
import type { AttSettingView } from '@leixi/shared';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';

/** 布尔开关（无现成 Switch 组件，内嵌简易实现） */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ' +
        (checked ? 'bg-brand-600' : 'bg-stone-200') +
        (disabled ? ' cursor-not-allowed opacity-50' : ' cursor-pointer')
      }
      role="switch"
      aria-checked={checked}
    >
      <span
        className={
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ' +
          (checked ? 'translate-x-6' : 'translate-x-1')
        }
      />
    </button>
  );
}

interface Section {
  key: string;
  title: string;
  desc: string;
  fields: {
    key: keyof AttSettingView;
    label: string;
    hint: string;
    kind: 'number' | 'toggle';
  }[];
}

const SECTIONS: Section[] = [
  {
    key: 'time',
    title: '计时与宽限',
    desc: '上下班打卡的早晚宽限分钟数',
    fields: [
      { key: 'earlyClockInMinutes', label: '上班打卡宽限（分钟）', hint: '晚于该分钟数内不计迟到', kind: 'number' },
      { key: 'lateClockOutMinutes', label: '下班打卡宽限（分钟）', hint: '早于该分钟数内不计早退', kind: 'number' },
    ],
  },
  {
    key: 'judge',
    title: '异常判定',
    desc: '迟到/早退/缺勤的判定阈值',
    fields: [
      { key: 'lateMinutes', label: '迟到判定阈值（分钟）', hint: '超过该分钟数记为迟到', kind: 'number' },
      { key: 'earlyLeaveMinutes', label: '早退判定阈值（分钟）', hint: '超过该分钟数记为早退', kind: 'number' },
      { key: 'absentHours', label: '缺勤判定阈值（小时）', hint: '当日工时不足则该天记为缺勤', kind: 'number' },
    ],
  },
  {
    key: 'makeup',
    title: '补卡策略',
    desc: '是否允许补卡及相关审批规则',
    fields: [
      { key: 'allowMakeup', label: '允许补卡', hint: '关闭后员工无法发起补卡申请', kind: 'toggle' },
      { key: 'requireApprovalForMakeup', label: '补卡需审批', hint: '补卡申请需管理员审批通过后才生效', kind: 'toggle' },
      { key: 'makeupDeadlineDays', label: '补卡申请截止（天）', hint: '距打卡日超过该天数不可再补卡', kind: 'number' },
    ],
  },
  {
    key: 'notify',
    title: '通知开关',
    desc: '异常考勤是否同步系统通知',
    fields: [
      { key: 'notifyOnLate', label: '迟到通知', kind: 'toggle', hint: '' },
      { key: 'notifyOnEarlyLeave', label: '早退通知', kind: 'toggle', hint: '' },
      { key: 'notifyOnAbsent', label: '缺勤通知', kind: 'toggle', hint: '' },
    ],
  },
  {
    key: 'check',
    title: '按时打卡判定',
    desc: '启用后按阈值判定异常，否则仅做记录',
    fields: [{ key: 'enableTimeCheck', label: '启用按时打卡判定', kind: 'toggle', hint: '' }],
  },
];

function SectionCard({
  section,
  values,
  onChange,
}: {
  section: Section;
  values: AttSettingView;
  onChange: (k: keyof AttSettingView, v: number | boolean) => void;
}) {
  return (
    <Panel>
      <PanelHeader title={section.title} description={section.desc} />
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        {section.fields.map((f) => (
          <div key={f.key} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{f.label}</div>
              {f.hint && <div className="mt-0.5 text-xs text-faint">{f.hint}</div>}
            </div>
            {f.kind === 'toggle' ? (
              <Toggle checked={values[f.key] as boolean} onChange={(v) => onChange(f.key, v)} />
            ) : (
              <Input
                type="number"
                min={0}
                className="w-24"
                value={String(values[f.key] as number)}
                onChange={(e) => onChange(f.key, Number(e.target.value))}
              />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function AttSettingPage() {
  const canEdit = useCan('att_setting_edit');
  const settingQ = useAttSetting();
  const update = useUpdateAttSetting();
  const [values, setValues] = useState<AttSettingView | null>(null);

  // 初始数据就绪后载入本地编辑状态；后台数据刷新时同步（保存后 query 失效会触发）
  useEffect(() => {
    if (settingQ.data?.setting && !update.isPending) {
      setValues((prev) => prev ?? settingQ.data!.setting);
    }
  }, [settingQ.data, update.isPending]);

  const current = values ?? settingQ.data?.setting ?? null;

  const onChange = (k: keyof AttSettingView, v: number | boolean) => {
    setValues((prev) => (prev ? { ...prev, [k]: v } : prev));
  };

  const save = async () => {
    if (!current) return toast.error('配置尚未加载完成');
    try {
      await update.mutateAsync(current);
      toast.success('考勤设置已保存');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="考勤设置"
        description="系统级全局考勤规则 —— 计时阈值 / 异常判定 / 补卡策略 / 通知开关。"
        action={
          canEdit && (
            <Button onClick={save} disabled={update.isPending || !current}>
              <Save className="h-4 w-4" />
              {update.isPending ? '保存中…' : '保存设置'}
            </Button>
          )
        }
      />

      {!current ? (
        <div className="rounded-lg border border-line bg-panel p-8 text-center text-sm text-faint">
          {settingQ.isLoading ? '加载中…' : '考勤设置为空'}
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((s) => (
            <SectionCard key={s.key} section={s} values={current} onChange={onChange} />
          ))}
        </div>
      )}
    </PageShell>
  );
}