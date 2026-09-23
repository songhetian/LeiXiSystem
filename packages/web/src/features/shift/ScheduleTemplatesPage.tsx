import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarPlus, Play, CalendarRange } from 'lucide-react';
import type { ScheduleTemplateView } from '@leixi/shared';
import { useCan } from '../auth/permission';
import { useUsers } from '../rbac/hooks';
import { useShifts } from './hooks';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useSetTemplateItems,
  useDeleteTemplate,
  useApplyTemplate,
} from './hooks';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';

const WEEKDAY = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function thisMonday(): string {
  const d = new Date();
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (day - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 名称/描述 编辑 Modal（新建与重命名共用） */
function NameModal({
  initial,
  onClose,
  onCreate,
  onRename,
}: {
  initial?: { id: number; name: string; description: string | null };
  onClose: () => void;
  onCreate: (data: { name: string; description?: string | null }) => void;
  onRename: (id: number, data: { name: string; description?: string | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? '重命名模板' : '新建周模板'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              const data = { name: name.trim(), description: description.trim() || null };
              if (initial) onRename(initial.id, data);
              else onCreate(data);
            }}
          >
            保存
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="模板名称" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：标准工作日班次" />
        </Field>
        <Field label="描述">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="可选" />
        </Field>
      </div>
    </Modal>
  );
}

/** 条目编辑 Modal：员工 × 周一~周日 矩阵选班次/休息 */
function ItemsModal({ template, onClose }: { template: ScheduleTemplateView; onClose: () => void }) {
  const { data: usersQ } = useUsers();
  const users = useMemo(
    () => (usersQ?.users ?? []).filter((u) => u.status === 'active').sort((a, b) => a.id - b.id),
    [usersQ],
  );
  const shiftsQ = useShifts();
  const shifts = (shiftsQ.data?.shifts ?? []).filter((s) => s.isActive).sort((a, b) => a.id - b.id);

  // key: `${userId}_${weekday}` → value: shiftId 或 ''(休息)
  const [grid, setGrid] = useState<Record<string, number | ''>>(() => {
    const m: Record<string, number | ''> = {};
    for (const it of template.items) m[`${it.userId}_${it.weekday}`] = it.isRestDay ? '' : (it.shiftId ?? '');
    return m;
  });

  const setCell = (userId: number, weekday: number, v: number | '') =>
    setGrid((prev) => ({ ...prev, [`${userId}_${weekday}`]: v }));

  const save = async () => {
    const items = Object.entries(grid)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => {
        const [uId, wd] = k.split('_');
        return { userId: Number(uId), weekday: Number(wd), shiftId: v === '' ? null : v, isRestDay: v === '' };
      });
    try {
      await setItemsOpt.mutateAsync({ id: template.id, items });
      toast.success(`已保存 ${items.length} 条模板条目`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    }
  };

  const setItemsOpt = useSetTemplateItems();
  return (
    <Modal
      open
      onClose={onClose}
      title={`编辑条目 · ${template.name}`}
      description="为每位员工分别在 周一~周日 选择班次或休息"
      width="max-w-5xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={() => void save()} disabled={setItemsOpt.isPending}>
            {setItemsOpt.isPending ? '保存中…' : '保存条目'}
          </Button>
        </>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-strong text-xs text-muted">
              <th className="px-2 py-2 text-left font-medium">员工</th>
              {WEEKDAY.map((w) => (
                <th key={w} className="px-2 py-2 text-center font-medium">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line-soft">
                <td className="min-w-28 px-2 py-1.5">
                  <span className="font-medium text-ink">{u.realName}</span>
                </td>
                {WEEKDAY.map((_, idx) => {
                  const weekday = idx + 1;
                  const val = grid[`${u.id}_${weekday}`];
                  return (
                    <td key={weekday} className="px-1 py-1.5">
                      <Select
                        value={val ?? ''}
                        onChange={(v) => setCell(u.id, weekday, v === '' ? '' : Number(v))}
                        options={[{ value: '', label: '休息' }, ...shifts.map((s) => ({ value: s.id, label: s.name }))]}
                        placeholder="未设置"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-muted">暂无可选员工</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export function ScheduleTemplatesPage() {
  const { data: q } = useTemplates();
  const templates = q?.templates ?? [];
  const canCreate = useCan('schedule_template_create');
  const canEdit = useCan('schedule_template_edit');
  const canDelete = useCan('schedule_template_delete');
  const canApply = useCan('schedule_template_apply');

  const create = useCreateTemplate();
  const rename = useUpdateTemplate();
  const remove = useDeleteTemplate();
  const apply = useApplyTemplate();

  const [nameModal, setNameModal] = useState<null | { template?: ScheduleTemplateView }>(null);
  const [itemsFor, setItemsFor] = useState<ScheduleTemplateView | null>(null);
  const [applyFor, setApplyFor] = useState<ScheduleTemplateView | null>(null);

  return (
    <PageShell>
      <PageHeader
        title="排班模板"
        description="把常用的一周班次（员工 × 周一~周日）固化为模板，一键应用到指定周。"
        action={
          canCreate && (
            <Button onClick={() => setNameModal({})}>
              <Plus className="h-4 w-4" />
              新建模板
            </Button>
          )
        }
      />

      <Panel>
        <PanelHeader title="模板列表" description={`共 ${templates.length} 个模板`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-strong text-left text-xs text-muted">
                <th className="px-3 py-2 font-medium">名称</th>
                <th className="px-3 py-2 font-medium">描述</th>
                <th className="px-3 py-2 text-right font-medium">条目数</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-line-soft">
                  <td className="px-3 py-3 font-medium text-ink">{t.name}</td>
                  <td className="px-3 py-3 text-muted">{t.description || '-'}</td>
                  <td className="px-3 py-3 text-right tabular-nums"><Badge>{t.items.length}</Badge></td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1.5">
                      {canEdit && (
                        <>
                          <Button variant="secondary" size="sm" onClick={() => setNameModal({ template: t })} title="重命名">
                            <Pencil className="h-3.5 w-3.5" />
                            重命名
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setItemsFor(t)} title="编辑条目">
                            <CalendarRange className="h-3.5 w-3.5" />
                            编辑条目
                          </Button>
                        </>
                      )}
                      {canApply && (
                        <Button variant="secondary" size="sm" onClick={() => setApplyFor(t)} title="应用到指定周">
                          <Play className="h-3.5 w-3.5" />
                          应用
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={async () => {
                            try {
                              await remove.mutateAsync(t.id);
                              toast.success('模板已删除');
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : '删除失败');
                            }
                          }}
                          title="删除"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted">暂无模板，点击右上角「新建模板」创建</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {nameModal && (
        <NameModal
          initial={nameModal.template ? { id: nameModal.template.id, name: nameModal.template.name, description: nameModal.template.description } : undefined}
          onClose={() => setNameModal(null)}
          onCreate={(d) =>
            void create.mutateAsync(d).then(() => { toast.success('模板已创建'); setNameModal(null); }).catch((e) => toast.error(e instanceof Error ? e.message : '创建失败'))
          }
          onRename={(id, d) =>
            void rename.mutateAsync({ id, data: d }).then(() => { toast.success('已保存'); setNameModal(null); }).catch((e) => toast.error(e instanceof Error ? e.message : '保存失败'))
          }
        />
      )}
      {itemsFor && <ItemsModal template={itemsFor} onClose={() => setItemsFor(null)} />}
      {applyFor && <ApplyModal template={applyFor} onClose={() => setApplyFor(null)} apply={apply} />}
    </PageShell>
  );
}

/** 应用模板 Modal：选择目标周起始日（周一） */
function ApplyModal({
  template,
  onClose,
  apply,
}: {
  template: ScheduleTemplateView;
  onClose: () => void;
  apply: ReturnType<typeof useApplyTemplate>;
}) {
  const [weekStart, setWeekStart] = useState(thisMonday());
  return (
    <Modal
      open
      onClose={onClose}
      title={`应用模板 · ${template.name}`}
      description="把模板中每位员工的排班落到目标周的对应日期"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            disabled={apply.isPending}
            onClick={async () => {
              try {
                const r = await apply.mutateAsync({ id: template.id, targetStart: weekStart });
                toast.success(`已应用 ${r.count} 条排班`);
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : '应用失败');
              }
            }}
          >
            <CalendarPlus className="h-4 w-4" />
            {apply.isPending ? '应用中…' : '应用'}
          </Button>
        </>
      }
    >
      <Field label="目标周起始日（周一）" required hint="模板条目会落在这个周一及其后六天">
        <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
      </Field>
    </Modal>
  );
}