import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useCan } from '../auth/permission';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from './hooks';
import type { ReimburseCategoryView } from '@leixi/shared';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field, Input, Select } from '../../components/ui/field';
import { PageShell, PageHeader } from '../../components/ui/page-header';
import { Panel, PanelHeader } from '../../components/ui/panel';
import { Table, THead, TH, TD, Row, Empty } from '../../components/ui/table';

/** 启用/停用下拉选项 */
const ACTIVE_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

function CategoryModal({
  editing,
  onClose,
}: {
  editing: ReimburseCategoryView | null;
  onClose: () => void;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const [name, setName] = useState(editing?.name ?? '');
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [description, setDescription] = useState(editing?.description ?? '');

  const submit = async () => {
    if (!name.trim()) return toast.error('请填写类别名称');
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          data: { name: name.trim(), isActive, description: description.trim() || null },
        });
        toast.success('报销类别已更新');
      } else {
        await create.mutateAsync({
          name: name.trim(),
          isActive,
          description: description.trim() || null,
        });
        toast.success('报销类别已创建');
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
      title={editing ? '编辑报销类别' : '新建报销类别'}
      description="系统级配置，定义报销分项可选的类别"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={pending}>{pending ? '保存中…' : '保存'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="类别名称" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：交通 / 餐饮 / 办公 / 差旅" />
        </Field>
        <Field label="状态" hint="停用的类别在发起报销时不可选择">
          <Select value={isActive ? 'active' : 'inactive'} onChange={(v) => setIsActive(v === 'active')} options={ACTIVE_OPTIONS} />
        </Field>
        <Field label="说明">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="选填" />
        </Field>
      </div>
    </Modal>
  );
}

export function CategoriesPage() {
  const canManage = useCan('reimburse_category_manage');
  const categoriesQ = useCategories();
  const categories = categoriesQ.data?.categories ?? [];
  const del = useDeleteCategory();
  const [modal, setModal] = useState<{ open: boolean; editing: ReimburseCategoryView | null }>({
    open: false,
    editing: null,
  });

  const onDelete = (id: number, name: string) => {
    if (!window.confirm(`确认删除报销类别「${name}」吗？`)) return;
    del.mutate(id, {
      onSuccess: () => toast.success('报销类别已删除'),
      onError: (e) => {
        // 后端对「被报销单引用」返回 409，此处给出友好提示
        const msg = e instanceof Error ? e.message : '删除失败';
        toast.error(msg.includes('引用') ? '该类别已被报销单引用，无法删除' : msg);
      },
    });
  };

  return (
    <PageShell>
      <PageHeader
        title="报销类别"
        description="系统级报销类别配置 —— 定义报销分项可选类别，无部门隔离。"
        action={
          canManage && (
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <Plus className="h-4 w-4" />
              新建类别
            </Button>
          )
        }
      />
      <Panel>
        <PanelHeader title="类别列表" description={`共 ${categories.length} 类`} />
        <Table>
          <THead>
            <TH className="w-14">ID</TH>
            <TH>类别名称</TH>
            <TH>说明</TH>
            <TH>状态</TH>
            <TH className="w-36">操作</TH>
          </THead>
          <tbody>
            {categories.map((c) => (
              <Row key={c.id}>
                <TD className="font-mono text-xs text-stone-400">#{c.id}</TD>
                <TD className="font-medium text-ink">{c.name}</TD>
                <TD className="max-w-xs truncate text-stone-500">{c.description ?? '—'}</TD>
                <TD>
                  <span
                    className={
                      c.isActive
                        ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                        : 'rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500'
                    }
                  >
                    {c.isActive ? '启用' : '停用'}
                  </span>
                </TD>
                <TD>
                  {canManage ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setModal({ open: true, editing: c })}>
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => onDelete(c.id, c.name)}>
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
        {categories.length === 0 && <Empty>暂无报销类别</Empty>}
      </Panel>
      {modal.open && <CategoryModal editing={modal.editing} onClose={() => setModal({ open: false, editing: null })} />}
    </PageShell>
  );
}