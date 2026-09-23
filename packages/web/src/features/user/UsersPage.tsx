import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { UserWithRoles } from '@leixi/shared';
import { useCan } from '../auth/permission';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetPassword, useRoles } from '../rbac/hooks';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty, RowActions } from '../../components/ui/table';
import { Pagination } from '../../components/ui/pagination';

const PAGE_SIZE = 8;

/** 头像：取姓名首字 */
function Avatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0) || '?';
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand-ink">
      {initial}
    </span>
  );
}

/** 表单弹窗：新建用户 / 编辑用户 共用 */
function UserFormModal({
  editing,
  onClose,
}: {
  editing: UserWithRoles | null;
  onClose: () => void;
}) {
  const { data: rolesQ } = useRoles();
  const roles = rolesQ?.roles ?? [];
  const create = useCreateUser();
  const update = useUpdateUser();
  const [pending, setPending] = useState(false);

  const [realName, setRealName] = useState(editing?.realName ?? '');
  const [username, setUsername] = useState(editing?.username ?? '');
  const [status, setStatus] = useState(editing?.status ?? 'active');
  const [password, setPassword] = useState('');
  const [roleIds, setRoleIds] = useState<number[]>(editing?.roleIds ?? []);

  const toggleRole = (id: number) =>
    setRoleIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    setPending(true);
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          data: { realName, status, roleIds, password: password || undefined },
        });
        toast.success('用户已更新');
      } else {
        if (!password || password.length < 6) throw new Error('新建用户需设置至少 6 位密码');
        await create.mutateAsync({ username, password, realName, roleIds });
        toast.success('用户已创建');
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
      title={editing ? '编辑用户' : '新建用户'}
      description={editing ? `修改「${editing.realName}」的资料与角色` : '创建一个新的系统账号'}
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
        <Field label="姓名" required>
          <Input value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="请输入姓名" />
        </Field>

        {!editing && (
          <Field label="用户名" required>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="登录账号"
              autoComplete="off"
            />
          </Field>
        )}

        <Field label="密码" hint={editing ? '留空则不修改' : '至少 6 位'} required={!editing}>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={editing ? '••••••' : '设置初始密码'}
            autoComplete="new-password"
          />
        </Field>

        {editing && (
          <Field label="状态">
            <Select
            value={status}
            onChange={(v) => setStatus(String(v))}
            options={[
              { value: 'active', label: '启用' },
              { value: 'disabled', label: '停用' },
            ]}
          />
          </Field>
        )}

        <Field label="角色">
          <div className="space-y-2">
            {roles.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-sm transition hover:border-brand-400/60 hover:bg-brand-soft"
              >
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                  className="h-4 w-4 rounded border-line-strong accent-brand-600"
                />
                <span className="text-ink">{r.name}</span>
                {r.isSystem && <Badge tone="warn">系统</Badge>}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export function UsersPage() {
  const usersQ = useUsers();
  const rolesQ = useRoles();
  const roleName = useMemo(
    () => new Map((rolesQ.data?.roles ?? []).map((r) => [r.id, r.name])),
    [rolesQ.data],
  );
  const users = usersQ.data?.users ?? [];
  const canCreate = useCan('user_create');
  const canUpdate = useCan('user_update');
  const canDelete = useCan('user_delete');
  const del = useDeleteUser();
  const reset = useResetPassword();

  const [page, setPage] = useState(1);
  const total = users.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = users.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const [modal, setModal] = useState<{ open: boolean; editing: UserWithRoles | null }>({
    open: false,
    editing: null,
  });

  const onDelete = (u: UserWithRoles) => {
    if (!window.confirm(`确认删除用户「${u.realName}」？此操作不可恢复。`)) return;
    del.mutate(u.id, {
      onSuccess: () => toast.success('用户已删除'),
      onError: (e) => toast.error(e.message),
    });
  };

  const onResetPassword = (u: UserWithRoles) => {
    const np = window.prompt(`为「${u.realName}」设置新密码（至少 6 位）：`, '');
    if (!np) return;
    reset.mutate(
      { id: u.id, newPassword: np },
      { onSuccess: () => toast.success('密码已重置'), onError: (e: Error) => toast.error(e.message) },
    );
  };

  return (
    <PageShell>
      <PageHeader
        title="用户管理"
        description="真实数据 CRUD —— 按 user_create / user_update / user_delete 权限控制「新建/编辑/删除」。"
        action={
          canCreate && (
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <Plus className="h-4 w-4" />
              新建用户
            </Button>
          )
        }
      />

      <Panel>
        <PanelHeader title="账号列表" description={`共 ${total} 个账号`} />
        <Table>
          <THead>
            <TH className="w-12 text-muted">ID</TH>
            <TH>用户</TH>
            <TH>角色</TH>
            <TH>状态</TH>
            <TH className="text-right">操作</TH>
          </THead>
          <tbody>
            {paged.map((u) => (
              <Row key={u.id}>
                <TD className="font-mono text-xs text-faint">#{u.id}</TD>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.realName} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink">{u.realName}</div>
                      <div className="truncate text-xs text-faint">@{u.username}</div>
                    </div>
                  </div>
                </TD>
                <TD>
                  {u.roleIds.length ? (
                    <div className="flex flex-wrap gap-1">
                      {u.roleIds.map((id) => (
                        <Badge key={id} tone="brand">
                          {roleName.get(id) ?? `角色#${id}`}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-faint">未分配</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={u.status === 'active' ? 'success' : 'neutral'} dot>
                    {u.status === 'active' ? '启用' : '停用'}
                  </Badge>
                </TD>
                <TD>
                  <RowActions>
                    {canUpdate && (
                      <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, editing: u })}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                    )}
                    {canUpdate && (
                      <Button size="sm" variant="secondary" onClick={() => onResetPassword(u)}>
                        <KeyRound className="h-3.5 w-3.5" />
                        重置密码
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onDelete(u)}
                        className={twMerge(!canUpdate && 'ml-auto')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    )}
                  </RowActions>
                </TD>
              </Row>
            ))}
          </tbody>
        </Table>
        {users.length === 0 && <Empty>暂无用户数据</Empty>}
        {users.length > 0 && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Panel>

      {modal.open && (
        <UserFormModal editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />
      )}
    </PageShell>
  );
}