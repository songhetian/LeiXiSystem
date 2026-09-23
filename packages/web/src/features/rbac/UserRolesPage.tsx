import { useState } from 'react';
import { toast } from 'sonner';
import { Save, UserRound } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useRoles, useSetUserRoles, useUsers } from './hooks';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Empty } from '../../components/ui/table';

/** 逐用户维护"角色已选"草稿。key 为 string，避免跨组件状态混乱 */
type Draft = Record<number, number[]>;

export function UserRolesPage() {
  const rolesQ = useRoles();
  const usersQ = useUsers();
  const save = useSetUserRoles();

  const roles = rolesQ.data?.roles ?? [];
  const users = usersQ.data?.users ?? [];

  // 草稿以初始数据为唯一事实源，在数据到达后一次性赋值
  const [draft, setDraft] = useState<Draft>({});
  const [selUserId, setSelUserId] = useState<number | null>(null);
  if (users.length > 0 && Object.keys(draft).length === 0) {
    setDraft(Object.fromEntries(users.map((u) => [u.id, u.roleIds])));
  }

  const actingRoleIds = selUserId != null ? (draft[selUserId] ?? []) : [];
  const activeUser = users.find((u) => u.id === selUserId);

  const toggleRole = (roleId: number) => {
    if (selUserId == null) return;
    setDraft((d) => ({
      ...d,
      [selUserId]: (d[selUserId] ?? []).includes(roleId)
        ? (d[selUserId] ?? []).filter((x) => x !== roleId)
        : [...(d[selUserId] ?? []), roleId],
    }));
  };

  const handleSave = () => {
    if (selUserId == null) return;
    save.mutate(
      { userId: selUserId, roleIds: actingRoleIds },
      { onSuccess: () => toast.success('用户角色已保存'), onError: (e) => toast.error(e.message) },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="用户分配角色"
        description="左侧选择用户，右侧勾选其角色后保存 —— 页面级权限由「role_assign」控制。"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
        {/* 用户列表 */}
        <Panel className="h-fit">
          <PanelHeader title="用户" extra={users.length ? <Badge tone="neutral">{users.length} 人</Badge> : undefined} />
          <ul className="divide-y divide-stone-100">
            {users.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setSelUserId(u.id)}
                  className={twMerge(
                    'group flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm transition hover:bg-brand-soft/40',
                    selUserId === u.id && 'bg-brand-soft/60',
                  )}
                >
                  <span className="inline-flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 group-hover:bg-brand-100 group-hover:text-brand-ink">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={twMerge(
                          'block truncate font-medium text-stone-700',
                          selUserId === u.id && 'text-brand-ink',
                        )}
                      >
                        {u.realName}
                      </span>
                      <span className="block truncate text-[11px] text-stone-400">@{u.username}</span>
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-stone-400">
                    {u.roleIds.length} 个角色
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {/* 角色勾选 */}
        <Panel>
          {!activeUser ? (
            <Empty>请选择左侧用户以分配角色。</Empty>
          ) : (
            <>
              <PanelHeader
                title={
                  <span>
                    {activeUser.realName}
                    <span className="ml-2 font-sans text-xs font-normal text-stone-400">
                      @{activeUser.username}
                    </span>
                  </span>
                }
                description={
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={activeUser.status === 'active' ? 'success' : 'neutral'} dot>
                      {activeUser.status === 'active' ? '启用' : '停用'}
                    </Badge>
                  </span>
                }
                extra={
                  <Button onClick={handleSave} disabled={save.isPending}>
                    <Save className="h-4 w-4" />
                    {save.isPending ? '保存中…' : '保存'}
                  </Button>
                }
              />

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 px-5 py-5">
                {roles.map((r) => {
                  const checked = actingRoleIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={twMerge(
                        'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition',
                        'border-stone-200/70 hover:border-brand-400/50 hover:bg-brand-soft/30',
                        checked && 'border-brand-400/70 bg-brand-soft/50',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRole(r.id)}
                        className="h-4 w-4 rounded border-stone-300 accent-brand-600"
                      />
                      <span className={twMerge('font-medium text-stone-700', checked && 'text-brand-ink')}>
                        {r.name}
                      </span>
                      {r.isSystem && <Badge tone="warn">系统</Badge>}
                      <span className="ml-auto font-mono text-[11px] text-stone-400">
                        {r.permissionIds.length} 项
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>
    </PageShell>
  );
}