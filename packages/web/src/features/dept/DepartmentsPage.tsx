import { useState } from 'react';
import { toast } from 'sonner';
import { Network, Plus, Pencil, Trash2 } from 'lucide-react';
import type { DepartmentView } from '@leixi/shared';
import { useCan } from '../auth/permission';
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
} from './hooks';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty, RowActions } from '../../components/ui/table';
import { Pagination } from '../../components/ui/pagination';

const PAGE_SIZE = 8;

/** 表单弹窗：新建部门 / 编辑部门 共用；父级下拉排除自身（防环） */
function DeptFormModal({
  editing,
  departments,
  onClose,
}: {
  editing: DepartmentView | null;
  departments: DepartmentView[];
  onClose: () => void;
}) {
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const [pending, setPending] = useState(false);

  const [name, setName] = useState(editing?.name ?? '');
  const [parentId, setParentId] = useState<number | null>(editing?.parentId ?? null);

  // 编辑某部门时，其自身及后代不得作为父级（避免形成环）
  const excluded = new Set<number>();
  const collect = (id: number) => {
    excluded.add(id);
    departments.filter((d) => d.parentId === id).forEach((d) => collect(d.id));
  };
  if (editing) collect(editing.id);

  const parentOptions = departments.filter((d) => !excluded.has(d.id));

  const submit = async () => {
    setPending(true);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, data: { name: name.trim(), parentId } });
        toast.success('部门已更新');
      } else {
        if (!name.trim()) throw new Error('请填写部门名称');
        await create.mutateAsync({ name: name.trim(), parentId });
        toast.success('部门已创建');
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
      title={editing ? '编辑部门' : '新建部门'}
      description={editing ? `调整「${editing.name}」的名称或上级` : '为组织树新增一个部门节点'}
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
        <Field label="部门名称" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入部门名称" autoFocus />
        </Field>

        <Field label="上级部门">
          <Select
            value={parentId ?? ''}
            onChange={(v) => setParentId(v === '' ? null : Number(v))}
            options={[
              { value: '', label: '无（顶级部门）' },
              ...parentOptions.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function DepartmentsPage() {
  const deptsQ = useDepartments();
  const departments = deptsQ.data?.departments ?? [];
  const canCreate = useCan('dept_create');
  const canUpdate = useCan('dept_update');
  const canDelete = useCan('dept_delete');
  const del = useDeleteDepartment();

  const [page, setPage] = useState(1);
  const total = departments.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const paged = departments.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const [modal, setModal] = useState<{ open: boolean; editing: DepartmentView | null }>({
    open: false,
    editing: null,
  });

  const nameOf = (id: number | null) => departments.find((d) => d.id === id)?.name ?? '—';

  const onDelete = (d: DepartmentView) => {
    if (!window.confirm(`确认删除部门「${d.name}」？`)) return;
    del.mutate(d.id, {
      onSuccess: () => toast.success('部门已删除'),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="部门管理"
        description="组织树自定义 —— 有子部门 / 请假单 / 用户的部门不可删除。"
        action={
          canCreate && (
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <Plus className="h-4 w-4" />
              新建部门
            </Button>
          )
        }
      />

      <Panel>
        <PanelHeader
          title="组织节点"
          description={`共 ${total} 个部门节点`}
          extra={<Badge tone="brand">组织架构</Badge>}
        />
        <Table>
          <THead>
            <TH className="w-12 text-muted">ID</TH>
            <TH>部门名称</TH>
            <TH>上级部门</TH>
            {(canUpdate || canDelete) && <TH className="text-right">操作</TH>}
          </THead>
          <tbody>
            {paged.map((d) => (
              <Row key={d.id}>
                <TD className="font-mono text-xs text-faint">#{d.id}</TD>
                <TD>
                  <span className="inline-flex items-center gap-2 font-medium text-ink">
                    <Network className="h-4 w-4 text-brand-500" />
                    {d.name}
                  </span>
                </TD>
                <TD className="text-muted">
                  {d.parentId === null ? (
                    <span className="text-faint">顶级</span>
                  ) : (
                    nameOf(d.parentId)
                  )}
                </TD>
                {(canUpdate || canDelete) && (
                  <TD>
                    <RowActions>
                      {canUpdate && (
                        <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, editing: d })}>
                          <Pencil className="h-3.5 w-3.5" />
                          编辑
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="danger" onClick={() => onDelete(d)}>
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </Button>
                      )}
                    </RowActions>
                  </TD>
                )}
              </Row>
            ))}
          </tbody>
        </Table>
        {departments.length === 0 && <Empty>暂无部门数据</Empty>}
        {departments.length > 0 && (
          <Pagination page={current} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Panel>

      {modal.open && (
        <DeptFormModal
          editing={modal.editing}
          departments={departments}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </PageShell>
  );
}