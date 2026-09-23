import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, Save } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { PermissionPoint } from '@leixi/shared';
import { useCan } from '../auth/permission';
import { useRoles, useSetRolePermissions } from './hooks';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Empty } from '../../components/ui/table';

function groupByModule(permissions: PermissionPoint[]): Record<string, PermissionPoint[]> {
  return permissions.reduce<Record<string, PermissionPoint[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});
}

export function RolesPage() {
  const { data } = useRoles();
  const save = useSetRolePermissions();
  const canUpdate = useCan('role_update');

  const roles = data?.roles ?? [];
  const permissions = data?.permissions ?? [];
  const [activeRoleId, setActiveRoleId] = useState<number | null>(null);
  const activeRole = roles.find((r) => r.id === activeRoleId) ?? roles[0] ?? null;

  const [selected, setSelected] = useState<number[]>([]);
  const [draftInitializedFor, setDraftInitializedFor] = useState<number | null>(null);
  if (activeRole && draftInitializedFor !== activeRole.id) {
    setSelected(activeRole.permissionIds);
    setDraftInitializedFor(activeRole.id);
  }

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const grouped = groupByModule(permissions);
  const dirty = activeRole
    ? selected.length !== activeRole.permissionIds.length ||
      selected.some((x) => !activeRole.permissionIds.includes(x))
    : false;

  const handleSave = () => {
    if (!activeRole) return;
    save.mutate(
      { roleId: activeRole.id, permissionIds: selected },
      { onSuccess: () => toast.success('角色权限已保存'), onError: (e) => toast.error(e.message) },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="角色权限分配"
        description="左侧选择角色，右侧勾选其权限点后保存 —— 页面级权限由「role_view」控制。"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* 角色列表 */}
        <Panel className="h-fit">
          <PanelHeader title="角色" extra={roles.length ? <Badge tone="neutral">{roles.length} 个</Badge> : undefined} />
          <ul className="divide-y divide-stone-100">
            {roles.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setActiveRoleId(r.id)}
                  className={twMerge(
                    'group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition',
                    'hover:bg-brand-soft/40',
                    activeRole?.id === r.id && 'bg-brand-soft/60',
                  )}
                >
                  <span
                    className={twMerge(
                      'inline-flex items-center gap-2 font-medium text-stone-700',
                      activeRole?.id === r.id && 'text-brand-ink',
                    )}
                  >
                    <ShieldCheck
                      className={twMerge(
                        'h-4 w-4 text-stone-300 group-hover:text-brand-500',
                        activeRole?.id === r.id && 'text-brand-ink',
                      )}
                    />
                    {r.name}
                    {r.isSystem && <Badge tone="warn">系统</Badge>}
                  </span>
                  <span className="font-mono text-xs text-stone-400">{r.permissionIds.length} 项</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 权限勾选 */}
        <Panel>
          {!activeRole ? (
            <Empty>暂无角色。</Empty>
          ) : (
            <>
              <PanelHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    {activeRole.name}
                    {activeRole.isSystem && <Badge tone="warn">系统</Badge>}
                  </span>
                }
                description="勾选后点击保存，立即生效"
                extra={
                  <Button
                    disabled={!canUpdate || !dirty || save.isPending}
                    onClick={handleSave}
                  >
                    <Save className="h-4 w-4" />
                    {save.isPending ? '保存中…' : '保存'}
                  </Button>
                }
              />

              <div className="px-5 py-5">
                {Object.entries(grouped).map(([module, perms]) => (
                  <fieldset key={module} className="mb-6 last:mb-0">
                    <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                      {module}
                    </legend>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {perms.map((p) => {
                        const checked = selected.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={twMerge(
                              'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition',
                              'border-stone-200/70 hover:border-brand-400/50 hover:bg-brand-soft/30',
                              checked && 'border-brand-400/70 bg-brand-soft/50',
                              !canUpdate && 'cursor-not-allowed opacity-60',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(p.id)}
                              disabled={!canUpdate}
                              className="h-4 w-4 rounded border-stone-300 accent-brand-600"
                            />
                            <span className={twMerge('font-medium text-stone-700', checked && 'text-brand-ink')}>
                              {p.name}
                            </span>
                            <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-stone-400">
                              {p.type === 'menu' ? '页面' : '动作'} · {p.code}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}